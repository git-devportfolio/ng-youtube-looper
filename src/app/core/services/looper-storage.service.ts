import { Injectable, inject } from '@angular/core';
import { SecureStorageService } from './storage.service';
import { 
  LooperSession,
  SessionSettings,
  CurrentState,
  SessionHistoryEntry,
  SessionMetadata,
  CompressedSessionData,
  StorageOperationResult,
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_LOOPER_STORAGE_CONFIG,
  LOOPER_STORAGE_KEYS
} from './looper-storage.types';
import { LoopSegment } from '@shared/interfaces';

@Injectable({
  providedIn: 'root'
})
export class LooperStorageService {
  private readonly secureStorage = inject(SecureStorageService);
  private readonly config = DEFAULT_LOOPER_STORAGE_CONFIG;

  // === SESSION MANAGEMENT ===

  /**
   * Sauvegarde toutes les sessions de boucles
   */
  saveSessions(sessions: LooperSession[]): StorageOperationResult {
    try {
      if (!this.validateSessions(sessions)) {
        return {
          success: false,
          error: 'Données de session invalides'
        };
      }

      const sanitizedSessions = sessions.map(session => this.sanitizeSession(session));
      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.SESSIONS, sanitizedSessions);
      
      if (success) {
        // Mettre à jour les métadonnées
        this.updateSessionsMetadata(sanitizedSessions);
      }

      return {
        success,
        data: sanitizedSessions,
        error: success ? undefined : 'Échec de la sauvegarde des sessions',
        metadata: {
          operation: 'saveSessions',
          key: LOOPER_STORAGE_KEYS.SESSIONS,
          size: JSON.stringify(sanitizedSessions).length,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la sauvegarde: ${(error as Error).message}`
      };
    }
  }

  /**
   * Charge toutes les sessions de boucles
   */
  loadSessions(): StorageOperationResult {
    try {
      const sessions = this.secureStorage.loadData<LooperSession[]>(LOOPER_STORAGE_KEYS.SESSIONS, []);
      const validSessions = sessions.filter(session => this.validateSession(session));

      return {
        success: true,
        data: validSessions,
        metadata: {
          operation: 'loadSessions',
          key: LOOPER_STORAGE_KEYS.SESSIONS,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: `Erreur lors du chargement: ${(error as Error).message}`
      };
    }
  }

  /**
   * Sauvegarde une session spécifique
   */
  saveSession(session: LooperSession): StorageOperationResult {
    try {
      if (!this.validateSession(session)) {
        return {
          success: false,
          error: 'Session invalide'
        };
      }

      const sessionsResult = this.loadSessions();
      if (!sessionsResult.success) {
        return sessionsResult;
      }

      const sessions = sessionsResult.data as LooperSession[];
      const sanitizedSession = this.sanitizeSession(session);
      const existingIndex = sessions.findIndex(s => s.id === session.id);

      if (existingIndex >= 0) {
        sessions[existingIndex] = sanitizedSession;
      } else {
        sessions.push(sanitizedSession);
      }

      return this.saveSessions(sessions);
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la sauvegarde de la session: ${(error as Error).message}`
      };
    }
  }

