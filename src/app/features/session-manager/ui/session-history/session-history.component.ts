import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  inject, 
  signal, 
  computed 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionFacade } from '../../data-access';
import { SessionHistoryEntry } from '@core/services/looper-storage.types';

export interface SessionHistoryEvents {
  loadFromHistory: SessionHistoryEntry;
  clearHistory: void;
}

@Component({
  selector: 'app-session-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './session-history.component.html',
  styleUrl: './session-history.component.scss'
})
export class SessionHistoryComponent {
  private readonly sessionFacade = inject(SessionFacade);

  @Input() maxItems: number = 10;
  @Input() showVideoInfo: boolean = true;
  @Input() showDateInfo: boolean = true;

  @Output() loadFromHistory = new EventEmitter<SessionHistoryEntry>();
  @Output() clearHistory = new EventEmitter<void>();

  // Component signals
  private readonly _selectedEntry = signal<string | null>(null);
  
  // Expose facade signals
  readonly history = this.sessionFacade.history;
  readonly isLoading = this.sessionFacade.isLoading;

  // Computed signals
  readonly recentHistory = computed(() => 
    this.history()
      .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime())
      .slice(0, this.maxItems)
  );

  readonly isEmpty = computed(() => this.recentHistory().length === 0);

  readonly selectedEntry = this._selectedEntry.asReadonly();

  // === TEMPLATE ACTIONS ===

  onLoadFromHistory(entry: SessionHistoryEntry, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this._selectedEntry.set(entry.sessionId);
    this.loadFromHistory.emit(entry);
  }

  onClearHistory(): void {
    this.clearHistory.emit();
  }

  // === UTILITY METHODS ===

  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else {
      return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  getVideoThumbnailUrl(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  // === TEMPLATE HELPERS ===

  trackEntryById(_index: number, entry: SessionHistoryEntry): string {
    return entry.sessionId + entry.accessedAt.toString();
  }

  isSelected(entry: SessionHistoryEntry): boolean {
    return this._selectedEntry() === entry.sessionId;
  }
}
