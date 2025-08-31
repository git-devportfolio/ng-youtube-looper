// Types and interfaces for storage operations

export interface VideoSession {
  id: string;
  videoId: string;
  videoTitle: string | undefined;
  videoUrl: string;
  loops: SessionLoop[];
  playbackSpeed: number;
  currentTime: number;
  lastPlayed: Date;
  totalPlayTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionLoop {
  id: string;
  name: string | undefined;
  startTime: number;
  endTime: number;
  color: string | undefined;
  playCount: number;
  isActive: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  defaultPlaybackSpeed: number;
  autoSaveInterval: number;
  maxHistoryEntries: number;
  enableKeyboardShortcuts: boolean;
  showLoopLabels: boolean;
  loopColors: string[];
  language: string;
  enableNotifications: boolean;
  autoPlayNext: boolean;
}

export interface HistoryEntry {
  id: string;
  videoId: string;
  videoTitle: string | undefined;
  videoUrl: string;
  thumbnailUrl: string | undefined;
  lastWatched: Date;
  watchDuration: number;
  loopCount: number;
  playbackSpeed: number;
  tags: string[] | undefined;
}

export interface StorageErrorInterface extends Error {
  code: 'QUOTA_EXCEEDED' | 'ACCESS_DENIED' | 'CORRUPTED_DATA' | 'SERIALIZATION_ERROR' | 'STORAGE_UNAVAILABLE';
  originalError?: Error;
}

export class StorageError extends Error implements StorageErrorInterface {
  public code: 'QUOTA_EXCEEDED' | 'ACCESS_DENIED' | 'CORRUPTED_DATA' | 'SERIALIZATION_ERROR' | 'STORAGE_UNAVAILABLE';
  public originalError?: Error;

  constructor(
    message: string,
    code: 'QUOTA_EXCEEDED' | 'ACCESS_DENIED' | 'CORRUPTED_DATA' | 'SERIALIZATION_ERROR' | 'STORAGE_UNAVAILABLE',
    originalError?: Error
  ) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    if (originalError) {
      this.originalError = originalError;
    }
    
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, StorageError.prototype);
  }

  override toString(): string {
    const originalMessage = this.originalError ? ` (Original: ${this.originalError.message})` : '';
    return `StorageError [${this.code}]: ${this.message}${originalMessage}`;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

export interface StorageInfo {
  available: boolean;
  currentSize: number;
  maxSize: number;
  utilizationPercentage: number;
  remainingSize: number;
}

// Default values
export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'auto',
  defaultPlaybackSpeed: 1.0,
  autoSaveInterval: 30000, // 30 seconds
  maxHistoryEntries: 100,
  enableKeyboardShortcuts: true,
  showLoopLabels: true,
  loopColors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
  language: 'fr',
  enableNotifications: true,
  autoPlayNext: false
};