  /**
   * Supprime une session spécifique
   */
  deleteSession(sessionId: string): StorageOperationResult {
    try {
      const sessionsResult = this.loadSessions();
      if (!sessionsResult.success) {
        return sessionsResult;
      }

      const sessions = sessionsResult.data as LooperSession[];
      const filteredSessions = sessions.filter(s => s.id !== sessionId);

      if (filteredSessions.length === sessions.length) {
        return {
          success: false,
          error: `Session ${sessionId} introuvable`
        };
      }

      return this.saveSessions(filteredSessions);
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la suppression: ${(error as Error).message}`
      };
    }
  }

  /**
   * Obtient une session par ID
   */
  getSession(sessionId: string): StorageOperationResult {
    try {
      const sessionsResult = this.loadSessions();
      if (!sessionsResult.success) {
        return sessionsResult;
      }

      const sessions = sessionsResult.data as LooperSession[];
      const session = sessions.find(s => s.id === sessionId);

      return {
        success: !!session,
        data: session,
        error: session ? undefined : `Session ${sessionId} introuvable`
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération: ${(error as Error).message}`
      };
    }
  }

  /**
   * Obtient toutes les sessions pour une vidéo
   */
  getVideoSessions(videoId: string): StorageOperationResult {
    try {
      const sessionsResult = this.loadSessions();
      if (!sessionsResult.success) {
        return sessionsResult;
      }

      const sessions = sessionsResult.data as LooperSession[];
      const videoSessions = sessions.filter(s => s.videoId === videoId);

      return {
        success: true,
        data: videoSessions
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: `Erreur lors de la récupération des sessions vidéo: ${(error as Error).message}`
      };
    }
  }

  // === CURRENT STATE MANAGEMENT ===

  /**
   * Sauvegarde l'état actuel de l'application
   */
  saveCurrentState(state: CurrentState): StorageOperationResult {
    try {
      if (!this.validateCurrentState(state)) {
        return {
          success: false,
          error: 'État actuel invalide'
        };
      }

      const sanitizedState = this.sanitizeCurrentState(state);
      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.CURRENT, sanitizedState);

      return {
        success,
        data: sanitizedState,
        error: success ? undefined : 'Échec de la sauvegarde de l\'état actuel'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la sauvegarde de l'état: ${(error as Error).message}`
      };
    }
  }

  /**
   * Charge l'état actuel de l'application
   */
  loadCurrentState(): StorageOperationResult {
    try {
      const defaultState: CurrentState = {
        activeSessionId: null,
        currentVideoId: null,
        currentTime: 0,
        playbackSpeed: 1.0,
        isPlaying: false,
        activeLoopId: null,
        lastActivity: new Date()
      };

      const state = this.secureStorage.loadData<CurrentState>(LOOPER_STORAGE_KEYS.CURRENT, defaultState);
      const validatedState = this.validateCurrentState(state) ? state : defaultState;

      return {
        success: true,
        data: validatedState
      };
    } catch (error) {
      return {
        success: false,
        data: {
          activeSessionId: null,
          currentVideoId: null,
          currentTime: 0,
          playbackSpeed: 1.0,
          isPlaying: false,
          activeLoopId: null,
          lastActivity: new Date()
        },
        error: `Erreur lors du chargement de l'état: ${(error as Error).message}`
      };
    }
  }

  // === SETTINGS MANAGEMENT ===

  /**
   * Sauvegarde les paramètres de session
   */
  saveSessionSettings(settings: SessionSettings): StorageOperationResult {
    try {
      if (!this.validateSessionSettings(settings)) {
        return {
          success: false,
          error: 'Paramètres de session invalides'
        };
      }

      const sanitizedSettings = this.sanitizeSessionSettings(settings);
      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.SETTINGS, sanitizedSettings);

      return {
        success,
        data: sanitizedSettings,
        error: success ? undefined : 'Échec de la sauvegarde des paramètres'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la sauvegarde des paramètres: ${(error as Error).message}`
      };
    }
  }

  /**
   * Charge les paramètres de session
   */
  loadSessionSettings(): StorageOperationResult {
    try {
      const settings = this.secureStorage.loadData<SessionSettings>(LOOPER_STORAGE_KEYS.SETTINGS, DEFAULT_SESSION_SETTINGS);
      const validatedSettings = this.validateSessionSettings(settings) ? settings : DEFAULT_SESSION_SETTINGS;

      return {
        success: true,
        data: validatedSettings
      };
    } catch (error) {
      return {
        success: false,
        data: DEFAULT_SESSION_SETTINGS,
        error: `Erreur lors du chargement des paramètres: ${(error as Error).message}`
      };
    }
  }

  // === HISTORY MANAGEMENT ===

  /**
   * Ajoute une entrée à l'historique des sessions
   */
  addToSessionHistory(entry: SessionHistoryEntry): StorageOperationResult {
    try {
      if (!this.validateHistoryEntry(entry)) {
        return {
          success: false,
          error: 'Entrée d\'historique invalide'
        };
      }

      const historyResult = this.loadSessionHistory();
      if (!historyResult.success) {
        return historyResult;
      }

      const history = historyResult.data as SessionHistoryEntry[];
      const sanitizedEntry = this.sanitizeHistoryEntry(entry);

      // Supprimer les entrées existantes pour la même session
      const filteredHistory = history.filter(h => h.sessionId !== entry.sessionId);
      
      // Ajouter la nouvelle entrée au début
      filteredHistory.unshift(sanitizedEntry);
      
      // Limiter la taille de l'historique
      const settingsResult = this.loadSessionSettings();
      const settings = settingsResult.data as SessionSettings;
      const limitedHistory = filteredHistory.slice(0, settings.sessionHistoryLimit);

      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.HISTORY, limitedHistory);

      return {
        success,
        data: limitedHistory,
        error: success ? undefined : 'Échec de l\'ajout à l\'historique'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de l'ajout à l'historique: ${(error as Error).message}`
      };
    }
  }

  /**
   * Charge l'historique des sessions
   */
  loadSessionHistory(): StorageOperationResult {
    try {
      const history = this.secureStorage.loadData<SessionHistoryEntry[]>(LOOPER_STORAGE_KEYS.HISTORY, []);
      const validHistory = history.filter(entry => this.validateHistoryEntry(entry));

      return {
        success: true,
        data: validHistory
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: `Erreur lors du chargement de l'historique: ${(error as Error).message}`
      };
    }
  }

  /**
   * Nettoie l'historique automatiquement
   */
  cleanupHistory(): StorageOperationResult {
    try {
      const historyResult = this.loadSessionHistory();
      if (!historyResult.success) {
        return historyResult;
      }

      const history = historyResult.data as SessionHistoryEntry[];
      const settingsResult = this.loadSessionSettings();
      const settings = settingsResult.data as SessionSettings;

      // Garder seulement les entrées récentes dans la limite
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 jours
      const recentHistory = history
        .filter(entry => new Date(entry.accessedAt) > cutoffDate)
        .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime())
        .slice(0, settings.sessionHistoryLimit);

      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.HISTORY, recentHistory);

      return {
        success,
        data: recentHistory,
        error: success ? undefined : 'Échec du nettoyage de l\'historique'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors du nettoyage: ${(error as Error).message}`
      };
    }
  }

  // === COMPRESSION & SERIALIZATION ===

  /**
   * Compresse une session si elle dépasse le seuil
   */
  private compressSessionIfNeeded(session: LooperSession): string | CompressedSessionData {
    try {
      const serialized = JSON.stringify(session);
      
      if (!this.config.enableCompression || serialized.length < this.config.compressionThreshold) {
        return serialized;
      }

      // Simulation de compression simple (dans une vraie app, utiliser une vraie lib de compression)
      const compressed = this.simpleCompress(serialized);
      
      return {
        version: '1.0',
        compressed: true,
        data: compressed,
        metadata: {
          originalSize: serialized.length,
          compressedSize: compressed.length,
          compressionRatio: compressed.length / serialized.length,
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('Erreur de compression:', error);
      return JSON.stringify(session);
    }
  }

  /**
   * Décompresse une session si nécessaire
   */
  private decompressSessionIfNeeded(data: string | CompressedSessionData): LooperSession | null {
    try {
      if (typeof data === 'string') {
        return JSON.parse(data);
      }

      if (data.compressed && typeof data.data === 'string') {
        const decompressed = this.simpleDecompress(data.data);
        return JSON.parse(decompressed);
      }

      return null;
    } catch (error) {
      console.error('Erreur de décompression:', error);
      return null;
    }
  }

  /**
   * Compression simple (à remplacer par une vraie lib en production)
   */
  private simpleCompress(text: string): string {
    // Implémentation basique - en production, utiliser LZ-string ou similaire
    return btoa(encodeURIComponent(text));
  }

  /**
   * Décompression simple
   */
  private simpleDecompress(compressed: string): string {
    try {
      return decodeURIComponent(atob(compressed));
    } catch (error) {
      console.error('Échec de la décompression simple:', error);
      throw error;
    }
  }

  // === METADATA MANAGEMENT ===

  /**
   * Met à jour les métadonnées des sessions
   */
  private updateSessionsMetadata(sessions: LooperSession[]): boolean {
    try {
      const metadata: SessionMetadata[] = sessions.map(session => ({
        id: session.id,
        name: session.name,
        videoId: session.videoId,
        videoTitle: session.videoTitle,
        loopCount: session.loops.length,
        totalDuration: session.loops.reduce((sum, loop) => sum + (loop.endTime - loop.startTime), 0),
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastAccessed: session.lastPlayed,
        tags: session.tags || [],
        isStarred: false
      }));

      return this.secureStorage.saveData(LOOPER_STORAGE_KEYS.METADATA, metadata);
    } catch (error) {
      console.error('Erreur de mise à jour des métadonnées:', error);
      return false;
    }
  }

  /**
   * Obtient les métadonnées des sessions
   */
  getSessionsMetadata(): SessionMetadata[] {
    try {
      return this.secureStorage.loadData<SessionMetadata[]>(LOOPER_STORAGE_KEYS.METADATA, []);
    } catch (error) {
      console.error('Erreur de chargement des métadonnées:', error);
      return [];
    }
  }

  // === BACKUP MANAGEMENT ===

  /**
   * Crée une sauvegarde de toutes les données
   */
  createBackup(): StorageOperationResult {
    try {
      const sessionsResult = this.loadSessions();
      const settingsResult = this.loadSessionSettings();
      const currentStateResult = this.loadCurrentState();
      const historyResult = this.loadSessionHistory();

      if (!sessionsResult.success) {
        return sessionsResult;
      }

      const backupData = {
        version: '1.0',
        timestamp: new Date(),
        sessions: sessionsResult.data,
        settings: settingsResult.data,
        currentState: currentStateResult.data,
        history: historyResult.data,
        metadata: this.getSessionsMetadata()
      };

      const success = this.secureStorage.saveData(LOOPER_STORAGE_KEYS.BACKUP, backupData);

      return {
        success,
        data: backupData,
        error: success ? undefined : 'Échec de la création de la sauvegarde'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la sauvegarde: ${(error as Error).message}`
      };
    }
  }

  /**
   * Restaure à partir d'une sauvegarde
   */
  restoreFromBackup(): StorageOperationResult {
    try {
      const backup = this.secureStorage.loadData<any>(LOOPER_STORAGE_KEYS.BACKUP, null);
      
      if (!backup || !backup.sessions) {
        return {
          success: false,
          error: 'Aucune sauvegarde trouvée'
        };
      }

      // Restaurer les données
      const sessionsRestored = this.saveSessions(backup.sessions);
      
      if (backup.settings) {
        this.saveSessionSettings(backup.settings);
      }
      
      if (backup.currentState) {
        this.saveCurrentState(backup.currentState);
      }

      return {
        success: sessionsRestored.success,
        data: backup,
        error: sessionsRestored.success ? undefined : 'Échec de la restauration'
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la restauration: ${(error as Error).message}`
      };
    }
  }

  // === VALIDATION METHODS ===

  private validateSessions(sessions: any[]): boolean {
    return Array.isArray(sessions) && sessions.every(session => this.validateSession(session));
  }

  private validateSession(session: any): session is LooperSession {
    return session &&
           typeof session === 'object' &&
           typeof session.id === 'string' &&
           typeof session.name === 'string' &&
           typeof session.videoId === 'string' &&
           typeof session.videoTitle === 'string' &&
           typeof session.videoUrl === 'string' &&
           typeof session.videoDuration === 'number' &&
           Array.isArray(session.loops) &&
           typeof session.globalPlaybackSpeed === 'number' &&
           typeof session.currentTime === 'number' &&
           typeof session.isActive === 'boolean' &&
           typeof session.totalPlayTime === 'number' &&
           typeof session.playCount === 'number';
  }

  private validateCurrentState(state: any): state is CurrentState {
    return state &&
           typeof state === 'object' &&
           (state.activeSessionId === null || typeof state.activeSessionId === 'string') &&
           (state.currentVideoId === null || typeof state.currentVideoId === 'string') &&
           typeof state.currentTime === 'number' &&
           typeof state.playbackSpeed === 'number' &&
           typeof state.isPlaying === 'boolean' &&
           (state.activeLoopId === null || typeof state.activeLoopId === 'string');
  }

  private validateSessionSettings(settings: any): settings is SessionSettings {
    return settings &&
           typeof settings === 'object' &&
           typeof settings.defaultSessionName === 'string' &&
           typeof settings.autoSaveEnabled === 'boolean' &&
           typeof settings.autoSaveInterval === 'number' &&
           typeof settings.maxSessionsPerVideo === 'number';
  }

  private validateHistoryEntry(entry: any): entry is SessionHistoryEntry {
    return entry &&
           typeof entry === 'object' &&
           typeof entry.sessionId === 'string' &&
           typeof entry.sessionName === 'string' &&
           typeof entry.videoId === 'string' &&
           typeof entry.duration === 'number' &&
           typeof entry.loopsCount === 'number';
  }

  // === SANITIZATION METHODS ===

  private sanitizeSession(session: LooperSession): LooperSession {
    return {
      ...session,
      id: String(session.id).trim(),
      name: String(session.name).trim(),
      videoId: String(session.videoId).trim(),
      videoTitle: String(session.videoTitle).trim(),
      videoUrl: String(session.videoUrl).trim(),
      videoDuration: Math.max(0, Number(session.videoDuration) || 0),
      loops: session.loops.filter(loop => this.validateLoopSegment(loop)),
      globalPlaybackSpeed: Math.max(0.25, Math.min(3.0, Number(session.globalPlaybackSpeed) || 1.0)),
      currentTime: Math.max(0, Number(session.currentTime) || 0),
      isActive: Boolean(session.isActive),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(),
      lastPlayed: session.lastPlayed ? new Date(session.lastPlayed) : undefined,
      totalPlayTime: Math.max(0, Number(session.totalPlayTime) || 0),
      playCount: Math.max(0, Number(session.playCount) || 0),
      tags: Array.isArray(session.tags) ? session.tags.filter(tag => typeof tag === 'string').slice(0, 10) : undefined,
      description: session.description ? String(session.description).trim() : undefined
    };
  }

  private sanitizeCurrentState(state: CurrentState): CurrentState {
    return {
      activeSessionId: state.activeSessionId ? String(state.activeSessionId).trim() : null,
      currentVideoId: state.currentVideoId ? String(state.currentVideoId).trim() : null,
      currentTime: Math.max(0, Number(state.currentTime) || 0),
      playbackSpeed: Math.max(0.25, Math.min(3.0, Number(state.playbackSpeed) || 1.0)),
      isPlaying: Boolean(state.isPlaying),
      activeLoopId: state.activeLoopId ? String(state.activeLoopId).trim() : null,
      lastActivity: new Date()
    };
  }

  private sanitizeSessionSettings(settings: SessionSettings): SessionSettings {
    return {
      defaultSessionName: String(settings.defaultSessionName).trim() || 'Session pratique',
      autoSaveEnabled: Boolean(settings.autoSaveEnabled),
      autoSaveInterval: Math.max(5000, Math.min(300000, Number(settings.autoSaveInterval) || 30000)),
      maxSessionsPerVideo: Math.max(1, Math.min(100, Number(settings.maxSessionsPerVideo) || 20)),
      enableSessionCompression: Boolean(settings.enableSessionCompression),
      sessionHistoryLimit: Math.max(10, Math.min(1000, Number(settings.sessionHistoryLimit) || 50)),
      enableSessionBackup: Boolean(settings.enableSessionBackup),
      backupInterval: Math.max(60000, Math.min(3600000, Number(settings.backupInterval) || 300000)),
      defaultLoopDuration: Math.max(1, Math.min(3600, Number(settings.defaultLoopDuration) || 30)),
      enableSessionSharing: Boolean(settings.enableSessionSharing)
    };
  }

  private sanitizeHistoryEntry(entry: SessionHistoryEntry): SessionHistoryEntry {
    return {
      sessionId: String(entry.sessionId).trim(),
      sessionName: String(entry.sessionName).trim(),
      videoId: String(entry.videoId).trim(),
      videoTitle: String(entry.videoTitle).trim(),
      accessedAt: new Date(entry.accessedAt),
      duration: Math.max(0, Number(entry.duration) || 0),
      loopsCount: Math.max(0, Number(entry.loopsCount) || 0),
      lastCurrentTime: Math.max(0, Number(entry.lastCurrentTime) || 0)
    };
  }

  private validateLoopSegment(loop: any): loop is LoopSegment {
    return loop &&
           typeof loop === 'object' &&
           typeof loop.id === 'string' &&
           typeof loop.name === 'string' &&
           typeof loop.startTime === 'number' &&
           typeof loop.endTime === 'number' &&
           typeof loop.playbackSpeed === 'number' &&
           typeof loop.playCount === 'number' &&
           typeof loop.isActive === 'boolean' &&
           loop.startTime >= 0 &&
           loop.endTime > loop.startTime &&
           loop.playbackSpeed > 0 &&
           loop.playCount >= 0;
  }

  // === UTILITY METHODS ===

  /**
   * Obtient des informations sur l'utilisation du stockage
   */
  getStorageInfo() {
    return this.secureStorage.getStorageInfo();
  }

  /**
   * Nettoie toutes les données du looper
   */
  clearAllLooperData(): StorageOperationResult {
    try {
      const keys = Object.values(LOOPER_STORAGE_KEYS);
      let allSuccess = true;
      const errors: string[] = [];

      keys.forEach(key => {
        const success = this.secureStorage.removeData(key);
        if (!success) {
          allSuccess = false;
          errors.push(`Échec de suppression de ${key}`);
        }
      });

      return {
        success: allSuccess,
        error: errors.length > 0 ? errors.join(', ') : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la suppression: ${(error as Error).message}`
      };
    }
  }

  /**
   * Export de toutes les données au format JSON
   */
  exportAllData(): StorageOperationResult {
    try {
      const sessions = this.loadSessions();
      const settings = this.loadSessionSettings();
      const currentState = this.loadCurrentState();
      const history = this.loadSessionHistory();

      const exportData = {
        version: '1.0',
        exportedAt: new Date(),
        sessions: sessions.data,
        settings: settings.data,
        currentState: currentState.data,
        history: history.data
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de l'export: ${(error as Error).message}`
      };
    }
  }

  /**
   * Import de données depuis un export JSON
   */
  importData(importData: any): StorageOperationResult {
    try {
      if (!importData || !importData.sessions) {
        return {
          success: false,
          error: 'Données d\'import invalides'
        };
      }

      // Importer les sessions
      const sessionsResult = this.saveSessions(importData.sessions);
      
      // Importer les paramètres si présents
      if (importData.settings && this.validateSessionSettings(importData.settings)) {
        this.saveSessionSettings(importData.settings);
      }

      return sessionsResult;
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de l'import: ${(error as Error).message}`
      };
    }
  }
}