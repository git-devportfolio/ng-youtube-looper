import { 
  Component, 
  OnInit,
  inject,
  signal,
  computed,
  effect 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionFacade } from '../../data-access';
import { SessionFormComponent, SessionFormData } from '../session-form';
import { SessionListComponent, SessionListEvents } from '../session-list';
import { ImportExportComponent, ImportExportEvents } from '../import-export';
import { LooperSession, SessionHistoryEntry } from '@core/services/looper-storage.types';

export type ViewMode = 'list' | 'create' | 'edit' | 'history' | 'import-export';

@Component({
  selector: 'app-session-manager',
  standalone: true,
  imports: [
    CommonModule,
    SessionFormComponent,
    SessionListComponent,
    ImportExportComponent
  ],
  templateUrl: './session-manager.component.html',
  styleUrls: ['./session-manager.component.scss']
})
export class SessionManagerComponent implements OnInit {
  // Expose facade for template access (public readonly for both private use and template)
  readonly sessionFacade = inject(SessionFacade);

  // Component state signals
  private readonly _currentView = signal<ViewMode>('list');
  private readonly _editingSession = signal<LooperSession | null>(null);
  private readonly _selectedSessions = signal<string[]>([]);
  private readonly _videoContext = signal<{
    videoId: string;
    videoTitle: string;
    videoUrl: string;
    videoDuration: number;
  } | null>(null);

  // Public readonly signals
  readonly currentView = this._currentView.asReadonly();
  readonly editingSession = this._editingSession.asReadonly();
  readonly selectedSessions = this._selectedSessions.asReadonly();
  readonly videoContext = this._videoContext.asReadonly();

  // Expose facade signals
  readonly sessionList = this.sessionFacade.sessionList;
  readonly currentSession = this.sessionFacade.currentSession;
  readonly filteredSessions = this.sessionFacade.filteredSessions;
  readonly recentSessions = this.sessionFacade.recentSessions;
  readonly history = this.sessionFacade.history;
  readonly isLoading = this.sessionFacade.isLoading;
  readonly lastError = this.sessionFacade.lastError;
  readonly hasActiveSessions = this.sessionFacade.hasActiveSessions;

  // Computed signals for UI state
  readonly canCreateSession = computed(() => {
    const context = this._videoContext();
    return context !== null && context.videoId.length > 0;
  });

  readonly hasSelectedSessions = computed(() => this._selectedSessions().length > 0);

  readonly viewTitle = computed(() => {
    const view = this._currentView();
    switch (view) {
      case 'list': return 'Mes Sessions';
      case 'create': return 'Nouvelle Session';
      case 'edit': return `Modifier "${this._editingSession()?.name || 'Session'}"`;
      case 'history': return 'Historique des Vidéos';
      case 'import-export': return 'Import / Export';
      default: return 'Gestionnaire de Sessions';
    }
  });

  readonly showBackButton = computed(() => this._currentView() !== 'list');

