import { Injectable } from '@angular/core';
import { VideoSession, AppSettings, DEFAULT_APP_SETTINGS } from './storage.types';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_SINGLE_ITEM_SIZE = 1024 * 1024; // 1MB per item
  
  // Storage keys
  private readonly SESSIONS_STORAGE_KEY = 'ng-youtube-looper-sessions';
  private readonly SETTINGS_STORAGE_KEY = 'ng-youtube-looper-settings';
  // private readonly HISTORY_STORAGE_KEY = 'ng-youtube-looper-history'; // For future tasks

  /**
   * Validate if localStorage is available and functional
   */
  private validateStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
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
        throw new Error('Invalid JSON string');
      }
      
      // Check for potential malicious content
      if (jsonString.includes('<script') || jsonString.includes('javascript:')) {
        throw new Error('Potentially malicious content detected');
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Deserialization error:', error);
      throw new Error('Failed to deserialize data');
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
        console.error('localStorage is not available');
        return false;
      }

      const sanitizedData = this.sanitizeData(data);
      
      if (!this.validateSizeLimit(sanitizedData)) {
        return false;
      }

      const serialized = this.serializeData(sanitizedData);
      localStorage.setItem(key, serialized);
      
      return true;
    } catch (error) {
      console.error('Storage save error:', error);
      return false;
    }
  }

  /**
   * Generic method to load data with fallback
   */
  loadData<T>(key: string, defaultValue: T): T {
    try {
      if (!this.validateStorageAvailable()) {
        console.warn('localStorage is not available, returning default value');
        return defaultValue;
      }

      const item = localStorage.getItem(key);
      if (!item) {
        return defaultValue;
      }

      const parsed = this.deserializeData<T>(item);
      return this.sanitizeData(parsed);
    } catch (error) {
      console.error('Storage load error:', error);
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
    } catch {
      return false;
    }
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
}