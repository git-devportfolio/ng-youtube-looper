import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SessionManagerService } from '@core/services/session-manager.service';
import { 
  LooperSession,
  SessionSettings,
  CurrentState,
  SessionHistoryEntry,
  StorageOperationResult 
} from '@core/services/looper-storage.types';
import { LoopSegment } from '@shared/interfaces';

@Injectable({
  providedIn: 'root'
})
export class SessionFacade {
  private readonly sessionManager = inject(SessionManagerService);

  // Internal signals for facade state
  private readonly _isLoading = signal<boolean>(false);
  private readonly _currentSession = signal<LooperSession | null>(null);
  private readonly _sessionList = signal<LooperSession[]>([]);
  private readonly _filteredSessions = signal<LooperSession[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _selectedVideoId = signal<string | null>(null);

  // Public readonly signals for external access
  readonly isLoading = this._isLoading.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessionList = this._sessionList.asReadonly();
  readonly filteredSessions = this._filteredSessions.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly selectedVideoId = this._selectedVideoId.asReadonly();

  // Computed signals for derived state
  readonly hasActiveSessions = computed(() => 
    this._sessionList().some(session => session.isActive)
  );

  readonly sessionCount = computed(() => this._sessionList().length);

  readonly currentVideoSessions = computed(() => {
    const videoId = this._selectedVideoId();
    if (!videoId) return [];
    return this._sessionList().filter(session => session.videoId === videoId);
  });

  readonly recentSessions = computed(() => 
    this.sessionManager.getRecentSessions(5)
  );

  readonly hasUnsavedChanges = computed(() => {
    const current = this._currentSession();
    if (!current) return false;
    const stored = this._sessionList().find(s => s.id === current.id);
    return stored ? JSON.stringify(current) !== JSON.stringify(stored) : true;
  });

  // Expose underlying service signals
  readonly currentState = this.sessionManager.currentState;
  readonly settings = this.sessionManager.settings;
  readonly history = this.sessionManager.history;
  readonly lastError = this.sessionManager.lastError;

  constructor() {
    // Sync facade state with session manager
    effect(() => {
      const sessions = this.sessionManager.sessions();
      this._sessionList.set(sessions);
      this.updateFilteredSessions();
    });

    effect(() => {
      const activeSession = this.sessionManager.activeSession();
      this._currentSession.set(activeSession);
    });

    // Auto-update filtered sessions when search changes
    effect(() => {
      this.updateFilteredSessions();
    });
  }

  // === SESSION CREATION & MANAGEMENT ===

  /**
   * Create a new session
   */
  async createSession(
    name: string,
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    videoDuration: number
  ): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const result = this.sessionManager.createSession(
        name,
        videoId,
        videoTitle,
        videoUrl,
        videoDuration
      );

      if (result.success) {
        // Auto-select the newly created session
        const sessions = this.sessionManager.sessions();
        const newSession = sessions[sessions.length - 1];
        if (newSession) {
          this._currentSession.set(newSession);
          this.sessionManager.setActiveSession(newSession.id);
        }
      }

      return result;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Save current session
   */
  async saveSession(): Promise<StorageOperationResult> {
    const current = this._currentSession();
    if (!current) {
      return { success: false, error: 'Aucune session active à sauvegarder' };
    }

    this._isLoading.set(true);
    
    try {
      return this.sessionManager.updateSession(current.id, current);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId: string): Promise<boolean> {
    this._isLoading.set(true);
    
    try {
      const session = this._sessionList().find(s => s.id === sessionId);
      if (!session) {
        return false;
      }

      this._currentSession.set(session);
      this.sessionManager.setActiveSession(sessionId);
      return true;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const result = this.sessionManager.deleteSession(sessionId);
      
      if (result.success && this._currentSession()?.id === sessionId) {
        this._currentSession.set(null);
      }

      return result;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Update current session with partial data
   */
  async updateSession(updates: Partial<LooperSession>): Promise<StorageOperationResult> {
    const current = this._currentSession();
    if (!current) {
      return { success: false, error: 'Aucune session active à mettre à jour' };
    }

    this._isLoading.set(true);
    
    try {
      const updatedSession = { ...current, ...updates };
      this._currentSession.set(updatedSession);
      
      return this.sessionManager.updateSession(current.id, updatedSession);
    } finally {
      this._isLoading.set(false);
    }
  }

  // === SEARCH & FILTERING ===

  /**
   * Set search query for filtering sessions
   */
  setSearchQuery(query: string): void {
    this._searchQuery.set(query.trim());
  }

  /**
   * Set filter by video ID
   */
  setVideoFilter(videoId: string | null): void {
    this._selectedVideoId.set(videoId);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this._searchQuery.set('');
    this._selectedVideoId.set(null);
  }

  /**
   * Update filtered sessions based on current search and video filter
   */
  private updateFilteredSessions(): void {
    const sessions = this._sessionList();
    const query = this._searchQuery();
    const videoId = this._selectedVideoId();

    let filtered = [...sessions];

    // Apply video filter
    if (videoId) {
      filtered = filtered.filter(session => session.videoId === videoId);
    }

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(session =>
        session.name.toLowerCase().includes(searchTerm) ||
        session.videoTitle.toLowerCase().includes(searchTerm) ||
        session.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    this._filteredSessions.set(filtered);
  }

  // === LOOP MANAGEMENT ===

  /**
   * Add loops to current session
   */
  async addLoopsToCurrentSession(loops: LoopSegment[]): Promise<StorageOperationResult> {
    const current = this._currentSession();
    if (!current) {
      return { success: false, error: 'Aucune session active' };
    }

    this._isLoading.set(true);
    
    try {
      return this.sessionManager.addLoopsToSession(current.id, loops);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Update loops in current session
   */
  async updateCurrentSessionLoops(loops: LoopSegment[]): Promise<StorageOperationResult> {
    const current = this._currentSession();
    if (!current) {
      return { success: false, error: 'Aucune session active' };
    }

    return this.updateSession({ loops });
  }

  // === STATE MANAGEMENT HELPERS ===

  /**
   * Update current state through facade
   */
  updateCurrentState(updates: Partial<CurrentState>): void {
    this.sessionManager.updateCurrentState(updates);
  }

  /**
   * Update session settings
   */
  async updateSettings(updates: Partial<SessionSettings>): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      return this.sessionManager.updateSettings(updates);
    } finally {
      this._isLoading.set(false);
    }
  }

  // === UTILITY METHODS ===

  /**
   * Check if a session exists by name
   */
  sessionExistsByName(name: string): boolean {
    return this._sessionList().some(session => 
      session.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get sessions for specific video
   */
  getSessionsForVideo(videoId: string): LooperSession[] {
    return this._sessionList().filter(session => session.videoId === videoId);
  }

  /**
   * Get storage information
   */
  getStorageInfo() {
    return this.sessionManager.getStorageInfo();
  }

  /**
   * Export sessions data
   */
  async exportSessions(): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      return this.sessionManager.exportSessions();
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Import sessions data
   */
  async importSessions(data: any): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      return this.sessionManager.importSessions(data);
    } finally {
      this._isLoading.set(false);
    }
  }
}