import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { LooperStorageService } from './looper-storage.service';
import { 
  LooperSession,
  SessionSettings,
  CurrentState,
  SessionHistoryEntry,
  StorageOperationResult,
  DEFAULT_SESSION_SETTINGS
} from './looper-storage.types';
import { LoopSegment } from '@shared/interfaces';

@Injectable({
  providedIn: 'root'
})
export class SessionManagerService {
  private readonly storage = inject(LooperStorageService);

  // Reactive state using signals
  private readonly _sessions = signal<LooperSession[]>([]);
  private readonly _currentState = signal<CurrentState>({
    activeSessionId: null,
    currentVideoId: null,
    currentTime: 0,
    playbackSpeed: 1.0,
    isPlaying: false,
    activeLoopId: null,
    lastActivity: new Date()
  });
  private readonly _settings = signal<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  private readonly _history = signal<SessionHistoryEntry[]>([]);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly sessions = this._sessions.asReadonly();
  readonly currentState = this._currentState.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly history = this._history.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  // Computed state
  readonly activeSession = computed(() => {
    const activeId = this._currentState().activeSessionId;
    if (!activeId) return null;
    return this._sessions().find(session => session.id === activeId) || null;
  });

  readonly videoSessions = computed(() => {
    const currentVideoId = this._currentState().currentVideoId;
    if (!currentVideoId) return [];
    return this._sessions().filter(session => session.videoId === currentVideoId);
  });

  readonly sessionCount = computed(() => this._sessions().length);

  readonly hasActiveSessions = computed(() => this._sessions().some(session => session.isActive));

  private autoSaveInterval?: number;
  private cleanupInterval?: number;

  constructor() {
    // Initialize data on service creation
    this.initializeData();
    
    // Set up auto-save if enabled
    effect(() => {
      const settings = this._settings();
      if (settings.autoSaveEnabled) {
        this.setupAutoSave(settings.autoSaveInterval);
      } else {
        this.stopAutoSave();
      }
    });

    // Set up periodic cleanup
    this.setupPeriodicCleanup();
  }

  // === INITIALIZATION ===

  /**
   * Initialize all data from storage
   */
  private async initializeData(): Promise<void> {
    try {
      // Load sessions
      const sessionsResult = this.storage.loadSessions();
      if (sessionsResult.success) {
        this._sessions.set(sessionsResult.data as LooperSession[]);
      }

      // Load current state
      const stateResult = this.storage.loadCurrentState();
      if (stateResult.success) {
        this._currentState.set(stateResult.data as CurrentState);
      }

      // Load settings
      const settingsResult = this.storage.loadSessionSettings();
      if (settingsResult.success) {
        this._settings.set(settingsResult.data as SessionSettings);
      }

      // Load history
      const historyResult = this.storage.loadSessionHistory();
      if (historyResult.success) {
        this._history.set(historyResult.data as SessionHistoryEntry[]);
      }

      this._lastError.set(null);
    } catch (error) {
      this._lastError.set(`Erreur d'initialisation: ${(error as Error).message}`);
    }
  }

  // === SESSION OPERATIONS ===

