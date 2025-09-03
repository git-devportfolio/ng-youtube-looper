import { TestBed } from '@angular/core/testing';
import { LooperStorageService } from './looper-storage.service';
import { SecureStorageService } from './storage.service';
import { 
  LooperSession, 
  CurrentState, 
  SessionSettings,
  SessionHistoryEntry,
  DEFAULT_SESSION_SETTINGS,
  LOOPER_STORAGE_KEYS 
} from './looper-storage.types';
import { LoopSegment } from '@shared/interfaces';

describe('LooperStorageService', () => {
  let service: LooperStorageService;
  let mockSecureStorage: jasmine.SpyObj<SecureStorageService>;

  const mockLoopSegment: LoopSegment = {
    id: 'loop-1',
    name: 'Test Loop',
    startTime: 30,
    endTime: 60,
    playbackSpeed: 1.0,
    playCount: 0,
    isActive: true
  };

  const mockSession: LooperSession = {
    id: 'session-1',
    name: 'Test Session',
    videoId: 'video-123',
    videoTitle: 'Test Video',
    videoUrl: 'https://youtube.com/watch?v=test',
    videoDuration: 300,
    loops: [mockLoopSegment],
    globalPlaybackSpeed: 1.0,
    currentTime: 45,
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    totalPlayTime: 120,
    playCount: 5
  };

  const mockCurrentState: CurrentState = {
    activeSessionId: 'session-1',
    currentVideoId: 'video-123',
    currentTime: 45,
    playbackSpeed: 1.0,
    isPlaying: false,
    activeLoopId: 'loop-1',
    lastActivity: new Date()
  };

  const mockHistoryEntry: SessionHistoryEntry = {
    sessionId: 'session-1',
    sessionName: 'Test Session',
    videoId: 'video-123',
    videoTitle: 'Test Video',
    accessedAt: new Date(),
    duration: 120,
    loopsCount: 1,
    lastCurrentTime: 45
  };

  beforeEach(() => {
    const storageServiceSpy = jasmine.createSpyObj('SecureStorageService', [
      'saveData',
      'loadData',
      'removeData',
      'getStorageInfo'
    ]);

    TestBed.configureTestingModule({
      providers: [
        LooperStorageService,
        { provide: SecureStorageService, useValue: storageServiceSpy }
      ]
    });

    service = TestBed.inject(LooperStorageService);
    mockSecureStorage = TestBed.inject(SecureStorageService) as jasmine.SpyObj<SecureStorageService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Session Management', () => {
    it('should save sessions successfully', () => {
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.saveSessions([mockSession]);
      
      expect(result.success).toBe(true);
      expect(mockSecureStorage.saveData).toHaveBeenCalledWith(
        LOOPER_STORAGE_KEYS.SESSIONS, 
        jasmine.any(Array)
      );
    });

    it('should load sessions successfully', () => {
      mockSecureStorage.loadData.and.returnValue([mockSession]);
      
      const result = service.loadSessions();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSession]);
      expect(mockSecureStorage.loadData).toHaveBeenCalledWith(
        LOOPER_STORAGE_KEYS.SESSIONS,
        []
      );
    });

    it('should save a single session', () => {
      mockSecureStorage.loadData.and.returnValue([]);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.saveSession(mockSession);
      
      expect(result.success).toBe(true);
    });

    it('should delete a session', () => {
      mockSecureStorage.loadData.and.returnValue([mockSession]);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.deleteSession('session-1');
      
      expect(result.success).toBe(true);
    });

    it('should get a specific session by ID', () => {
      mockSecureStorage.loadData.and.returnValue([mockSession]);
      
      const result = service.getSession('session-1');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSession);
    });

    it('should get sessions for a specific video', () => {
      mockSecureStorage.loadData.and.returnValue([mockSession]);
      
      const result = service.getVideoSessions('video-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSession]);
    });

    it('should handle invalid session data', () => {
      const invalidSession = { ...mockSession, id: null };
      
      const result = service.saveSessions([invalidSession as any]);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalides');
    });
  });

  describe('Current State Management', () => {
    it('should save current state successfully', () => {
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.saveCurrentState(mockCurrentState);
      
      expect(result.success).toBe(true);
      expect(mockSecureStorage.saveData).toHaveBeenCalledWith(
        LOOPER_STORAGE_KEYS.CURRENT,
        jasmine.any(Object)
      );
    });

    it('should load current state with defaults', () => {
      mockSecureStorage.loadData.and.returnValue(mockCurrentState);
      
      const result = service.loadCurrentState();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(jasmine.objectContaining({
        currentVideoId: 'video-123',
        activeSessionId: 'session-1'
      }));
    });

    it('should return default state when load fails', () => {
      mockSecureStorage.loadData.and.throwError('Storage error');
      
      const result = service.loadCurrentState();
      
      expect(result.success).toBe(false);
      expect(result.data.activeSessionId).toBe(null);
    });
  });

  describe('Settings Management', () => {
    it('should save session settings successfully', () => {
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.saveSessionSettings(DEFAULT_SESSION_SETTINGS);
      
      expect(result.success).toBe(true);
      expect(mockSecureStorage.saveData).toHaveBeenCalledWith(
        LOOPER_STORAGE_KEYS.SETTINGS,
        jasmine.any(Object)
      );
    });

    it('should load session settings with defaults', () => {
      mockSecureStorage.loadData.and.returnValue(DEFAULT_SESSION_SETTINGS);
      
      const result = service.loadSessionSettings();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(DEFAULT_SESSION_SETTINGS);
    });

    it('should sanitize invalid settings', () => {
      const invalidSettings = {
        ...DEFAULT_SESSION_SETTINGS,
        autoSaveInterval: -1000, // Invalid negative value
        maxSessionsPerVideo: 0 // Invalid zero value
      };
      
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.saveSessionSettings(invalidSettings);
      
      expect(result.success).toBe(true);
      expect((result.data as SessionSettings).autoSaveInterval).toBeGreaterThan(0);
      expect((result.data as SessionSettings).maxSessionsPerVideo).toBeGreaterThan(0);
    });
  });

  describe('History Management', () => {
    it('should add entry to session history', () => {
      mockSecureStorage.loadData.and.returnValue([]);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.addToSessionHistory(mockHistoryEntry);
      
      expect(result.success).toBe(true);
      expect(mockSecureStorage.saveData).toHaveBeenCalledWith(
        LOOPER_STORAGE_KEYS.HISTORY,
        jasmine.any(Array)
      );
    });

    it('should load session history', () => {
      mockSecureStorage.loadData.and.returnValue([mockHistoryEntry]);
      
      const result = service.loadSessionHistory();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockHistoryEntry]);
    });

    it('should cleanup old history entries', () => {
      const oldEntry = {
        ...mockHistoryEntry,
        accessedAt: new Date('2020-01-01') // Very old entry
      };
      
      mockSecureStorage.loadData.and.returnValue([oldEntry, mockHistoryEntry]);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.cleanupHistory();
      
      expect(result.success).toBe(true);
      // Should keep only recent entries
    });
  });

  describe('Backup Operations', () => {
    it('should create backup successfully', () => {
      mockSecureStorage.loadData.and.returnValue([]);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.createBackup();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(jasmine.objectContaining({
        version: '1.0',
        timestamp: jasmine.any(Date)
      }));
    });

    it('should restore from backup', () => {
      const backupData = {
        version: '1.0',
        sessions: [mockSession],
        settings: DEFAULT_SESSION_SETTINGS
      };
      
      mockSecureStorage.loadData.and.returnValue(backupData);
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.restoreFromBackup();
      
      expect(result.success).toBe(true);
    });
  });

  describe('Data Export/Import', () => {
    it('should export all data', () => {
      mockSecureStorage.loadData.and.returnValue([]);
      
      const result = service.exportAllData();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(jasmine.objectContaining({
        version: '1.0',
        exportedAt: jasmine.any(Date)
      }));
    });

    it('should import data successfully', () => {
      const importData = {
        sessions: [mockSession],
        settings: DEFAULT_SESSION_SETTINGS
      };
      
      mockSecureStorage.saveData.and.returnValue(true);
      
      const result = service.importData(importData);
      
      expect(result.success).toBe(true);
    });

    it('should handle invalid import data', () => {
      const result = service.importData({ invalid: 'data' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalides');
    });
  });

  describe('Storage Utilities', () => {
    it('should get storage info', () => {
      const mockInfo = {
        available: true,
        currentSize: 1000,
        maxSize: 5000000,
        utilizationPercentage: 0.02,
        remainingSize: 4999000
      };
      
      mockSecureStorage.getStorageInfo.and.returnValue(mockInfo);
      
      const info = service.getStorageInfo();
      
      expect(info).toEqual(mockInfo);
    });

    it('should clear all looper data', () => {
      mockSecureStorage.removeData.and.returnValue(true);
      
      const result = service.clearAllLooperData();
      
      expect(result.success).toBe(true);
      expect(mockSecureStorage.removeData).toHaveBeenCalledTimes(
        Object.values(LOOPER_STORAGE_KEYS).length
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', () => {
      mockSecureStorage.saveData.and.returnValue(false);
      
      const result = service.saveSessions([mockSession]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed data', () => {
      const malformedSession = { id: 'test' }; // Missing required fields
      
      const result = service.saveSessions([malformedSession as any]);
      
      expect(result.success).toBe(false);
    });
  });
});