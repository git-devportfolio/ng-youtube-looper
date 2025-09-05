import { Injectable, inject, signal, computed, effect, DestroyRef } from '@angular/core';
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
  private readonly destroyRef = inject(DestroyRef);

  // Internal signals for facade state
  private readonly _isLoading = signal<boolean>(false);
  private readonly _currentSession = signal<LooperSession | null>(null);
  private readonly _sessionList = signal<LooperSession[]>([]);
  private readonly _filteredSessions = signal<LooperSession[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _selectedVideoId = signal<string | null>(null);
  private readonly _selectedTags = signal<string[]>([]);
  
  // Debounced search
  private readonly _debouncedSearchQuery = signal<string>('');
  private searchDebounceTimer?: number;
  private readonly SEARCH_DEBOUNCE_DELAY = 300; // 300ms
  
  // Auto-save state signals
  private readonly _isSaving = signal<boolean>(false);
  private readonly _lastSaveTime = signal<Date | null>(null);
  private readonly _saveError = signal<string | null>(null);
  private readonly _hasUnsavedChanges = signal<boolean>(false);
  
  private autoSaveTimer?: number | undefined;

  // Public readonly signals for external access
  readonly isLoading = this._isLoading.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly sessionList = this._sessionList.asReadonly();
  readonly filteredSessions = this._filteredSessions.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();
  readonly selectedVideoId = this._selectedVideoId.asReadonly();
  readonly selectedTags = this._selectedTags.asReadonly();
  
  // Auto-save state signals for UI
  readonly isSaving = this._isSaving.asReadonly();
  readonly lastSaveTime = this._lastSaveTime.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly hasUnsavedChanges = this._hasUnsavedChanges.asReadonly();

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

  // Auto-save computed signals
  readonly autoSaveStatus = computed(() => {
    const isSaving = this._isSaving();
    const hasChanges = this._hasUnsavedChanges();
    const saveError = this._saveError();
    const lastSave = this._lastSaveTime();
    
    if (saveError) return 'error' as const;
    if (isSaving) return 'saving' as const;
    if (hasChanges) return 'pending' as const;
    if (lastSave) return 'saved' as const;
    return 'idle' as const;
  });

  readonly saveStatusText = computed(() => {
    const status = this.autoSaveStatus();
    const lastSave = this._lastSaveTime();
    
    switch (status) {
      case 'saving': return 'Sauvegarde en cours...';
      case 'saved': 
        return lastSave ? `Sauvegardé à ${lastSave.toLocaleTimeString()}` : 'Sauvegardé';
      case 'pending': return 'Modifications non sauvegardées';
      case 'error': return this._saveError() || 'Erreur de sauvegarde';
      default: return '';
    }
  });

  readonly canManualSave = computed(() => {
    return this._hasUnsavedChanges() && !this._isSaving() && this._currentSession() !== null;
  });

  // Computed signals for filtering
  readonly availableTags = computed(() => {
    const allTags = new Set<string>();
    this._sessionList().forEach(session => {
      session.tags?.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  });

  readonly hasActiveFilters = computed(() => {
    return this._searchQuery().length > 0 || 
           this._selectedVideoId() !== null || 
           this._selectedTags().length > 0;
  });

  // Expose underlying service signals
  readonly currentState = this.sessionManager.currentState;
  readonly settings = this.sessionManager.settings;
  readonly history = this.sessionManager.history;
  readonly lastError = this.sessionManager.lastError;

  constructor() {
    // Setup cleanup for debounce timer
    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceTimer !== undefined) {
        clearTimeout(this.searchDebounceTimer);
      }
    });

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

    // Auto-update filtered sessions when debounced search or other filters change
    effect(() => {
      this.updateFilteredSessions();
    });

    // Detect changes in current session for auto-save
    effect(() => {
      const current = this._currentSession();
      if (current) {
        this.detectSessionChanges(current);
      } else {
        this._hasUnsavedChanges.set(false);
        this.clearAutoSaveTimer();
      }
    });

    // Handle auto-save settings changes
    effect(() => {
      const settings = this.settings();
      if (settings.autoSaveEnabled && this._hasUnsavedChanges()) {
        this.scheduleAutoSave(settings.autoSaveInterval);
      } else {
        this.clearAutoSaveTimer();
      }
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

    this._isSaving.set(true);
    this._saveError.set(null);
    
    try {
      const result = await this.sessionManager.updateSession(current.id, current);
      
      if (result.success) {
        this._hasUnsavedChanges.set(false);
        this._lastSaveTime.set(new Date());
        this.clearAutoSaveTimer();
        this.resetRetryCounter(); // Reset retry counter on successful save
      } else {
        this._saveError.set(result.error || 'Erreur de sauvegarde');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this._saveError.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this._isSaving.set(false);
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
   * Set search query for filtering sessions (with debouncing)
   */
  setSearchQuery(query: string): void {
    const trimmedQuery = query.trim();
    this._searchQuery.set(trimmedQuery);
    
    // Debounce the actual search
    if (this.searchDebounceTimer !== undefined) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    this.searchDebounceTimer = window.setTimeout(() => {
      this._debouncedSearchQuery.set(trimmedQuery);
    }, this.SEARCH_DEBOUNCE_DELAY);
  }

  /**
   * Set search query immediately (for programmatic use)
   */
  setSearchQueryImmediate(query: string): void {
    const trimmedQuery = query.trim();
    this._searchQuery.set(trimmedQuery);
    this._debouncedSearchQuery.set(trimmedQuery);
    
    if (this.searchDebounceTimer !== undefined) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  /**
   * Set filter by video ID
   */
  setVideoFilter(videoId: string | null): void {
    this._selectedVideoId.set(videoId);
  }

  /**
   * Set tag filters
   */
  setTagFilter(tags: string[]): void {
    this._selectedTags.set([...tags]);
  }

  /**
   * Add tag to filter
   */
  addTagFilter(tag: string): void {
    const currentTags = this._selectedTags();
    if (!currentTags.includes(tag)) {
      this._selectedTags.set([...currentTags, tag]);
    }
  }

  /**
   * Remove tag from filter
   */
  removeTagFilter(tag: string): void {
    const currentTags = this._selectedTags();
    this._selectedTags.set(currentTags.filter(t => t !== tag));
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this._searchQuery.set('');
    this._selectedVideoId.set(null);
    this._selectedTags.set([]);
  }

  /**
   * Update filtered sessions based on current search and video filter
   */
  private updateFilteredSessions(): void {
    const sessions = this._sessionList();
    const query = this._debouncedSearchQuery(); // Use debounced search query
    const videoId = this._selectedVideoId();
    const selectedTags = this._selectedTags();

    let filtered = [...sessions];

    // Apply video filter
    if (videoId) {
      filtered = filtered.filter(session => session.videoId === videoId);
    }

    // Apply tag filters
    if (selectedTags.length > 0) {
      filtered = filtered.filter(session => 
        session.tags && selectedTags.every(tag => session.tags!.includes(tag))
      );
    }

    // Apply search query (now separate from tag filtering)
    if (query) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(session =>
        session.name.toLowerCase().includes(searchTerm) ||
        session.videoTitle.toLowerCase().includes(searchTerm) ||
        (session.description && session.description.toLowerCase().includes(searchTerm)) ||
        session.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    this._filteredSessions.set(filtered);
  }

  // === HISTORY NAVIGATION ===

  /**
   * Load session from history entry
   */
  async loadFromHistory(historyEntry: SessionHistoryEntry): Promise<boolean> {
    try {
      const session = this._sessionList().find(s => s.id === historyEntry.sessionId);
      
      if (!session) {
        console.warn(`Session ${historyEntry.sessionId} not found`);
        return false;
      }

      // Set as current session
      await this.sessionManager.setActiveSession(session.id);
      
      // Restore playback position if available
      if (historyEntry.lastCurrentTime > 0) {
        // This would be handled by the video player component
        // We store the desired position in the current state
        const currentState = this.sessionManager.currentState();
        if (currentState) {
          const updatedState = {
            ...currentState,
            currentTime: historyEntry.lastCurrentTime,
            lastActivity: new Date()
          };
          await this.sessionManager.updateCurrentState(updatedState);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to load from history:', error);
      return false;
    }
  }

  /**
   * Clear session history
   */
  async clearHistory(): Promise<boolean> {
    try {
      const result = await this.sessionManager.clearHistory();
      return result;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  /**
   * Get recent sessions from history
   */
  getRecentSessions(limit: number = 10): SessionHistoryEntry[] {
    return this.sessionManager.getRecentSessions(limit);
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

  // === AUTO-SAVE MANAGEMENT ===

  /**
   * Detect changes in the current session
   */
  private detectSessionChanges(current: LooperSession): void {
    const stored = this._sessionList().find(s => s.id === current.id);
    
    if (!stored) {
      // New session not yet saved
      this._hasUnsavedChanges.set(true);
      return;
    }

    // Compare sessions excluding metadata fields
    const currentCopy = { ...current, updatedAt: stored.updatedAt };
    const hasChanges = JSON.stringify(currentCopy) !== JSON.stringify(stored);
    
    if (hasChanges !== this._hasUnsavedChanges()) {
      this._hasUnsavedChanges.set(hasChanges);
      
      if (hasChanges) {
        this._saveError.set(null); // Clear any previous save errors
        const settings = this.settings();
        if (settings.autoSaveEnabled) {
          this.scheduleAutoSave(settings.autoSaveInterval);
        }
      }
    }
  }

  /**
   * Schedule auto-save after specified interval
   */
  private scheduleAutoSave(interval: number): void {
    this.clearAutoSaveTimer();
    
    this.autoSaveTimer = window.setTimeout(() => {
      if (this._hasUnsavedChanges() && !this._isSaving()) {
        this.performAutoSave();
      }
    }, interval);
  }

  /**
   * Clear the auto-save timer
   */
  private clearAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Perform automatic save
   */
  private async performAutoSave(): Promise<void> {
    if (!this._hasUnsavedChanges() || this._isSaving()) {
      return;
    }

    try {
      const result = await this.saveSession();
      
      // If save failed, schedule retry with exponential backoff
      if (!result.success) {
        this.scheduleAutoSaveRetry();
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      this._saveError.set(error instanceof Error ? error.message : 'Erreur de sauvegarde automatique');
      this.scheduleAutoSaveRetry();
    }
  }

  /**
   * Force manual save (for UI save button)
   */
  async forceSave(): Promise<StorageOperationResult> {
    this.clearAutoSaveTimer();
    return this.saveSession();
  }

  /**
   * Clear save error state
   */
  clearSaveError(): void {
    this._saveError.set(null);
  }

  /**
   * Toggle auto-save setting
   */
  async toggleAutoSave(): Promise<StorageOperationResult> {
    const currentSettings = this.settings();
    return this.updateSettings({ 
      autoSaveEnabled: !currentSettings.autoSaveEnabled 
    });
  }

  /**
   * Update auto-save interval
   */
  async updateAutoSaveInterval(intervalMs: number): Promise<StorageOperationResult> {
    if (intervalMs < 5000) { // Minimum 5 seconds
      return { success: false, error: 'L\'interval minimum est de 5 secondes' };
    }
    
    return this.updateSettings({ 
      autoSaveInterval: intervalMs 
    });
  }

  /**
   * Get auto-save status for debugging
   */
  getAutoSaveInfo() {
    return {
      isEnabled: this.settings().autoSaveEnabled,
      interval: this.settings().autoSaveInterval,
      hasUnsavedChanges: this._hasUnsavedChanges(),
      isSaving: this._isSaving(),
      lastSaveTime: this._lastSaveTime(),
      saveError: this._saveError(),
      hasPendingTimer: !!this.autoSaveTimer,
      retryCount: this.retryCount
    };
  }

  // === CONFLICT RESOLUTION & ERROR RECOVERY ===

  private retryCount = 0;
  private maxRetries = 3;
  private baseRetryDelay = 5000; // 5 seconds

  /**
   * Schedule auto-save retry with exponential backoff
   */
  private scheduleAutoSaveRetry(): void {
    this.retryCount++;
    
    if (this.retryCount > this.maxRetries) {
      console.warn('Max auto-save retries reached, stopping automatic retry attempts');
      return;
    }
    
    const delay = this.baseRetryDelay * Math.pow(2, this.retryCount - 1);
    
    setTimeout(() => {
      if (this._hasUnsavedChanges() && !this._isSaving()) {
        console.log(`Auto-save retry attempt ${this.retryCount}/${this.maxRetries}`);
        this.performAutoSave();
      }
    }, delay);
  }

  /**
   * Reset retry counter (called on successful save or manual intervention)
   */
  private resetRetryCounter(): void {
    this.retryCount = 0;
  }

  /**
   * Check for potential data conflicts
   */
  async checkForConflicts(): Promise<{ hasConflict: boolean; conflictDetails?: string }> {
    const current = this._currentSession();
    if (!current) {
      return { hasConflict: false };
    }

    try {
      // Get fresh copy from storage
      const stored = this._sessionList().find(s => s.id === current.id);
      
      if (!stored) {
        return { hasConflict: false, conflictDetails: 'Session not found in storage' };
      }

      // Check if stored version is newer than our current version
      const storedTime = new Date(stored.updatedAt).getTime();
      const currentTime = new Date(current.updatedAt).getTime();
      
      if (storedTime > currentTime) {
        return { 
          hasConflict: true, 
          conflictDetails: `La session a été modifiée depuis votre dernière sauvegarde (${stored.updatedAt})` 
        };
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Error checking for conflicts:', error);
      return { hasConflict: false, conflictDetails: 'Erreur lors de la vérification des conflits' };
    }
  }

  /**
   * Resolve conflict by choosing which version to keep
   */
  async resolveConflict(resolution: 'keep-current' | 'use-stored' | 'merge'): Promise<StorageOperationResult> {
    const current = this._currentSession();
    if (!current) {
      return { success: false, error: 'Aucune session active' };
    }

    const stored = this._sessionList().find(s => s.id === current.id);
    if (!stored) {
      return { success: false, error: 'Session non trouvée en stockage' };
    }

    try {
      switch (resolution) {
        case 'keep-current':
          // Force save current version
          this._saveError.set(null);
          return await this.forceSave();
          
        case 'use-stored':
          // Reload stored version
          this._currentSession.set(stored);
          this._hasUnsavedChanges.set(false);
          this._lastSaveTime.set(new Date(stored.updatedAt));
          return { success: true, data: 'Version stockée restaurée' };
          
        case 'merge':
          // Simple merge strategy: keep current data but update timestamp
          const mergedSession = {
            ...current,
            updatedAt: new Date(),
            // Merge loops if both versions have different loops
            loops: this.mergeLoops(current.loops, stored.loops)
          };
          
          this._currentSession.set(mergedSession);
          this._saveError.set(null);
          return await this.forceSave();
          
        default:
          return { success: false, error: 'Stratégie de résolution inconnue' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de résolution de conflit';
      return { success: false, error: message };
    }
  }

  /**
   * Simple merge strategy for loops
   */
  private mergeLoops(currentLoops: any[], storedLoops: any[]): any[] {
    // Simple merge: combine unique loops by ID
    const merged = [...currentLoops];
    
    for (const storedLoop of storedLoops) {
      const existsInCurrent = merged.some(loop => loop.id === storedLoop.id);
      if (!existsInCurrent) {
        merged.push(storedLoop);
      }
    }
    
    return merged;
  }

  /**
   * Recover from save error by attempting different recovery strategies
   */
  async recoverFromError(): Promise<StorageOperationResult> {
    // Clear error state
    this._saveError.set(null);
    
    try {
      // Strategy 1: Check for conflicts and resolve
      const conflictCheck = await this.checkForConflicts();
      if (conflictCheck.hasConflict) {
        // Auto-resolve by merging (safest option)
        return await this.resolveConflict('merge');
      }
      
      // Strategy 2: Simple retry
      this.resetRetryCounter();
      return await this.forceSave();
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de récupération';
      this._saveError.set(message);
      return { success: false, error: message };
    }
  }

  /**
   * Create backup of current session before risky operations
   */
  createBackup(): { timestamp: Date; session: LooperSession } | null {
    const current = this._currentSession();
    if (!current) return null;
    
    return {
      timestamp: new Date(),
      session: { ...current }
    };
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backup: { timestamp: Date; session: LooperSession }): void {
    this._currentSession.set(backup.session);
    this._hasUnsavedChanges.set(true);
    this._saveError.set(null);
  }
}