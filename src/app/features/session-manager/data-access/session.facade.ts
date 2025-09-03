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

  // === EXPORT FUNCTIONALITY ===

  /**
   * Export all sessions as JSON file download
   */
  async exportAllSessions(filename?: string): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const result = this.sessionManager.exportSessions();
      if (result.success && result.data) {
        const defaultFilename = `looper-sessions-${this.formatDateForFilename(new Date())}.json`;
        this.downloadJsonFile(result.data, filename || defaultFilename);
      }
      return result;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Export single session as JSON file download
   */
  async exportSession(sessionId: string, filename?: string): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const session = this._sessionList().find(s => s.id === sessionId);
      if (!session) {
        return { success: false, error: 'Session introuvable' };
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        type: 'single-session',
        session: session
      };

      const defaultFilename = `session-${this.sanitizeFilename(session.name)}-${this.formatDateForFilename(new Date())}.json`;
      this.downloadJsonFile(exportData, filename || defaultFilename);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Erreur d'export: ${(error as Error).message}` };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Export selected sessions as JSON file download
   */
  async exportSelectedSessions(sessionIds: string[], filename?: string): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const sessions = this._sessionList().filter(s => sessionIds.includes(s.id));
      if (sessions.length === 0) {
        return { success: false, error: 'Aucune session sélectionnée' };
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        type: 'multiple-sessions',
        sessionsCount: sessions.length,
        sessions: sessions
      };

      const defaultFilename = `sessions-${sessions.length}-${this.formatDateForFilename(new Date())}.json`;
      this.downloadJsonFile(exportData, filename || defaultFilename);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Erreur d'export: ${(error as Error).message}` };
    } finally {
      this._isLoading.set(false);
    }
  }

  // === IMPORT FUNCTIONALITY ===

  /**
   * Import sessions from JSON file
   */
  async importSessionsFromFile(file: File): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      const fileContent = await this.readFileAsText(file);
      const importData = await this.validateAndParseImportData(fileContent);
      
      if (importData.type === 'single-session') {
        return await this.importSingleSession(importData.session);
      } else if (importData.type === 'multiple-sessions') {
        return await this.importMultipleSessions(importData.sessions);
      } else {
        // Legacy format - full export
        return this.sessionManager.importSessions(importData);
      }
    } catch (error) {
      return { success: false, error: `Erreur d'import: ${(error as Error).message}` };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Import sessions from JSON data
   */
  async importSessions(data: any): Promise<StorageOperationResult> {
    this._isLoading.set(true);
    
    try {
      return this.sessionManager.importSessions(data);
    } finally {
      this._isLoading.set(false);
    }
  }

  // === IMPORT HELPERS ===

  private async importSingleSession(sessionData: LooperSession): Promise<StorageOperationResult> {
    // Generate new ID to avoid conflicts
    const newSession: LooperSession = {
      ...sessionData,
      id: this.generateUniqueSessionId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: false
    };

    return this.sessionManager.updateSession(newSession.id, newSession);
  }

  private async importMultipleSessions(sessionsData: LooperSession[]): Promise<StorageOperationResult> {
    try {
      let successCount = 0;
      const errors: string[] = [];

      for (const sessionData of sessionsData) {
        const result = await this.importSingleSession(sessionData);
        if (result.success) {
          successCount++;
        } else {
          errors.push(`${sessionData.name}: ${result.error}`);
        }
      }

      if (errors.length === 0) {
        return { success: true, data: `${successCount} sessions importées avec succès` };
      } else if (successCount > 0) {
        return { 
          success: true, 
          data: `${successCount} sessions importées, ${errors.length} échecs: ${errors.join(', ')}` 
        };
      } else {
        return { success: false, error: `Toutes les importations ont échoué: ${errors.join(', ')}` };
      }
    } catch (error) {
      return { success: false, error: `Erreur d'import multiple: ${(error as Error).message}` };
    }
  }

  // === FILE UTILITIES ===

  private downloadJsonFile(data: any, filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Échec de lecture du fichier'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Erreur de lecture du fichier'));
      };
      
      reader.readAsText(file);
    });
  }

  private async validateAndParseImportData(jsonContent: string): Promise<any> {
    try {
      const data = JSON.parse(jsonContent);
      
      // Validate basic structure
      if (!data || typeof data !== 'object') {
        throw new Error('Format JSON invalide');
      }

      // Check for new export format
      if (data.version && data.type) {
        if (data.type === 'single-session' && !data.session) {
          throw new Error('Données de session manquantes');
        }
        if (data.type === 'multiple-sessions' && (!data.sessions || !Array.isArray(data.sessions))) {
          throw new Error('Données de sessions manquantes ou invalides');
        }
        return data;
      }
      
      // Legacy format validation
      if (!Array.isArray(data) && !data.sessions) {
        throw new Error('Format de données non reconnu');
      }
      
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Fichier JSON invalide');
      }
      throw error;
    }
  }

  // === UTILITY HELPERS ===

  private generateUniqueSessionId(): string {
    let id: string;
    const existing = this._sessionList().map(s => s.id);
    
    do {
      id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } while (existing.includes(id));
    
    return id;
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9\-_\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substr(0, 30); // Limit length
  }

  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}${month}${day}-${hours}${minutes}`;
  }
}