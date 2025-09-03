import { TestBed } from '@angular/core/testing';
import { SessionManagerService } from './session-manager.service';
import { LooperStorageService } from './looper-storage.service';
import { 
  LooperSession,
  DEFAULT_SESSION_SETTINGS,
  StorageOperationResult
} from './looper-storage.types';
import { LoopSegment } from '@shared/interfaces';

describe('SessionManagerService', () => {
  let service: SessionManagerService;
  let mockStorage: jasmine.SpyObj<LooperStorageService>;

  const mockLoop: LoopSegment = {
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
    loops: [mockLoop],
    globalPlaybackSpeed: 1.0,
    currentTime: 45,
    isActive: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-02'),
    totalPlayTime: 120,
    playCount: 5
  };

  beforeEach(() => {
    const storageSpy = jasmine.createSpyObj('LooperStorageService', [
      'loadSessions',
      'saveSessions',
      'saveSession',
      'deleteSession',
      'getSession',
      'getVideoSessions',
      'loadCurrentState',
      'saveCurrentState',
      'loadSessionSettings',
      'saveSessionSettings',
      'loadSessionHistory',
      'addToSessionHistory',
      'cleanupHistory',
      'exportAllData',
      'importData',
      'createBackup',
      'restoreFromBackup',
      'clearAllLooperData',
      'getStorageInfo'
    ]);

    TestBed.configureTestingModule({
      providers: [
        SessionManagerService,
        { provide: LooperStorageService, useValue: storageSpy }
      ]
    });

    service = TestBed.inject(SessionManagerService);
    mockStorage = TestBed.inject(LooperStorageService) as jasmine.SpyObj<LooperStorageService>;

    // Setup default successful responses
    mockStorage.loadSessions.and.returnValue({ success: true, data: [] });
    mockStorage.loadCurrentState.and.returnValue({ 
      success: true, 
      data: {
        activeSessionId: null,
        currentVideoId: null,
        currentTime: 0,
        playbackSpeed: 1.0,
        isPlaying: false,
        activeLoopId: null,
        lastActivity: new Date()
      }
    });
    mockStorage.loadSessionSettings.and.returnValue({ 
      success: true, 
      data: DEFAULT_SESSION_SETTINGS 
    });
    mockStorage.loadSessionHistory.and.returnValue({ success: true, data: [] });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Session Creation', () => {
    it('should create new session successfully', () => {
      const successResult: StorageOperationResult = { success: true, data: mockSession };
      mockStorage.saveSession.and.returnValue(successResult);

      const result = service.createSession(
        'New Session',
        'video-456',
        'New Video',
        'https://youtube.com/watch?v=new',
        180
      );

      expect(result.success).toBe(true);
      expect(mockStorage.saveSession).toHaveBeenCalled();
    });

    it('should handle session creation errors', () => {
      const errorResult: StorageOperationResult = { 
        success: false, 
        error: 'Storage error' 
      };
      mockStorage.saveSession.and.returnValue(errorResult);

      const result = service.createSession('Test', 'video', 'title', 'url', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });
  });

  describe('Session Updates', () => {
    beforeEach(() => {
      // Mock existing sessions
      mockStorage.loadSessions.and.returnValue({ 
        success: true, 
        data: [mockSession] 
      });
      
      // Re-initialize service to load mock data
      service = TestBed.inject(SessionManagerService);
    });

    it('should update existing session', () => {
      const successResult: StorageOperationResult = { success: true, data: mockSession };
      mockStorage.saveSession.and.returnValue(successResult);

      const result = service.updateSession('session-1', { 
        name: 'Updated Session' 
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveSession).toHaveBeenCalled();
    });

    it('should handle update of non-existent session', () => {
      const result = service.updateSession('non-existent', { 
        name: 'Updated' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('introuvable');
    });
  });

  describe('Session Deletion', () => {
    beforeEach(() => {
      mockStorage.loadSessions.and.returnValue({ 
        success: true, 
        data: [mockSession] 
      });
      service = TestBed.inject(SessionManagerService);
    });

    it('should delete session successfully', () => {
      const successResult: StorageOperationResult = { success: true };
      mockStorage.deleteSession.and.returnValue(successResult);

      const result = service.deleteSession('session-1');

      expect(result.success).toBe(true);
      expect(mockStorage.deleteSession).toHaveBeenCalledWith('session-1');
    });

    it('should update current state when deleting active session', () => {
      mockStorage.deleteSession.and.returnValue({ success: true });
      mockStorage.saveCurrentState.and.returnValue({ success: true });
      
      // Set session as active first
      service.setActiveSession('session-1');
      
      const result = service.deleteSession('session-1');

      expect(result.success).toBe(true);
      expect(service.currentState().activeSessionId).toBe(null);
    });
  });

  describe('Active Session Management', () => {
    beforeEach(() => {
      mockStorage.loadSessions.and.returnValue({ 
        success: true, 
        data: [mockSession] 
      });
      mockStorage.saveCurrentState.and.returnValue({ success: true });
      mockStorage.addToSessionHistory.and.returnValue({ success: true, data: [] });
      service = TestBed.inject(SessionManagerService);
    });

    it('should set active session', () => {
      const result = service.setActiveSession('session-1');

      expect(result).toBe(true);
      expect(mockStorage.saveCurrentState).toHaveBeenCalled();
      expect(mockStorage.addToSessionHistory).toHaveBeenCalled();
    });

    it('should clear active session', () => {
      const result = service.setActiveSession(null);

      expect(result).toBe(true);
      expect(mockStorage.saveCurrentState).toHaveBeenCalled();
    });

    it('should reject invalid session ID', () => {
      const result = service.setActiveSession('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Loop Management', () => {
    beforeEach(() => {
      mockStorage.loadSessions.and.returnValue({ 
        success: true, 
        data: [mockSession] 
      });
      mockStorage.saveSession.and.returnValue({ success: true, data: mockSession });
      service = TestBed.inject(SessionManagerService);
    });

    it('should add loops to existing session', () => {
      const newLoop: LoopSegment = {
        id: 'loop-2',
        name: 'New Loop',
        startTime: 90,
        endTime: 120,
        playbackSpeed: 1.5,
        playCount: 0,
        isActive: false
      };

      const result = service.addLoopsToSession('session-1', [newLoop]);

      expect(result.success).toBe(true);
      expect(mockStorage.saveSession).toHaveBeenCalled();
    });

    it('should handle adding loops to non-existent session', () => {
      const result = service.addLoopsToSession('non-existent', [mockLoop]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('introuvable');
    });
  });

  describe('Settings Management', () => {
    it('should update settings successfully', () => {
      mockStorage.saveSessionSettings.and.returnValue({ success: true, data: DEFAULT_SESSION_SETTINGS });

      const result = service.updateSettings({ 
        autoSaveInterval: 60000 
      });

      expect(result.success).toBe(true);
      expect(mockStorage.saveSessionSettings).toHaveBeenCalled();
    });

    it('should handle settings update errors', () => {
      mockStorage.saveSessionSettings.and.returnValue({ 
        success: false, 
        error: 'Settings error' 
      });

      const result = service.updateSettings({ autoSaveEnabled: false });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settings error');
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      const sessions = [
        mockSession,
        {
          ...mockSession,
          id: 'session-2',
          name: 'Guitar Practice',
          videoTitle: 'Guitar Tutorial',
          tags: ['guitar', 'practice']
        }
      ];
      
      mockStorage.loadSessions.and.returnValue({ 
        success: true, 
        data: sessions 
      });
      service = TestBed.inject(SessionManagerService);
    });

    it('should search sessions by name', () => {
      const results = service.searchSessions('guitar');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Guitar Practice');
    });

    it('should search sessions by video title', () => {
      const results = service.searchSessions('tutorial');
      expect(results.length).toBe(1);
    });

    it('should get sessions for specific video', () => {
      const sessions = service.getSessionsForVideo('video-123');
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].videoId).toBe('video-123');
    });
  });

  describe('Data Management', () => {
    it('should export session data', () => {
      mockStorage.exportAllData.and.returnValue({ 
        success: true, 
        data: { sessions: [mockSession] } 
      });

      const result = service.exportSessions();

      expect(result.success).toBe(true);
      expect(mockStorage.exportAllData).toHaveBeenCalled();
    });

    it('should import session data', () => {
      mockStorage.importData.and.returnValue({ success: true });

      const result = service.importSessions({ sessions: [mockSession] });

      expect(result.success).toBe(true);
      expect(mockStorage.importData).toHaveBeenCalled();
    });

    it('should create and restore backups', () => {
      mockStorage.createBackup.and.returnValue({ 
        success: true, 
        data: { sessions: [mockSession] } 
      });
      mockStorage.restoreFromBackup.and.returnValue({ success: true });

      const createResult = service.createBackup();
      const restoreResult = service.restoreFromBackup();

      expect(createResult.success).toBe(true);
      expect(restoreResult.success).toBe(true);
    });

    it('should clear all data', () => {
      mockStorage.clearAllLooperData.and.returnValue({ success: true });

      const result = service.clearAllData();

      expect(result.success).toBe(true);
      expect(service.sessionCount()).toBe(0);
    });
  });
});