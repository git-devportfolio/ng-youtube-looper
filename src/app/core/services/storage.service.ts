import { Injectable } from '@angular/core';
import { VideoSession, AppSettings, DEFAULT_APP_SETTINGS, HistoryEntry, StorageError } from './storage.types';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_SINGLE_ITEM_SIZE = 1024 * 1024; // 1MB per item
  private readonly MAX_HISTORY_ENTRIES = 100; // Maximum history entries
  
  // Storage keys
  private readonly SESSIONS_STORAGE_KEY = 'ng-youtube-looper-sessions';
  private readonly SETTINGS_STORAGE_KEY = 'ng-youtube-looper-settings';
  private readonly HISTORY_STORAGE_KEY = 'ng-youtube-looper-history';

  /**
   * Validate if localStorage is available and functional
   */
  private validateStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      this.handleStorageError('STORAGE_UNAVAILABLE', 'localStorage is not available or accessible', error as Error);
      return false;
    }
  }

  /**
   * Create and handle a typed storage error
   */
  private handleStorageError(
    code: 'QUOTA_EXCEEDED' | 'ACCESS_DENIED' | 'CORRUPTED_DATA' | 'SERIALIZATION_ERROR' | 'STORAGE_UNAVAILABLE',
    message: string,
    originalError?: Error
  ): StorageError {
    const storageError = new StorageError(message, code, originalError);
    console.error(storageError.toString());
    return storageError;
  }

  /**
   * Check if error is storage quota exceeded
   */
  private isQuotaExceededError(error: Error): boolean {
    return error.name === 'QuotaExceededError' ||
           error.message.includes('quota') ||
           error.message.includes('storage') ||
           (error as any).code === 22 ||
           (error as any).code === 1014;
  }

  /**
   * Calculate current localStorage usage in bytes
   */
  private calculateStorageSize(): number {
    let totalSize = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          if (value) {
            // Add key length + value length + some overhead
            totalSize += key.length + value.length + 4;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating storage size:', error);
    }
    return totalSize;
  }

  /**
   * Validate if data size is within limits
   */
  private validateSizeLimit(data: unknown, maxSize: number = this.MAX_SINGLE_ITEM_SIZE): boolean {
    try {
      const serializedSize = JSON.stringify(data).length;
      const currentSize = this.calculateStorageSize();
      
      if (serializedSize > maxSize) {
        console.warn(`Data size (${serializedSize} bytes) exceeds single item limit (${maxSize} bytes)`);
        return false;
      }
      
      if (currentSize + serializedSize > this.MAX_STORAGE_SIZE) {
        console.warn(`Total storage would exceed limit: ${currentSize + serializedSize} > ${this.MAX_STORAGE_SIZE}`);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Securely serialize data to JSON string
   */
  private serializeData(data: unknown): string {
    try {
      return JSON.stringify(data, (_key, value) => {
        // Filter out functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          return null;
        }
        // Prevent potential XSS by sanitizing strings
        if (typeof value === 'string') {
          return value.replace(/<script[^>]*>.*?<\/script>/gi, '');
        }
        return value;
      });
    } catch (error) {
      console.error('Serialization error:', error);
      throw new Error('Failed to serialize data');
    }
  }

  /**
   * Securely deserialize JSON string to object
   */
  private deserializeData<T>(jsonString: string): T {
    try {
      // Basic JSON validation before parsing
      if (!jsonString || typeof jsonString !== 'string') {
        throw new StorageError('Invalid JSON string provided', 'CORRUPTED_DATA');
      }
      
      // Check for potential malicious content
      if (jsonString.includes('<script') || jsonString.includes('javascript:')) {
        throw new StorageError('Potentially malicious content detected in stored data', 'CORRUPTED_DATA');
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('Failed to deserialize stored data', 'SERIALIZATION_ERROR', error as Error);
    }
  }

  /**
   * Sanitize data by removing potentially harmful properties
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip function properties and potentially dangerous keys
        if (typeof value === 'function' || 
            key.startsWith('__') || 
            key.includes('script') || 
            key.includes('eval')) {
          continue;
        }
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    // For primitive values, just return them
    return data;
  }

  /**
   * Generic method to save data with security checks
   */
  saveData<T>(key: string, data: T): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        return false;
      }

      const sanitizedData = this.sanitizeData(data);
      
      if (!this.validateSizeLimit(sanitizedData)) {
        this.handleStorageError('QUOTA_EXCEEDED', 'Data exceeds storage size limits');
        return false;
      }

      const serialized = this.serializeData(sanitizedData);
      localStorage.setItem(key, serialized);
      
      return true;
    } catch (error) {
      const err = error as Error;
      if (this.isQuotaExceededError(err)) {
        this.handleStorageError('QUOTA_EXCEEDED', 'Storage quota exceeded', err);
      } else {
        this.handleStorageError('ACCESS_DENIED', 'Failed to save data to localStorage', err);
      }
      return false;
    }
  }

  /**
   * Generic method to load data with fallback
   */
  loadData<T>(key: string, defaultValue: T): T {
    try {
      if (!this.validateStorageAvailable()) {
        return defaultValue;
      }

      const item = localStorage.getItem(key);
      if (!item) {
        return defaultValue;
      }

      const parsed = this.deserializeData<T>(item);
      return this.sanitizeData(parsed);
    } catch (error) {
      const err = error as Error;
      this.handleStorageError('CORRUPTED_DATA', 'Failed to load data from localStorage', err);
      return defaultValue;
    }
  }

  /**
   * Remove data from localStorage
   */
  removeData(key: string): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        return false;
      }
      
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage removal error:', error);
      return false;
    }
  }

  /**
   * Clear all data from localStorage
   */
  clearAll(): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        return false;
      }
      
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * Get current storage size in bytes
   */
  getStorageSize(): number {
    return this.calculateStorageSize();
  }

  /**
   * Get storage information for monitoring
   */
  getStorageInfo() {
    const currentSize = this.calculateStorageSize();
    const isAvailable = this.validateStorageAvailable();
    
    return {
      available: isAvailable,
      currentSize,
      maxSize: this.MAX_STORAGE_SIZE,
      utilizationPercentage: (currentSize / this.MAX_STORAGE_SIZE) * 100,
      remainingSize: this.MAX_STORAGE_SIZE - currentSize
    };
  }

  /**
   * Check if storage is healthy and functional
   */
  isStorageHealthy(): boolean {
    try {
      const info = this.getStorageInfo();
      return info.available && 
             info.utilizationPercentage < 90 && 
             info.remainingSize > 50000; // At least 50KB remaining
    } catch (error) {
      this.handleStorageError('STORAGE_UNAVAILABLE', 'Unable to determine storage health', error as Error);
      return false;
    }
  }

  /**
   * Perform comprehensive storage diagnostics
   */
  performStorageDiagnostics(): {
    isHealthy: boolean;
    info: {
      available: boolean;
      currentSize: number;
      maxSize: number;
      utilizationPercentage: number;
      remainingSize: number;
    };
    errors: StorageError[];
    recommendations: string[];
  } {
    const errors: StorageError[] = [];
    const recommendations: string[] = [];
    
    // Check basic availability
    const info = this.getStorageInfo();
    
    if (!info.available) {
      errors.push(new StorageError('localStorage is not available', 'STORAGE_UNAVAILABLE'));
      recommendations.push('Enable localStorage in browser settings');
    }

    // Check storage utilization
    if (info.utilizationPercentage > 90) {
      errors.push(new StorageError('Storage usage is critically high', 'QUOTA_EXCEEDED'));
      recommendations.push('Clear old data or increase storage limits');
    } else if (info.utilizationPercentage > 75) {
      recommendations.push('Consider cleaning up old history entries');
    }

    // Check remaining space
    if (info.remainingSize < 50000) { // Less than 50KB
      errors.push(new StorageError('Very little storage space remaining', 'QUOTA_EXCEEDED'));
      recommendations.push('Free up storage space immediately');
    } else if (info.remainingSize < 500000) { // Less than 500KB
      recommendations.push('Monitor storage usage closely');
    }

    // Test read/write functionality
    try {
      const testKey = '__diagnostics_test__';
      const testData = { timestamp: Date.now(), test: true };
      this.saveData(testKey, testData);
      const loaded = this.loadData<{ timestamp: number; test: boolean } | null>(testKey, null);
      this.removeData(testKey);
      
      if (!loaded || loaded.timestamp !== testData.timestamp) {
        errors.push(new StorageError('Storage read/write functionality is impaired', 'CORRUPTED_DATA'));
        recommendations.push('Clear browser cache and restart browser');
      }
    } catch (error) {
      errors.push(new StorageError('Storage functionality test failed', 'ACCESS_DENIED', error as Error));
      recommendations.push('Check browser permissions and privacy settings');
    }

    const isHealthy = errors.length === 0 && info.available && info.utilizationPercentage < 90;

    return {
      isHealthy,
      info,
      errors,
      recommendations
    };
  }

  /**
   * Attempt to recover storage by cleaning up corrupted data
   */
  attemptStorageRecovery(): {
    success: boolean;
    clearedKeys: string[];
    errors: StorageError[];
  } {
    const clearedKeys: string[] = [];
    const errors: StorageError[] = [];

    try {
      // Try to identify and remove corrupted data
      const keysToCheck = [
        this.SESSIONS_STORAGE_KEY,
        this.SETTINGS_STORAGE_KEY,
        this.HISTORY_STORAGE_KEY
      ];

      for (const key of keysToCheck) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            // Try to parse the data
            JSON.parse(item);
            // If successful, validate structure
            this.deserializeData(item);
          }
        } catch (error) {
          // If parsing fails, remove the corrupted data
          try {
            localStorage.removeItem(key);
            clearedKeys.push(key);
          } catch (removeError) {
            errors.push(new StorageError(`Failed to remove corrupted data for key: ${key}`, 'ACCESS_DENIED', removeError as Error));
          }
        }
      }

      return {
        success: errors.length === 0,
        clearedKeys,
        errors
      };
    } catch (error) {
      errors.push(new StorageError('Storage recovery process failed', 'STORAGE_UNAVAILABLE', error as Error));
      return {
        success: false,
        clearedKeys,
        errors
      };
    }
  }

  /**
   * Get detailed storage metrics for monitoring
   */
  getDetailedStorageMetrics(): {
    totalSize: number;
    byCategory: {
      sessions: { size: number; count: number };
      settings: { size: number };
      history: { size: number; count: number };
      other: { size: number; keys: string[] };
    };
    utilizationByCategory: {
      sessions: number;
      settings: number;
      history: number;
      other: number;
    };
  } {
    const metrics = {
      totalSize: 0,
      byCategory: {
        sessions: { size: 0, count: 0 },
        settings: { size: 0 },
        history: { size: 0, count: 0 },
        other: { size: 0, keys: [] as string[] }
      },
      utilizationByCategory: {
        sessions: 0,
        settings: 0,
        history: 0,
        other: 0
      }
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const item = localStorage.getItem(key);
        if (!item) continue;

        const size = key.length + item.length + 4; // Approximate overhead
        metrics.totalSize += size;

        if (key === this.SESSIONS_STORAGE_KEY) {
          metrics.byCategory.sessions.size = size;
          try {
            const sessions = JSON.parse(item);
            metrics.byCategory.sessions.count = Array.isArray(sessions) ? sessions.length : 0;
          } catch {
            // Ignore parsing errors for metrics
          }
        } else if (key === this.SETTINGS_STORAGE_KEY) {
          metrics.byCategory.settings.size = size;
        } else if (key === this.HISTORY_STORAGE_KEY) {
          metrics.byCategory.history.size = size;
          try {
            const history = JSON.parse(item);
            metrics.byCategory.history.count = Array.isArray(history) ? history.length : 0;
          } catch {
            // Ignore parsing errors for metrics
          }
        } else {
          metrics.byCategory.other.size += size;
          metrics.byCategory.other.keys.push(key);
        }
      }

      // Calculate utilization percentages
      if (metrics.totalSize > 0) {
        metrics.utilizationByCategory.sessions = (metrics.byCategory.sessions.size / metrics.totalSize) * 100;
        metrics.utilizationByCategory.settings = (metrics.byCategory.settings.size / metrics.totalSize) * 100;
        metrics.utilizationByCategory.history = (metrics.byCategory.history.size / metrics.totalSize) * 100;
        metrics.utilizationByCategory.other = (metrics.byCategory.other.size / metrics.totalSize) * 100;
      }

    } catch (error) {
      this.handleStorageError('STORAGE_UNAVAILABLE', 'Failed to calculate storage metrics', error as Error);
    }

    return metrics;
  }

  // === VIDEO SESSIONS MANAGEMENT ===

  /**
   * Save video sessions to localStorage
   */
  saveSessions(sessions: VideoSession[]): boolean {
    try {
      if (!Array.isArray(sessions)) {
        console.error('Sessions must be an array');
        return false;
      }

      // Validate and sanitize sessions data
      const validSessions = this.validateAndSanitizeSessions(sessions);
      
      if (validSessions.length === 0 && sessions.length > 0) {
        console.warn('No valid sessions to save after validation');
        return false;
      }

      // Update timestamps
      const sessionsWithTimestamp = validSessions.map(session => ({
        ...session,
        updatedAt: new Date()
      }));

      const success = this.saveData(this.SESSIONS_STORAGE_KEY, sessionsWithTimestamp);
      
      if (success) {
        console.log(`Successfully saved ${sessionsWithTimestamp.length} video sessions`);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to save sessions:', error);
      return false;
    }
  }

  /**
   * Load video sessions from localStorage
   */
  loadSessions(): VideoSession[] {
    try {
      const sessions = this.loadData<VideoSession[]>(this.SESSIONS_STORAGE_KEY, []);
      
      if (!Array.isArray(sessions)) {
        console.warn('Loaded sessions data is not an array, returning empty array');
        return [];
      }

      // Validate and sanitize loaded sessions
      const validSessions = this.validateAndSanitizeSessions(sessions);
      
      console.log(`Successfully loaded ${validSessions.length} video sessions`);
      return validSessions;
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Clear all video sessions from localStorage
   */
  clearSessions(): boolean {
    try {
      const success = this.removeData(this.SESSIONS_STORAGE_KEY);
      
      if (success) {
        console.log('Successfully cleared all video sessions');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      return false;
    }
  }

  /**
   * Add or update a single video session
   */
  saveSession(session: VideoSession): boolean {
    try {
      if (!this.isValidSession(session)) {
        console.error('Invalid session data provided');
        return false;
      }

      const sessions = this.loadSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      const sessionWithTimestamp = {
        ...session,
        updatedAt: new Date()
      };

      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex] = sessionWithTimestamp;
      } else {
        // Add new session
        sessions.push(sessionWithTimestamp);
      }

      return this.saveSessions(sessions);
    } catch (error) {
      console.error('Failed to save single session:', error);
      return false;
    }
  }

  /**
   * Get a specific session by ID
   */
  getSession(sessionId: string): VideoSession | null {
    try {
      const sessions = this.loadSessions();
      const session = sessions.find(s => s.id === sessionId);
      return session || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Delete a specific session by ID
   */
  deleteSession(sessionId: string): boolean {
    try {
      const sessions = this.loadSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (filteredSessions.length === sessions.length) {
        console.warn(`Session with ID ${sessionId} not found`);
        return false;
      }

      return this.saveSessions(filteredSessions);
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  /**
   * Get sessions for a specific video
   */
  getVideoSessions(videoId: string): VideoSession[] {
    try {
      const sessions = this.loadSessions();
      return sessions.filter(s => s.videoId === videoId);
    } catch (error) {
      console.error('Failed to get video sessions:', error);
      return [];
    }
  }

  // === USER SETTINGS MANAGEMENT ===

  /**
   * Save application settings to localStorage
   */
  saveSettings(settings: AppSettings): boolean {
    try {
      if (!this.isValidSettings(settings)) {
        console.error('Invalid settings data provided');
        return false;
      }

      // Sanitize and validate settings
      const sanitizedSettings = this.sanitizeSettings(settings);
      
      const success = this.saveData(this.SETTINGS_STORAGE_KEY, sanitizedSettings);
      
      if (success) {
        console.log('Successfully saved application settings');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Load application settings from localStorage
   */
  loadSettings(): AppSettings {
    try {
      const settings = this.loadData<AppSettings>(this.SETTINGS_STORAGE_KEY, DEFAULT_APP_SETTINGS);
      
      // Validate loaded settings and merge with defaults for any missing properties
      const validatedSettings = this.mergeWithDefaults(settings);
      
      console.log('Successfully loaded application settings');
      return validatedSettings;
    } catch (error) {
      console.error('Failed to load settings, returning defaults:', error);
      return { ...DEFAULT_APP_SETTINGS };
    }
  }

  /**
   * Reset application settings to defaults
   */
  resetSettings(): boolean {
    try {
      const success = this.saveSettings(DEFAULT_APP_SETTINGS);
      
      if (success) {
        console.log('Successfully reset settings to defaults');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return false;
    }
  }

  /**
   * Update specific setting value
   */
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): boolean {
    try {
      const currentSettings = this.loadSettings();
      const updatedSettings = { ...currentSettings, [key]: value };
      
      return this.saveSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to update setting:', error);
      return false;
    }
  }

  /**
   * Get specific setting value
   */
  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    try {
      const settings = this.loadSettings();
      return settings[key];
    } catch (error) {
      console.error('Failed to get setting, returning default:', error);
      return DEFAULT_APP_SETTINGS[key];
    }
  }

  // === READING HISTORY MANAGEMENT ===

  /**
   * Add an entry to the reading history
   */
  addToHistory(videoData: HistoryEntry): boolean {
    try {
      if (!this.isValidHistoryEntry(videoData)) {
        console.error('Invalid history entry data provided');
        return false;
      }

      const history = this.getHistory();
      const sanitizedEntry = this.sanitizeHistoryEntry(videoData);
      
      // Remove existing entry for the same video to avoid duplicates
      const filteredHistory = history.filter(entry => entry.videoId !== sanitizedEntry.videoId);
      
      // Add new entry at the beginning
      filteredHistory.unshift(sanitizedEntry);
      
      // Keep only the most recent entries within limit
      const limitedHistory = filteredHistory.slice(0, this.MAX_HISTORY_ENTRIES);
      
      const success = this.saveData(this.HISTORY_STORAGE_KEY, limitedHistory);
      
      if (success) {
        console.log(`Successfully added video ${sanitizedEntry.videoId} to history`);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to add to history:', error);
      return false;
    }
  }

  /**
   * Get the complete reading history
   */
  getHistory(): HistoryEntry[] {
    try {
      const history = this.loadData<HistoryEntry[]>(this.HISTORY_STORAGE_KEY, []);
      
      if (!Array.isArray(history)) {
        console.warn('Loaded history data is not an array, returning empty array');
        return [];
      }

      // Validate and sanitize loaded history entries
      const validHistory = this.validateAndSanitizeHistory(history);
      
      console.log(`Successfully loaded ${validHistory.length} history entries`);
      return validHistory;
    } catch (error) {
      console.error('Failed to load history:', error);
      return [];
    }
  }

  /**
   * Clear all reading history
   */
  clearHistory(): boolean {
    try {
      const success = this.removeData(this.HISTORY_STORAGE_KEY);
      
      if (success) {
        console.log('Successfully cleared reading history');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  /**
   * Remove a specific video from history
   */
  removeFromHistory(videoId: string): boolean {
    try {
      if (!videoId || typeof videoId !== 'string') {
        console.error('Invalid videoId provided for history removal');
        return false;
      }

      const history = this.getHistory();
      const filteredHistory = history.filter(entry => entry.videoId !== videoId);
      
      if (filteredHistory.length === history.length) {
        console.warn(`Video ${videoId} not found in history`);
        return false;
      }

      const success = this.saveData(this.HISTORY_STORAGE_KEY, filteredHistory);
      
      if (success) {
        console.log(`Successfully removed video ${videoId} from history`);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to remove from history:', error);
      return false;
    }
  }

  /**
   * Get history entries for a specific time period
   */
  getHistoryByDateRange(startDate: Date, endDate: Date): HistoryEntry[] {
    try {
      const history = this.getHistory();
      return history.filter(entry => {
        const watchedDate = new Date(entry.lastWatched);
        return watchedDate >= startDate && watchedDate <= endDate;
      });
    } catch (error) {
      console.error('Failed to get history by date range:', error);
      return [];
    }
  }

  /**
   * Get recently watched videos (last N entries)
   */
  getRecentHistory(limit: number = 10): HistoryEntry[] {
    try {
      const history = this.getHistory();
      return history.slice(0, Math.min(limit, history.length));
    } catch (error) {
      console.error('Failed to get recent history:', error);
      return [];
    }
  }

  /**
   * Search history by video title or tags
   */
  searchHistory(query: string): HistoryEntry[] {
    try {
      if (!query || typeof query !== 'string') {
        return [];
      }

      const history = this.getHistory();
      const searchTerm = query.toLowerCase().trim();
      
      return history.filter(entry => {
        const titleMatch = entry.videoTitle?.toLowerCase().includes(searchTerm);
        const tagMatch = entry.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
        return titleMatch || tagMatch;
      });
    } catch (error) {
      console.error('Failed to search history:', error);
      return [];
    }
  }

  // === PRIVATE VALIDATION METHODS ===

  /**
   * Validate and sanitize an array of video sessions
   */
  private validateAndSanitizeSessions(sessions: VideoSession[]): VideoSession[] {
    return sessions
      .filter(session => this.isValidSession(session))
      .map(session => this.sanitizeSession(session));
  }

  /**
   * Check if a session object is valid
   */
  private isValidSession(session: any): session is VideoSession {
    return session &&
           typeof session === 'object' &&
           typeof session.id === 'string' &&
           session.id.length > 0 &&
           typeof session.videoId === 'string' &&
           session.videoId.length > 0 &&
           typeof session.videoUrl === 'string' &&
           session.videoUrl.length > 0 &&
           Array.isArray(session.loops) &&
           typeof session.playbackSpeed === 'number' &&
           session.playbackSpeed > 0 &&
           typeof session.currentTime === 'number' &&
           session.currentTime >= 0 &&
           (session.lastPlayed instanceof Date || typeof session.lastPlayed === 'string') &&
           typeof session.totalPlayTime === 'number' &&
           session.totalPlayTime >= 0 &&
           (session.createdAt instanceof Date || typeof session.createdAt === 'string');
  }

  /**
   * Sanitize a session object
   */
  private sanitizeSession(session: VideoSession): VideoSession {
    return {
      id: String(session.id).trim(),
      videoId: String(session.videoId).trim(),
      videoTitle: session.videoTitle ? String(session.videoTitle).trim() : undefined,
      videoUrl: String(session.videoUrl).trim(),
      loops: Array.isArray(session.loops) ? session.loops.filter(loop => this.isValidLoop(loop)) : [],
      playbackSpeed: Math.max(0.25, Math.min(3.0, Number(session.playbackSpeed) || 1.0)),
      currentTime: Math.max(0, Number(session.currentTime) || 0),
      lastPlayed: new Date(session.lastPlayed),
      totalPlayTime: Math.max(0, Number(session.totalPlayTime) || 0),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date()
    };
  }

  /**
   * Check if a loop object is valid
   */
  private isValidLoop(loop: any): boolean {
    return loop &&
           typeof loop === 'object' &&
           typeof loop.id === 'string' &&
           loop.id.length > 0 &&
           typeof loop.startTime === 'number' &&
           loop.startTime >= 0 &&
           typeof loop.endTime === 'number' &&
           loop.endTime > loop.startTime &&
           typeof loop.playCount === 'number' &&
           loop.playCount >= 0 &&
           typeof loop.isActive === 'boolean';
  }

  /**
   * Check if settings object is valid
   */
  private isValidSettings(settings: any): settings is AppSettings {
    return settings &&
           typeof settings === 'object' &&
           ['light', 'dark', 'auto'].includes(settings.theme) &&
           typeof settings.defaultPlaybackSpeed === 'number' &&
           settings.defaultPlaybackSpeed >= 0.25 &&
           settings.defaultPlaybackSpeed <= 3.0 &&
           typeof settings.autoSaveInterval === 'number' &&
           settings.autoSaveInterval >= 5000 && // Minimum 5 seconds
           typeof settings.maxHistoryEntries === 'number' &&
           settings.maxHistoryEntries >= 10 &&
           settings.maxHistoryEntries <= 1000 &&
           typeof settings.enableKeyboardShortcuts === 'boolean' &&
           typeof settings.showLoopLabels === 'boolean' &&
           Array.isArray(settings.loopColors) &&
           settings.loopColors.every((color: any) => typeof color === 'string' && this.isValidHexColor(color)) &&
           typeof settings.language === 'string' &&
           settings.language.length >= 2 &&
           typeof settings.enableNotifications === 'boolean' &&
           typeof settings.autoPlayNext === 'boolean';
  }

  /**
   * Sanitize and validate settings object
   */
  private sanitizeSettings(settings: AppSettings): AppSettings {
    return {
      theme: ['light', 'dark', 'auto'].includes(settings.theme) ? settings.theme : DEFAULT_APP_SETTINGS.theme,
      defaultPlaybackSpeed: Math.max(0.25, Math.min(3.0, Number(settings.defaultPlaybackSpeed) || DEFAULT_APP_SETTINGS.defaultPlaybackSpeed)),
      autoSaveInterval: Math.max(5000, Math.min(300000, Number(settings.autoSaveInterval) || DEFAULT_APP_SETTINGS.autoSaveInterval)), // 5s to 5min
      maxHistoryEntries: Math.max(10, Math.min(1000, Number(settings.maxHistoryEntries) || DEFAULT_APP_SETTINGS.maxHistoryEntries)),
      enableKeyboardShortcuts: Boolean(settings.enableKeyboardShortcuts),
      showLoopLabels: Boolean(settings.showLoopLabels),
      loopColors: Array.isArray(settings.loopColors) ? 
        settings.loopColors.filter(color => this.isValidHexColor(color)).slice(0, 20) : // Max 20 colors
        DEFAULT_APP_SETTINGS.loopColors,
      language: (typeof settings.language === 'string' && settings.language.length >= 2) ? 
        String(settings.language).toLowerCase().trim() : 
        DEFAULT_APP_SETTINGS.language,
      enableNotifications: Boolean(settings.enableNotifications),
      autoPlayNext: Boolean(settings.autoPlayNext)
    };
  }

  /**
   * Merge loaded settings with defaults for missing properties
   */
  private mergeWithDefaults(settings: Partial<AppSettings>): AppSettings {
    const merged = { ...DEFAULT_APP_SETTINGS, ...settings };
    return this.sanitizeSettings(merged);
  }

  /**
   * Validate if a string is a valid hex color
   */
  private isValidHexColor(color: string): boolean {
    if (typeof color !== 'string') return false;
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  }

  /**
   * Validate and sanitize an array of history entries
   */
  private validateAndSanitizeHistory(history: HistoryEntry[]): HistoryEntry[] {
    return history
      .filter(entry => this.isValidHistoryEntry(entry))
      .map(entry => this.sanitizeHistoryEntry(entry))
      .sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime()); // Sort by most recent first
  }

  /**
   * Check if a history entry object is valid
   */
  private isValidHistoryEntry(entry: any): entry is HistoryEntry {
    return entry &&
           typeof entry === 'object' &&
           typeof entry.id === 'string' &&
           entry.id.length > 0 &&
           typeof entry.videoId === 'string' &&
           entry.videoId.length > 0 &&
           typeof entry.videoUrl === 'string' &&
           entry.videoUrl.length > 0 &&
           (entry.lastWatched instanceof Date || typeof entry.lastWatched === 'string') &&
           typeof entry.watchDuration === 'number' &&
           entry.watchDuration >= 0 &&
           typeof entry.loopCount === 'number' &&
           entry.loopCount >= 0 &&
           typeof entry.playbackSpeed === 'number' &&
           entry.playbackSpeed > 0 &&
           (entry.tags === undefined || Array.isArray(entry.tags));
  }

  /**
   * Sanitize a history entry object
   */
  private sanitizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
    return {
      id: String(entry.id).trim(),
      videoId: String(entry.videoId).trim(),
      videoTitle: entry.videoTitle ? String(entry.videoTitle).trim() : undefined,
      videoUrl: String(entry.videoUrl).trim(),
      thumbnailUrl: entry.thumbnailUrl ? String(entry.thumbnailUrl).trim() : undefined,
      lastWatched: new Date(entry.lastWatched),
      watchDuration: Math.max(0, Number(entry.watchDuration) || 0),
      loopCount: Math.max(0, Number(entry.loopCount) || 0),
      playbackSpeed: Math.max(0.25, Math.min(3.0, Number(entry.playbackSpeed) || 1.0)),
      tags: Array.isArray(entry.tags) ? 
        entry.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0)
                 .map(tag => String(tag).trim())
                 .slice(0, 10) : // Limit to 10 tags max
        undefined
    };
  }
}