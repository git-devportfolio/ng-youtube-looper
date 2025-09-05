import { LoopSegment } from '@shared/interfaces';

// Interface principale pour une session de boucles YouTube
export interface LooperSession {
  id: string;
  name: string;
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  videoDuration: number;
  loops: LoopSegment[];
  globalPlaybackSpeed: number;
  currentTime: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastPlayed?: Date;
  totalPlayTime: number;
  playCount: number;
  tags?: string[];
  description?: string;
}

// Configuration spécifique pour les sessions
export interface SessionSettings {
  defaultSessionName: string;
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // en millisecondes
  maxSessionsPerVideo: number;
  enableSessionCompression: boolean;
  sessionHistoryLimit: number;
  enableSessionBackup: boolean;
  backupInterval: number; // en millisecondes
  defaultLoopDuration: number; // en secondes
  enableSessionSharing: boolean;
}

// État actuel de l'application
export interface CurrentState {
  activeSessionId: string | null;
  currentVideoId: string | null;
  currentTime: number;
  playbackSpeed: number;
  isPlaying: boolean;
  activeLoopId: string | null;
  lastActivity: Date;
}

// Historique des sessions
export interface SessionHistoryEntry {
  sessionId: string;
  sessionName: string;
  videoId: string;
  videoTitle: string;
  accessedAt: Date;
  duration: number; // temps passé dans la session
  loopsCount: number;
  lastCurrentTime: number;
}

// Métadonnées de session pour l'indexation
export interface SessionMetadata {
  id: string;
  name: string;
  videoId: string;
  videoTitle: string;
  loopCount: number;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  tags: string[];
  isStarred?: boolean;
}

// Données compressées pour le stockage
export interface CompressedSessionData {
  version: string;
  compressed: boolean;
  data: string; // JSON stringifié ou compressé
  checksum?: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    timestamp: Date;
  };
}

// Configuration de stockage spécifique au looper
export interface LooperStorageConfig {
  keyPrefix: string; // "yl_" pour YouTube Looper
  enableCompression: boolean;
  compressionThreshold: number; // taille en bytes avant compression
  maxSessionSize: number;
  maxTotalStorage: number;
  enableBackup: boolean;
  enableDataValidation: boolean;
  enableChecksum: boolean;
}

// Résultat d'opération de stockage
export interface StorageOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    operation: string;
    key?: string;
    size?: number;
    timestamp: Date;
    // Propriétés supplémentaires pour les opérations spécifiques
    originalSize?: number;
    cached?: boolean;
    compressed?: boolean;
    page?: number;
    query?: string;
    videoId?: string;
    [key: string]: any; // Pour permettre d'autres propriétés dynamiques
  };
}

// Valeurs par défaut
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  defaultSessionName: 'Session pratique',
  autoSaveEnabled: true,
  autoSaveInterval: 30000, // 30 secondes
  maxSessionsPerVideo: 20,
  enableSessionCompression: true,
  sessionHistoryLimit: 50,
  enableSessionBackup: true,
  backupInterval: 300000, // 5 minutes
  defaultLoopDuration: 30, // 30 secondes
  enableSessionSharing: false
};

export const DEFAULT_LOOPER_STORAGE_CONFIG: LooperStorageConfig = {
  keyPrefix: 'yl_',
  enableCompression: true,
  compressionThreshold: 10000, // 10KB
  maxSessionSize: 1024 * 1024, // 1MB par session
  maxTotalStorage: 5 * 1024 * 1024, // 5MB total
  enableBackup: true,
  enableDataValidation: true,
  enableChecksum: false
};

// Clés de stockage standardisées
export const LOOPER_STORAGE_KEYS = {
  SESSIONS: 'yl_sessions',
  CURRENT: 'yl_current', 
  SETTINGS: 'yl_settings',
  HISTORY: 'yl_history',
  METADATA: 'yl_metadata',
  BACKUP: 'yl_backup'
} as const;

// Type pour les clés de stockage
export type LooperStorageKey = keyof typeof LOOPER_STORAGE_KEYS;
export type LooperStorageKeyValue = typeof LOOPER_STORAGE_KEYS[LooperStorageKey];