  /**
   * Create a new session
   */
  createSession(
    name: string,
    videoId: string,
    videoTitle: string,
    videoUrl: string,
    videoDuration: number
  ): StorageOperationResult {
    try {
      const newSession: LooperSession = {
        id: this.generateSessionId(),
        name: name.trim(),
        videoId: videoId.trim(),
        videoTitle: videoTitle.trim(),
        videoUrl: videoUrl.trim(),
        videoDuration,
        loops: [],
        globalPlaybackSpeed: 1.0,
        currentTime: 0,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPlayTime: 0,
        playCount: 0
      };

      const result = this.storage.saveSession(newSession);
      
      if (result.success) {
        const updatedSessions = [...this._sessions(), newSession];
        this._sessions.set(updatedSessions);
        this._lastError.set(null);
      } else {
        this._lastError.set(result.error || 'Erreur lors de la création');
      }

      return result;
    } catch (error) {
      const errorMsg = `Erreur de création de session: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Update an existing session
   */
  updateSession(sessionId: string, updates: Partial<LooperSession>): StorageOperationResult {
    try {
      const sessions = this._sessions();
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      
      if (sessionIndex === -1) {
        const error = `Session ${sessionId} introuvable`;
        this._lastError.set(error);
        return { success: false, error };
      }

      const updatedSession: LooperSession = {
        ...sessions[sessionIndex],
        ...updates,
        id: sessionId, // Ensure ID cannot be changed
        updatedAt: new Date()
      };

      const result = this.storage.saveSession(updatedSession);
      
      if (result.success) {
        const updatedSessions = [...sessions];
        updatedSessions[sessionIndex] = updatedSession;
        this._sessions.set(updatedSessions);
        this._lastError.set(null);
      } else {
        this._lastError.set(result.error || 'Erreur lors de la mise à jour');
      }

      return result;
    } catch (error) {
      const errorMsg = `Erreur de mise à jour: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): StorageOperationResult {
    try {
      const result = this.storage.deleteSession(sessionId);
      
      if (result.success) {
        const filteredSessions = this._sessions().filter(s => s.id !== sessionId);
        this._sessions.set(filteredSessions);
        
        // Update current state if deleted session was active
        if (this._currentState().activeSessionId === sessionId) {
          this.updateCurrentState({ activeSessionId: null });
        }
        
        this._lastError.set(null);
      } else {
        this._lastError.set(result.error || 'Erreur lors de la suppression');
      }

      return result;
    } catch (error) {
      const errorMsg = `Erreur de suppression: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Set active session
   */
  setActiveSession(sessionId: string | null): boolean {
    try {
      if (sessionId && !this._sessions().find(s => s.id === sessionId)) {
        this._lastError.set(`Session ${sessionId} introuvable`);
        return false;
      }

      this.updateCurrentState({ 
        activeSessionId: sessionId,
        lastActivity: new Date()
      });

      // Add to history if setting an active session
      if (sessionId) {
        const session = this._sessions().find(s => s.id === sessionId);
        if (session) {
          this.addToHistory(session);
        }
      }

      return true;
    } catch (error) {
      this._lastError.set(`Erreur d'activation: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Add loops to a session
   */
  addLoopsToSession(sessionId: string, loops: LoopSegment[]): StorageOperationResult {
    try {
      const session = this._sessions().find(s => s.id === sessionId);
      if (!session) {
        const error = `Session ${sessionId} introuvable`;
        this._lastError.set(error);
        return { success: false, error };
      }

      const updatedLoops = [...session.loops, ...loops];
      
      return this.updateSession(sessionId, { 
        loops: updatedLoops,
        updatedAt: new Date()
      });
    } catch (error) {
      const errorMsg = `Erreur d'ajout de boucles: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // === STATE MANAGEMENT ===

  /**
   * Update current application state
   */
  updateCurrentState(updates: Partial<CurrentState>): void {
    try {
      const currentState = this._currentState();
      const newState: CurrentState = {
        ...currentState,
        ...updates,
        lastActivity: new Date()
      };

      this._currentState.set(newState);
      
      // Persist to storage
      this.storage.saveCurrentState(newState);
      this._lastError.set(null);
    } catch (error) {
      this._lastError.set(`Erreur de mise à jour d'état: ${(error as Error).message}`);
    }
  }

  /**
   * Update session settings
   */
  updateSettings(updates: Partial<SessionSettings>): StorageOperationResult {
    try {
      const currentSettings = this._settings();
      const newSettings: SessionSettings = {
        ...currentSettings,
        ...updates
      };

      const result = this.storage.saveSessionSettings(newSettings);
      
      if (result.success) {
        this._settings.set(newSettings);
        this._lastError.set(null);
      } else {
        this._lastError.set(result.error || 'Erreur de mise à jour des paramètres');
      }

      return result;
    } catch (error) {
      const errorMsg = `Erreur de paramètres: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // === HISTORY MANAGEMENT ===

  /**
   * Add session to history
   */
  private addToHistory(session: LooperSession): void {
    try {
      const historyEntry: SessionHistoryEntry = {
        sessionId: session.id,
        sessionName: session.name,
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        accessedAt: new Date(),
        duration: session.totalPlayTime,
        loopsCount: session.loops.length,
        lastCurrentTime: session.currentTime
      };

      const result = this.storage.addToSessionHistory(historyEntry);
      
      if (result.success) {
        this._history.set(result.data as SessionHistoryEntry[]);
      }
    } catch (error) {
      console.error('Erreur d\'ajout à l\'historique:', error);
    }
  }

  // === AUTO-SAVE MANAGEMENT ===

  /**
   * Setup automatic saving
   */
  private setupAutoSave(interval: number): void {
    this.stopAutoSave();
    
    this.autoSaveInterval = window.setInterval(() => {
      this.performAutoSave();
    }, interval);
  }

  /**
   * Stop automatic saving
   */
  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined as any;
    }
  }

  /**
   * Perform automatic save operation
   */
  private performAutoSave(): void {
    try {
      // Save current state
      this.storage.saveCurrentState(this._currentState());
      
      // Save active sessions
      const activeSessions = this._sessions().filter(session => session.isActive);
      if (activeSessions.length > 0) {
        this.storage.saveSessions(this._sessions());
      }
    } catch (error) {
      console.error('Erreur d\'auto-sauvegarde:', error);
    }
  }

  // === CLEANUP MANAGEMENT ===

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    // Cleanup every hour
    this.cleanupInterval = window.setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Perform cleanup operation
   */
  private performCleanup(): void {
    try {
      // Cleanup history
      this.storage.cleanupHistory();
      
      // Remove old inactive sessions (older than 30 days)
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeSessions = this._sessions().filter(session => 
        session.isActive || new Date(session.updatedAt) > cutoffDate
      );

      if (activeSessions.length !== this._sessions().length) {
        this._sessions.set(activeSessions);
        this.storage.saveSessions(activeSessions);
      }
    } catch (error) {
      console.error('Erreur de nettoyage:', error);
    }
  }

  // === UTILITY METHODS ===

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get storage information
   */
  getStorageInfo() {
    return this.storage.getStorageInfo();
  }

  /**
   * Export all session data
   */
  exportSessions(): StorageOperationResult {
    return this.storage.exportAllData();
  }

  /**
   * Import session data
   */
  importSessions(data: any): StorageOperationResult {
    const result = this.storage.importData(data);
    
    if (result.success) {
      // Refresh local state after import
      this.initializeData();
    }
    
    return result;
  }

  /**
   * Create backup
   */
  createBackup(): StorageOperationResult {
    return this.storage.createBackup();
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(): StorageOperationResult {
    const result = this.storage.restoreFromBackup();
    
    if (result.success) {
      // Refresh local state after restore
      this.initializeData();
    }
    
    return result;
  }

  /**
   * Clear all data
   */
  clearAllData(): StorageOperationResult {
    try {
      const result = this.storage.clearAllLooperData();
      
      if (result.success) {
        // Reset local state
        this._sessions.set([]);
        this._currentState.set({
          activeSessionId: null,
          currentVideoId: null,
          currentTime: 0,
          playbackSpeed: 1.0,
          isPlaying: false,
          activeLoopId: null,
          lastActivity: new Date()
        });
        this._settings.set(DEFAULT_SESSION_SETTINGS);
        this._history.set([]);
        this._lastError.set(null);
      }

      return result;
    } catch (error) {
      const errorMsg = `Erreur de suppression: ${(error as Error).message}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get sessions by video ID
   */
  getSessionsForVideo(videoId: string): LooperSession[] {
    return this._sessions().filter(session => session.videoId === videoId);
  }

  /**
   * Search sessions by name or video title
   */
  searchSessions(query: string): LooperSession[] {
    const searchTerm = query.toLowerCase().trim();
    return this._sessions().filter(session =>
      session.name.toLowerCase().includes(searchTerm) ||
      session.videoTitle.toLowerCase().includes(searchTerm) ||
      session.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Get recent sessions from history
   */
  getRecentSessions(limit: number = 10): SessionHistoryEntry[] {
    return this._history()
      .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime())
      .slice(0, limit);
  }

  // === LIFECYCLE MANAGEMENT ===

  /**
   * Cleanup resources when service is destroyed
   */
  ngOnDestroy(): void {
    this.stopAutoSave();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}