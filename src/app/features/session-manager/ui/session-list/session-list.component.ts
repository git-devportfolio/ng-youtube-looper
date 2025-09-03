import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit,
  inject,
  signal,
  computed,
  effect 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionFacade } from '../../data-access';
import { LooperSession } from '@core/services/looper-storage.types';

export interface SessionListEvents {
  sessionSelect: LooperSession;
  sessionEdit: LooperSession;
  sessionDelete: LooperSession;
  sessionDuplicate: LooperSession;
  sessionLoad: LooperSession;
}

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-list.component.html',
  styleUrls: ['./session-list.component.scss']
})
export class SessionListComponent implements OnInit {
  private readonly sessionFacade = inject(SessionFacade);

  @Input() showSearch: boolean = true;
  @Input() showVideoFilter: boolean = false;
  @Input() currentVideoId: string | null = null;
  @Input() maxDisplayCount: number = 20;

  @Output() sessionSelect = new EventEmitter<LooperSession>();
  @Output() sessionEdit = new EventEmitter<LooperSession>();
  @Output() sessionDelete = new EventEmitter<LooperSession>();
  @Output() sessionDuplicate = new EventEmitter<LooperSession>();
  @Output() sessionLoad = new EventEmitter<LooperSession>();

  // Component state signals
  private readonly _searchQuery = signal<string>('');
  private readonly _selectedSessionId = signal<string | null>(null);
  private readonly _confirmingDeleteId = signal<string | null>(null);
  private readonly _sortBy = signal<'name' | 'date' | 'duration'>('date');
  private readonly _sortAscending = signal<boolean>(false);

  // Public readonly signals
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly selectedSessionId = this._selectedSessionId.asReadonly();
  readonly confirmingDeleteId = this._confirmingDeleteId.asReadonly();
  readonly sortBy = this._sortBy.asReadonly();
  readonly sortAscending = this._sortAscending.asReadonly();

  // Expose facade signals
  readonly sessionList = this.sessionFacade.sessionList;
  readonly filteredSessions = this.sessionFacade.filteredSessions;
  readonly currentSession = this.sessionFacade.currentSession;
  readonly isLoading = this.sessionFacade.isLoading;
  readonly lastError = this.sessionFacade.lastError;
  readonly hasActiveSessions = this.sessionFacade.hasActiveSessions;

  // Computed signals for list display
  readonly displaySessions = computed(() => {
    let sessions = this.filteredSessions();

    // Apply video filter if enabled
    if (this.showVideoFilter && this.currentVideoId) {
      sessions = sessions.filter(session => session.videoId === this.currentVideoId);
    }

    // Apply sorting
    sessions = this.sortSessions(sessions);

    // Apply display limit
    return sessions.slice(0, this.maxDisplayCount);
  });

  readonly hasMoreSessions = computed(() => {
    const total = this.filteredSessions().length;
    const displayed = this.displaySessions().length;
    return total > displayed;
  });

  readonly sessionCount = computed(() => this.filteredSessions().length);

  readonly isEmpty = computed(() => this.sessionList().length === 0);

  readonly hasSearchResults = computed(() => {
    const query = this._searchQuery();
    return query.length > 0 && this.filteredSessions().length === 0;
  });

  constructor() {
    // Sync search query with facade
    effect(() => {
      this.sessionFacade.setSearchQuery(this._searchQuery());
    });

    // Sync video filter with facade
    effect(() => {
      if (this.showVideoFilter && this.currentVideoId) {
        this.sessionFacade.setVideoFilter(this.currentVideoId);
      } else {
        this.sessionFacade.setVideoFilter(null);
      }
    });
  }

  ngOnInit(): void {
    // Initialize with current video filter if provided
    if (this.showVideoFilter && this.currentVideoId) {
      this.sessionFacade.setVideoFilter(this.currentVideoId);
    }
  }

  // === SEARCH & FILTERING ===

  onSearchChange(query: string): void {
    this._searchQuery.set(query);
  }

  clearSearch(): void {
    this._searchQuery.set('');
  }

  // === SORTING ===

  setSortBy(sortBy: 'name' | 'date' | 'duration'): void {
    if (this._sortBy() === sortBy) {
      this._sortAscending.set(!this._sortAscending());
    } else {
      this._sortBy.set(sortBy);
      this._sortAscending.set(sortBy === 'name');
    }
  }

  private sortSessions(sessions: LooperSession[]): LooperSession[] {
    const sortBy = this._sortBy();
    const ascending = this._sortAscending();

    return [...sessions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'duration':
          const aDuration = this.getTotalSessionDuration(a);
          const bDuration = this.getTotalSessionDuration(b);
          comparison = aDuration - bDuration;
          break;
      }

      return ascending ? comparison : -comparison;
    });
  }

  // === SESSION ACTIONS ===

  onSessionSelect(session: LooperSession): void {
    this._selectedSessionId.set(session.id);
    this.sessionSelect.emit(session);
  }

  onSessionLoad(session: LooperSession, event: Event): void {
    event.stopPropagation();
    this.sessionLoad.emit(session);
  }

  onSessionEdit(session: LooperSession, event: Event): void {
    event.stopPropagation();
    this.sessionEdit.emit(session);
  }

  onSessionDelete(session: LooperSession, event: Event): void {
    event.stopPropagation();
    this._confirmingDeleteId.set(session.id);
  }

  confirmDelete(session: LooperSession): void {
    this.sessionDelete.emit(session);
    this._confirmingDeleteId.set(null);
  }

  cancelDelete(): void {
    this._confirmingDeleteId.set(null);
  }

  onSessionDuplicate(session: LooperSession, event: Event): void {
    event.stopPropagation();
    this.sessionDuplicate.emit(session);
  }

  // === UTILITY METHODS ===

  getTotalSessionDuration(session: LooperSession): number {
    return session.loops.reduce((total, loop) => 
      total + (loop.endTime - loop.startTime), 0
    );
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSessionStats(session: LooperSession): { 
    loopsCount: number;
    totalDuration: string;
    totalPlayTime: string;
  } {
    return {
      loopsCount: session.loops.length,
      totalDuration: this.formatDuration(this.getTotalSessionDuration(session)),
      totalPlayTime: this.formatDuration(session.totalPlayTime)
    };
  }

  // === TEMPLATE HELPERS ===

  trackSessionById(index: number, session: LooperSession): string {
    return session.id;
  }

  isSessionActive(session: LooperSession): boolean {
    return this.currentSession()?.id === session.id;
  }

  isSessionSelected(session: LooperSession): boolean {
    return this._selectedSessionId() === session.id;
  }

  isConfirmingDelete(session: LooperSession): boolean {
    return this._confirmingDeleteId() === session.id;
  }

  getSortIcon(field: 'name' | 'date' | 'duration'): string {
    if (this._sortBy() !== field) return '↕';
    return this._sortAscending() ? '↑' : '↓';
  }

  getSortAriaLabel(field: 'name' | 'date' | 'duration'): string {
    const isActive = this._sortBy() === field;
    const direction = isActive 
      ? (this._sortAscending() ? 'croissant' : 'décroissant')
      : 'non trié';
    
    const fieldName = field === 'name' ? 'nom' : 
                      field === 'date' ? 'date' : 'durée';
    
    return `Trier par ${fieldName}, actuellement ${direction}`;
  }
}