  readonly recentVideos = computed(() => {
    return this.history()
      .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime())
      .slice(0, 10);
  });

  constructor() {
    // Auto-navigate back to list when editing session is deleted
    effect(() => {
      const editing = this._editingSession();
      const sessions = this.sessionList();
      
      if (editing && !sessions.find(s => s.id === editing.id)) {
        this._currentView.set('list');
        this._editingSession.set(null);
      }
    });
  }

  ngOnInit(): void {
    // Set initial view based on context
    this.initializeView();
  }

  // === VIEW NAVIGATION ===

  /**
   * Set video context for session creation
   */
  setVideoContext(
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    videoDuration: number
  ): void {
    this._videoContext.set({
      videoId,
      videoTitle,
      videoUrl,
      videoDuration
    });
  }

  /**
   * Navigate to different views
   */
  navigateToView(view: ViewMode): void {
    this._currentView.set(view);
    this._editingSession.set(null);
  }

  /**
   * Navigate to create session view
   */
  navigateToCreate(): void {
    if (this.canCreateSession()) {
      this._currentView.set('create');
    }
  }

  /**
   * Navigate to edit session view
   */
  navigateToEdit(session: LooperSession): void {
    this._editingSession.set(session);
    this._currentView.set('edit');
  }

  /**
   * Navigate back to list view
   */
  navigateBack(): void {
    this._currentView.set('list');
    this._editingSession.set(null);
  }

  // === SESSION LIST EVENTS ===

  onSessionSelect(session: LooperSession): void {
    // Select session for potential bulk operations
    const selected = this._selectedSessions();
    if (selected.includes(session.id)) {
      this._selectedSessions.set(selected.filter(id => id !== session.id));
    } else {
      this._selectedSessions.set([...selected, session.id]);
    }
  }

  onSessionLoad(session: LooperSession): void {
    this.sessionFacade.loadSession(session.id);
  }

  onSessionEdit(session: LooperSession): void {
    this.navigateToEdit(session);
  }

  async onSessionDelete(session: LooperSession): Promise<void> {
    const result = await this.sessionFacade.deleteSession(session.id);
    
    if (result.success) {
      // Remove from selected sessions if it was selected
      const selected = this._selectedSessions();
      if (selected.includes(session.id)) {
        this._selectedSessions.set(selected.filter(id => id !== session.id));
      }
    }
  }

  async onSessionDuplicate(session: LooperSession): Promise<void> {
    // Create a duplicate with new name
    const duplicateName = `${session.name} (Copie)`;
    const result = await this.sessionFacade.createSession(
      duplicateName,
      session.videoId,
      session.videoTitle,
      session.videoUrl,
      session.videoDuration
    );

    if (result.success) {
      // Update the new session with original data
      await this.sessionFacade.updateSession({
        description: session.description,
        tags: session.tags,
        loops: [...session.loops],
        globalPlaybackSpeed: session.globalPlaybackSpeed
      });
    }
  }

  // === EMPTY STATE EVENTS ===

  /**
   * Handle create session request from empty state
   */
  onCreateSessionRequest(): void {
    if (this.canCreateSession()) {
      this.navigateToCreate();
    } else {
      // If no video context, navigate to history to select a video
      this.navigateToView('history');
    }
  }

  /**
   * Handle import sessions request from empty state
   */
  onImportSessionsRequest(): void {
    this.navigateToView('import-export');
  }

  // === AUTO-SAVE EVENTS ===

  /**
   * Handle manual save request
   */
  async onManualSave(): Promise<void> {
    await this.sessionFacade.forceSave();
  }

  /**
   * Handle retry save after error
   */
  async onRetrySave(): Promise<void> {
    this.sessionFacade.clearSaveError();
    await this.sessionFacade.forceSave();
  }

  /**
   * Handle dismiss save error
   */
  onDismissError(): void {
    this.sessionFacade.clearSaveError();
  }

  /**
   * Handle toggle auto-save
   */
  async onToggleAutoSave(): Promise<void> {
    await this.sessionFacade.toggleAutoSave();
  }

  // === SESSION FORM EVENTS ===

  onSessionSave(formData: SessionFormData): void {
    this.navigateBack();
  }

  onSessionCancel(): void {
    this.navigateBack();
  }

  // === IMPORT/EXPORT EVENTS ===

  onExportComplete(result: { success: boolean; message?: string }): void {
    // Handle export completion feedback
    console.log('Export complete:', result);
  }

  onImportComplete(result: { success: boolean; message?: string; sessionsCount?: number }): void {
    // Handle import completion feedback
    console.log('Import complete:', result);
  }

  onOperationError(error: string): void {
    // Handle operation errors
    console.error('Operation error:', error);
  }

  // === BULK OPERATIONS ===

  async exportSelectedSessions(): Promise<void> {
    const selected = this._selectedSessions();
    if (selected.length === 0) return;

    const result = await this.sessionFacade.exportSelectedSessions(selected);
    if (result.success) {
      this._selectedSessions.set([]);
    }
  }

  clearSelectedSessions(): void {
    this._selectedSessions.set([]);
  }

  selectAllSessions(): void {
    const allIds = this.sessionList().map(s => s.id);
    this._selectedSessions.set(allIds);
  }

  async deleteSelectedSessions(): Promise<void> {
    const selected = this._selectedSessions();
    if (selected.length === 0) return;

    const promises = selected.map(id => this.sessionFacade.deleteSession(id));
    await Promise.all(promises);
    
    this._selectedSessions.set([]);
  }

  // === HISTORY MANAGEMENT ===

  /**
   * Load session from history entry
   */
  async loadSessionFromHistory(historyEntry: SessionHistoryEntry): Promise<void> {
    const success = await this.sessionFacade.loadSession(historyEntry.sessionId);
    if (success) {
      this.navigateBack();
    }
  }

  /**
   * Create new session from video history entry
   */
  createSessionFromHistory(historyEntry: SessionHistoryEntry): void {
    this.setVideoContext(
      historyEntry.videoId,
      historyEntry.videoTitle,
      '', // URL not stored in history
      0   // Duration not stored in history
    );
    this.navigateToCreate();
  }

  // === UTILITY METHODS ===

  private initializeView(): void {
    // Start with list view by default
    this._currentView.set('list');
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

  formatRelativeDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'À l\'instant';
    } else if (diffMinutes < 60) {
      return `Il y a ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `Il y a ${diffHours}h`;
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays < 7) {
      return `Il y a ${diffDays} jours`;
    } else {
      return this.formatDate(d);
    }
  }

  // === TEMPLATE HELPERS ===

  trackHistoryById(index: number, entry: SessionHistoryEntry): string {
    return entry.sessionId;
  }

  isSessionSelected(sessionId: string): boolean {
    return this._selectedSessions().includes(sessionId);
  }

  getSelectedCount(): number {
    return this._selectedSessions().length;
  }
}