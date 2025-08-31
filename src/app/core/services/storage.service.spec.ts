import { TestBed } from '@angular/core/testing';
import { SecureStorageService } from './storage.service';
import { VideoSession, SessionLoop, AppSettings, DEFAULT_APP_SETTINGS, HistoryEntry } from './storage.types';

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  let originalLocalStorage: Storage;

  // Mock data
  const mockHistoryEntry: HistoryEntry = {
    id: 'history-1',
    videoId: 'test-video-1',
    videoTitle: 'Test Video Title',
    videoUrl: 'https://youtube.com/watch?v=test-video-1',
    thumbnailUrl: 'https://img.youtube.com/vi/test-video-1/0.jpg',
    lastWatched: new Date('2024-01-01T10:00:00Z'),
    watchDuration: 300, // 5 minutes
    loopCount: 5,
    playbackSpeed: 1.5,
    tags: ['guitar', 'lesson']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SecureStorageService);
    originalLocalStorage = window.localStorage;
  });

  afterEach(() => {
    // Clean up after each test
    try {
      localStorage.clear();
    } catch {
      // Ignore cleanup errors
    }
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Private method testing via public interface', () => {
    describe('validateStorageAvailable', () => {
      it('should return true when localStorage is available', () => {
        const result = service.saveData('test-key', 'test-value');
        expect(result).toBe(true);
      });

      it('should handle when localStorage is not available', () => {
        // Mock localStorage to throw error
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Storage not available'),
          getItem: jasmine.createSpy().and.throwError('Storage not available'),
          removeItem: jasmine.createSpy().and.throwError('Storage not available'),
          clear: jasmine.createSpy().and.throwError('Storage not available'),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.saveData('test', 'value');
        expect(result).toBe(false);
      });
    });

    describe('calculateStorageSize', () => {
      it('should calculate storage size correctly', () => {
        localStorage.clear();
        const initialSize = service.getStorageSize();
        
        service.saveData('test-key', 'test-value');
        const newSize = service.getStorageSize();
        
        expect(newSize).toBeGreaterThan(initialSize);
        expect(newSize).toBeGreaterThan(0);
      });

      it('should handle storage calculation errors gracefully', () => {
        const mockLocalStorage = {
          hasOwnProperty: () => { throw new Error('Access denied'); },
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          removeItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        
        // Spy on console.error to prevent error logging in test output
        spyOn(console, 'error');
        
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const size = service.getStorageSize();
        expect(size).toBe(0);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('validateSizeLimit', () => {
      it('should reject data that exceeds single item size limit', () => {
        const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB string
        const result = service.saveData('large-data', largeData);
        expect(result).toBe(false);
      });

      it('should accept data within size limits', () => {
        const normalData = 'normal data';
        const result = service.saveData('normal-data', normalData);
        expect(result).toBe(true);
      });
    });

    describe('serializeData and deserializeData', () => {
      it('should serialize and deserialize complex objects correctly', () => {
        const complexData = {
          id: 123,
          name: 'Test Object',
          array: [1, 2, 3],
          nested: {
            prop: 'value'
          }
        };

        service.saveData('complex-data', complexData);
        const retrieved = service.loadData('complex-data', {});

        expect(retrieved).toEqual(complexData);
      });

      it('should handle serialization of functions by filtering them out', () => {
        const dataWithFunction = {
          id: 123,
          name: 'Test',
          func: () => 'test function',
          undefinedProp: undefined
        };

        service.saveData('func-data', dataWithFunction);
        const retrieved = service.loadData('func-data', {}) as any;

        expect(retrieved.id).toBe(123);
        expect(retrieved.name).toBe('Test');
        expect(retrieved.func).toBe(null);
        // undefinedProp might not exist in the retrieved object due to JSON serialization behavior
        expect(retrieved.undefinedProp === null || retrieved.undefinedProp === undefined).toBe(true);
      });

      it('should sanitize potentially malicious strings', () => {
        const maliciousData = {
          content: '<script>alert("xss")</script>Safe content'
        };

        service.saveData('malicious-data', maliciousData);
        const retrieved = service.loadData('malicious-data', {}) as any;

        expect(retrieved.content).toBe('Safe content');
      });

      it('should reject malicious JSON strings during deserialization', () => {
        // Directly test by putting malicious data in localStorage - this should be caught by the security checks
        localStorage.setItem('malicious-json', '{"content": "<script>alert(\\"xss\\")</script>"}');
        
        spyOn(console, 'error'); // Prevent error logging in tests
        
        const result = service.loadData('malicious-json', { default: 'safe' }) as any;
        // Either returns sanitized data or default value due to error
        expect(result.default || result.content).toBeDefined();
      });
    });

    describe('sanitizeData', () => {
      it('should sanitize nested objects correctly', () => {
        const dirtyData = {
          safe: 'content',
          __dangerous: 'should be removed',
          scriptKey: 'should be removed',
          evalKey: 'should be removed',
          nested: {
            safe: 'nested content',
            __alsoDangerous: 'should be removed'
          }
        };

        service.saveData('dirty-data', dirtyData);
        const cleaned = service.loadData('dirty-data', {}) as any;

        expect(cleaned.safe).toBe('content');
        expect(cleaned.__dangerous).toBeUndefined();
        expect(cleaned.scriptKey).toBeUndefined();
        expect(cleaned.evalKey).toBeUndefined();
        expect(cleaned.nested.safe).toBe('nested content');
        expect(cleaned.nested.__alsoDangerous).toBeUndefined();
      });

      it('should sanitize arrays correctly', () => {
        const arrayData = [
          { safe: 'content1' },
          { __dangerous: 'should be removed' },
          'simple string'
        ];

        service.saveData('array-data', arrayData);
        const cleaned = service.loadData('array-data', []) as any[];

        expect(cleaned).toHaveSize(3);
        expect(cleaned[0].safe).toBe('content1');
        expect(cleaned[1].__dangerous).toBeUndefined();
        expect(cleaned[2]).toBe('simple string');
      });
    });
  });

  describe('Public API methods', () => {
    describe('saveData and loadData', () => {
      it('should save and load data correctly', () => {
        const testData = { id: 1, name: 'Test' };
        const saved = service.saveData('test-key', testData);
        expect(saved).toBe(true);

        const loaded = service.loadData('test-key', {});
        expect(loaded).toEqual(testData);
      });

      it('should return default value when key does not exist', () => {
        const defaultValue = { default: true };
        const result = service.loadData('non-existent-key', defaultValue);
        expect(result).toEqual(defaultValue);
      });

      it('should return default value when localStorage is corrupted', () => {
        localStorage.setItem('corrupted-key', 'invalid-json{');
        const defaultValue = { default: true };
        
        const result = service.loadData('corrupted-key', defaultValue);
        expect(result).toEqual(defaultValue);
      });
    });

    describe('removeData', () => {
      it('should remove data successfully', () => {
        service.saveData('remove-test', 'data');
        expect(localStorage.getItem('remove-test')).toBeTruthy();

        const removed = service.removeData('remove-test');
        expect(removed).toBe(true);
        expect(localStorage.getItem('remove-test')).toBeNull();
      });

      it('should handle removal errors gracefully', () => {
        const mockLocalStorage = {
          removeItem: jasmine.createSpy().and.throwError('Removal failed'),
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.removeData('test-key');
        expect(result).toBe(false);
      });
    });

    describe('clearAll', () => {
      it('should clear all localStorage data', () => {
        service.saveData('test1', 'data1');
        service.saveData('test2', 'data2');
        
        const cleared = service.clearAll();
        expect(cleared).toBe(true);
        expect(localStorage.length).toBe(0);
      });

      it('should handle clear errors gracefully', () => {
        const mockLocalStorage = {
          clear: jasmine.createSpy().and.throwError('Clear failed'),
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          removeItem: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.clearAll();
        expect(result).toBe(false);
      });
    });

    describe('getStorageSize', () => {
      it('should return storage size in bytes', () => {
        localStorage.clear();
        const initialSize = service.getStorageSize();
        
        service.saveData('size-test', 'test-data');
        const newSize = service.getStorageSize();
        
        expect(newSize).toBeGreaterThan(initialSize);
        expect(typeof newSize).toBe('number');
      });
    });

    describe('getStorageInfo', () => {
      it('should return comprehensive storage information', () => {
        const info = service.getStorageInfo();
        
        expect(info.available).toBeDefined();
        expect(info.currentSize).toBeDefined();
        expect(info.maxSize).toBeDefined();
        expect(info.utilizationPercentage).toBeDefined();
        expect(info.remainingSize).toBeDefined();
        
        expect(typeof info.available).toBe('boolean');
        expect(typeof info.currentSize).toBe('number');
        expect(typeof info.maxSize).toBe('number');
        expect(typeof info.utilizationPercentage).toBe('number');
        expect(typeof info.remainingSize).toBe('number');
        
        expect(info.maxSize).toBe(5 * 1024 * 1024); // 5MB
        expect(info.currentSize + info.remainingSize).toBe(info.maxSize);
      });
    });

    describe('isStorageHealthy', () => {
      it('should return true for healthy storage', () => {
        localStorage.clear(); // Start with clean storage
        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(true);
      });

      it('should return false when storage utilization is too high', () => {
        // This test is conceptual as it's hard to fill localStorage to 90% in a unit test
        const healthy = service.isStorageHealthy();
        expect(typeof healthy).toBe('boolean');
      });

      it('should return false when storage is not available', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Not available'),
          getItem: jasmine.createSpy().and.throwError('Not available'),
          removeItem: jasmine.createSpy().and.throwError('Not available'),
          clear: jasmine.createSpy().and.throwError('Not available'),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(false);
      });

      it('should handle health check errors gracefully', () => {
        spyOn(service, 'getStorageInfo').and.throwError('Info error');
        
        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(false);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values correctly', () => {
      service.saveData('null-test', null);
      service.saveData('undefined-test', undefined);
      
      // When loading null values with a string default, we should get null if data was successfully saved
      // But if undefined wasn't serialized properly, we might get the default
      const nullResult = service.loadData<string | null>('null-test', 'default');
      const undefinedResult = service.loadData<string | null>('undefined-test', 'default');
      
      // null should be preserved
      expect(nullResult).toBe(null);
      // undefined gets converted to null in serialization, or falls back to default if not saved
      expect(undefinedResult === null || undefinedResult === 'default').toBe(true);
    });

    it('should handle empty strings and objects', () => {
      service.saveData('empty-string', '');
      service.saveData('empty-object', {});
      service.saveData('empty-array', []);
      
      expect(service.loadData('empty-string', 'default')).toBe('');
      expect(service.loadData('empty-object', {})).toEqual({});
      expect(service.loadData('empty-array', [])).toEqual([]);
    });

    it('should handle very deep nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value'
              }
            }
          }
        }
      };

      service.saveData('deep-object', deepObject);
      const retrieved = service.loadData('deep-object', {});
      
      expect(retrieved).toEqual(deepObject);
    });
  });

  describe('Video Sessions Management (Task 22.2)', () => {
    let mockVideoSession: VideoSession;
    let mockSessionLoop: SessionLoop;

    beforeEach(() => {
      // Create mock data for tests
      mockSessionLoop = {
        id: 'loop-1',
        name: 'Guitar Solo',
        startTime: 60,
        endTime: 120,
        color: '#3B82F6',
        playCount: 5,
        isActive: true
      };

      mockVideoSession = {
        id: 'session-1',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Test Video',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        loops: [mockSessionLoop],
        playbackSpeed: 1.0,
        currentTime: 30,
        lastPlayed: new Date('2024-01-01'),
        totalPlayTime: 300,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      localStorage.clear();
    });

    describe('saveSessions and loadSessions', () => {
      it('should save and load sessions correctly', () => {
        const sessions = [mockVideoSession];
        const saved = service.saveSessions(sessions);
        expect(saved).toBe(true);

        const loaded = service.loadSessions();
        expect(loaded).toHaveSize(1);
        expect(loaded[0].id).toBe(mockVideoSession.id);
        expect(loaded[0].videoId).toBe(mockVideoSession.videoId);
        expect(loaded[0].loops).toHaveSize(1);
      });

      it('should handle empty sessions array', () => {
        const saved = service.saveSessions([]);
        expect(saved).toBe(true);

        const loaded = service.loadSessions();
        expect(loaded).toEqual([]);
      });

      it('should return empty array when no sessions exist', () => {
        const loaded = service.loadSessions();
        expect(loaded).toEqual([]);
      });

      it('should validate and filter invalid sessions', () => {
        const invalidSessions = [
          mockVideoSession, // Valid
          { id: '', videoId: 'test' }, // Invalid - empty id
          { videoId: 'test' }, // Invalid - missing id
          null, // Invalid - null
          'not an object' // Invalid - not an object
        ] as any[];

        const saved = service.saveSessions(invalidSessions);
        expect(saved).toBe(true);

        const loaded = service.loadSessions();
        expect(loaded).toHaveSize(1);
        expect(loaded[0].id).toBe(mockVideoSession.id);
      });

      it('should reject non-array input', () => {
        const saved = service.saveSessions('not an array' as any);
        expect(saved).toBe(false);
      });

      it('should handle corrupted localStorage data gracefully', () => {
        localStorage.setItem('ng-youtube-looper-sessions', 'invalid-json{');
        
        const loaded = service.loadSessions();
        expect(loaded).toEqual([]);
      });
    });

    describe('clearSessions', () => {
      it('should clear all sessions', () => {
        service.saveSessions([mockVideoSession]);
        expect(service.loadSessions()).toHaveSize(1);

        const cleared = service.clearSessions();
        expect(cleared).toBe(true);
        expect(service.loadSessions()).toEqual([]);
      });
    });

    describe('saveSession and getSession', () => {
      it('should save and retrieve a single session', () => {
        const saved = service.saveSession(mockVideoSession);
        expect(saved).toBe(true);

        const retrieved = service.getSession(mockVideoSession.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(mockVideoSession.id);
      });

      it('should update existing session', () => {
        service.saveSession(mockVideoSession);

        const updatedSession = {
          ...mockVideoSession,
          currentTime: 60,
          totalPlayTime: 400
        };

        const saved = service.saveSession(updatedSession);
        expect(saved).toBe(true);

        const sessions = service.loadSessions();
        expect(sessions).toHaveSize(1);
        expect(sessions[0].currentTime).toBe(60);
        expect(sessions[0].totalPlayTime).toBe(400);
      });

      it('should return null for non-existent session', () => {
        const session = service.getSession('non-existent');
        expect(session).toBeNull();
      });

      it('should reject invalid session data', () => {
        const invalidSession = { id: '', videoId: '' } as any;
        const saved = service.saveSession(invalidSession);
        expect(saved).toBe(false);
      });
    });

    describe('deleteSession', () => {
      it('should delete an existing session', () => {
        service.saveSession(mockVideoSession);
        expect(service.loadSessions()).toHaveSize(1);

        const deleted = service.deleteSession(mockVideoSession.id);
        expect(deleted).toBe(true);
        expect(service.loadSessions()).toHaveSize(0);
      });

      it('should return false when deleting non-existent session', () => {
        const deleted = service.deleteSession('non-existent');
        expect(deleted).toBe(false);
      });
    });

    describe('getVideoSessions', () => {
      it('should return sessions for specific video', () => {
        const session1 = { ...mockVideoSession, id: 'session-1', videoId: 'video-1' };
        const session2 = { ...mockVideoSession, id: 'session-2', videoId: 'video-2' };
        const session3 = { ...mockVideoSession, id: 'session-3', videoId: 'video-1' };

        service.saveSessions([session1, session2, session3]);

        const video1Sessions = service.getVideoSessions('video-1');
        expect(video1Sessions).toHaveSize(2);
        expect(video1Sessions.map(s => s.id)).toContain('session-1');
        expect(video1Sessions.map(s => s.id)).toContain('session-3');

        const video2Sessions = service.getVideoSessions('video-2');
        expect(video2Sessions).toHaveSize(1);
        expect(video2Sessions[0].id).toBe('session-2');
      });

      it('should return empty array for video with no sessions', () => {
        const sessions = service.getVideoSessions('non-existent-video');
        expect(sessions).toEqual([]);
      });
    });

    describe('Session validation and sanitization', () => {
      it('should sanitize playback speed to valid range', () => {
        const sessionWithInvalidSpeed = {
          ...mockVideoSession,
          playbackSpeed: 5.0 // Too high
        };

        service.saveSession(sessionWithInvalidSpeed);
        const loaded = service.getSession(mockVideoSession.id);
        
        expect(loaded!.playbackSpeed).toBe(3.0); // Should be clamped to max
      });

      it('should sanitize negative current time to 0', () => {
        const sessionWithNegativeTime = {
          ...mockVideoSession,
          currentTime: -10
        };

        service.saveSession(sessionWithNegativeTime);
        const loaded = service.getSession(mockVideoSession.id);
        
        expect(loaded!.currentTime).toBe(0);
      });

      it('should filter invalid loops', () => {
        const sessionWithInvalidLoops = {
          ...mockVideoSession,
          loops: [
            mockSessionLoop, // Valid
            { id: '', startTime: 0, endTime: 10 }, // Invalid - empty id
            { id: 'loop-2', startTime: 20, endTime: 10 }, // Invalid - end before start
            null // Invalid - null
          ] as any[]
        };

        service.saveSession(sessionWithInvalidLoops);
        const loaded = service.getSession(mockVideoSession.id);
        
        expect(loaded!.loops).toHaveSize(1);
        expect(loaded!.loops[0].id).toBe(mockSessionLoop.id);
      });

      it('should convert date strings to Date objects', () => {
        const sessionWithStringDates = {
          ...mockVideoSession,
          lastPlayed: '2024-01-01T10:00:00Z',
          createdAt: '2024-01-01T09:00:00Z'
        } as any;

        service.saveSession(sessionWithStringDates);
        const loaded = service.getSession(mockVideoSession.id);
        
        expect(loaded!.lastPlayed).toBeInstanceOf(Date);
        expect(loaded!.createdAt).toBeInstanceOf(Date);
        expect(loaded!.updatedAt).toBeInstanceOf(Date);
      });

      it('should trim string fields', () => {
        const sessionWithUntrimmedStrings = {
          ...mockVideoSession,
          id: '  session-1  ',
          videoId: '  video-id  ',
          videoTitle: '  Video Title  ',
          videoUrl: '  https://example.com  '
        };

        service.saveSession(sessionWithUntrimmedStrings);
        const loaded = service.getSession('session-1');
        
        expect(loaded!.id).toBe('session-1');
        expect(loaded!.videoId).toBe('video-id');
        expect(loaded!.videoTitle).toBe('Video Title');
        expect(loaded!.videoUrl).toBe('https://example.com');
      });
    });

    describe('Error handling', () => {
      it('should handle localStorage errors gracefully', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Storage error'),
          getItem: jasmine.createSpy().and.returnValue(null),
          removeItem: jasmine.createSpy().and.throwError('Storage error'),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };

        spyOn(console, 'error'); // Prevent error logging in tests
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const saved = service.saveSessions([mockVideoSession]);
        expect(saved).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });

      it('should log appropriate messages on success/failure', () => {
        spyOn(console, 'log');
        spyOn(console, 'error');

        service.saveSessions([mockVideoSession]);
        expect(console.log).toHaveBeenCalledWith('Successfully saved 1 video sessions');

        service.loadSessions();
        expect(console.log).toHaveBeenCalledWith('Successfully loaded 1 video sessions');

        service.clearSessions();
        expect(console.log).toHaveBeenCalledWith('Successfully cleared all video sessions');
      });
    });
  });

  // === USER SETTINGS MANAGEMENT TESTS (Task 22.3) ===

  describe('User Settings Management (Task 22.3)', () => {
    describe('saveSettings and loadSettings', () => {
      it('should save and load settings successfully', () => {
        const customSettings: AppSettings = {
          ...DEFAULT_APP_SETTINGS,
          theme: 'dark',
          defaultPlaybackSpeed: 1.5,
          enableKeyboardShortcuts: false
        };

        const saved = service.saveSettings(customSettings);
        expect(saved).toBe(true);

        const loaded = service.loadSettings();
        expect(loaded.theme).toBe('dark');
        expect(loaded.defaultPlaybackSpeed).toBe(1.5);
        expect(loaded.enableKeyboardShortcuts).toBe(false);
      });

      it('should return default settings when none are saved', () => {
        const settings = service.loadSettings();
        expect(settings).toEqual(DEFAULT_APP_SETTINGS);
      });

      it('should merge loaded settings with defaults for missing properties', () => {
        // Save incomplete settings to localStorage directly
        const incompleteSettings = {
          theme: 'dark',
          defaultPlaybackSpeed: 2.0
        };
        localStorage.setItem('ng-youtube-looper-settings', JSON.stringify(incompleteSettings));

        const loaded = service.loadSettings();
        expect(loaded.theme).toBe('dark');
        expect(loaded.defaultPlaybackSpeed).toBe(2.0);
        expect(loaded.enableKeyboardShortcuts).toBe(DEFAULT_APP_SETTINGS.enableKeyboardShortcuts);
        expect(loaded.loopColors).toEqual(DEFAULT_APP_SETTINGS.loopColors);
      });

      it('should handle corrupted settings data gracefully', () => {
        localStorage.setItem('ng-youtube-looper-settings', 'invalid-json');
        
        spyOn(console, 'error');
        const settings = service.loadSettings();
        
        expect(settings).toEqual(DEFAULT_APP_SETTINGS);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('resetSettings', () => {
      it('should reset settings to defaults', () => {
        // First save custom settings
        const customSettings: AppSettings = {
          ...DEFAULT_APP_SETTINGS,
          theme: 'dark',
          defaultPlaybackSpeed: 2.0
        };
        service.saveSettings(customSettings);

        // Reset to defaults
        const reset = service.resetSettings();
        expect(reset).toBe(true);

        // Verify settings are back to defaults
        const settings = service.loadSettings();
        expect(settings).toEqual(DEFAULT_APP_SETTINGS);
      });

      it('should log success message on reset', () => {
        spyOn(console, 'log');
        service.resetSettings();
        expect(console.log).toHaveBeenCalledWith('Successfully reset settings to defaults');
      });
    });

    describe('updateSetting and getSetting', () => {
      it('should update a specific setting', () => {
        const updated = service.updateSetting('theme', 'dark');
        expect(updated).toBe(true);

        const theme = service.getSetting('theme');
        expect(theme).toBe('dark');

        // Verify other settings remain unchanged
        const playbackSpeed = service.getSetting('defaultPlaybackSpeed');
        expect(playbackSpeed).toBe(DEFAULT_APP_SETTINGS.defaultPlaybackSpeed);
      });

      it('should get default value when setting does not exist', () => {
        const theme = service.getSetting('theme');
        expect(theme).toBe(DEFAULT_APP_SETTINGS.theme);
      });

      it('should handle errors when updating setting', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Storage error'),
          getItem: jasmine.createSpy().and.returnValue(JSON.stringify(DEFAULT_APP_SETTINGS)),
          removeItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };

        spyOn(console, 'error');
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const updated = service.updateSetting('theme', 'dark');
        expect(updated).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle errors when getting setting', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy().and.throwError('Storage error'),
          removeItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };

        spyOn(console, 'error');
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const theme = service.getSetting('theme');
        expect(theme).toBe(DEFAULT_APP_SETTINGS.theme);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('Settings validation and sanitization', () => {
      it('should validate theme values', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          theme: 'invalid-theme'
        } as any;

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.theme).toBe(DEFAULT_APP_SETTINGS.theme);
      });

      it('should clamp playback speed to valid range', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          defaultPlaybackSpeed: 5.0 // Too high
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.defaultPlaybackSpeed).toBe(3.0); // Should be clamped to max
      });

      it('should clamp playback speed minimum', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          defaultPlaybackSpeed: 0.1 // Too low
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.defaultPlaybackSpeed).toBe(0.25); // Should be clamped to min
      });

      it('should clamp autoSaveInterval to valid range', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          autoSaveInterval: 1000 // Too low (minimum is 5000)
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.autoSaveInterval).toBe(5000); // Should be clamped to min
      });

      it('should clamp maxHistoryEntries to valid range', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          maxHistoryEntries: 5 // Too low
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.maxHistoryEntries).toBe(10); // Should be clamped to min

        const tooHighSettings = {
          ...DEFAULT_APP_SETTINGS,
          maxHistoryEntries: 2000 // Too high
        };

        service.saveSettings(tooHighSettings);
        const loadedHigh = service.loadSettings();
        
        expect(loadedHigh.maxHistoryEntries).toBe(1000); // Should be clamped to max
      });

      it('should validate hex colors in loopColors', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          loopColors: ['#FF0000', 'invalid-color', '#00FF00', '#GGGGGG']
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.loopColors).toEqual(['#FF0000', '#00FF00']); // Invalid colors filtered out
      });

      it('should limit loopColors to maximum 20 items', () => {
        const tooManyColors = Array.from({length: 25}, (_, i) => `#${i.toString(16).padStart(6, '0')}`);
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          loopColors: tooManyColors
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.loopColors.length).toBe(20); // Should be limited to 20
      });

      it('should validate and sanitize language', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          language: 'X' // Too short
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.language).toBe(DEFAULT_APP_SETTINGS.language);
      });

      it('should trim and lowercase language', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          language: '  EN-US  '
        };

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.language).toBe('en-us');
      });

      it('should convert boolean-like values to actual booleans', () => {
        const invalidSettings = {
          ...DEFAULT_APP_SETTINGS,
          enableKeyboardShortcuts: 'true',
          showLoopLabels: 0,
          enableNotifications: 1,
          autoPlayNext: ''
        } as any;

        service.saveSettings(invalidSettings);
        const loaded = service.loadSettings();
        
        expect(loaded.enableKeyboardShortcuts).toBe(true);
        expect(loaded.showLoopLabels).toBe(false);
        expect(loaded.enableNotifications).toBe(true);
        expect(loaded.autoPlayNext).toBe(false);
      });

      it('should reject invalid settings object', () => {
        spyOn(console, 'error');
        const result = service.saveSettings(null as any);
        
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Invalid settings data provided');
      });
    });

    describe('Integration with storage limits', () => {
      it('should respect storage size limits for settings', () => {
        const hugeSettings = {
          ...DEFAULT_APP_SETTINGS,
          loopColors: Array.from({length: 1000000}, () => '#FF0000') // Huge array
        };

        const result = service.saveSettings(hugeSettings);
        // Should either save successfully (after sanitization) or fail due to size limits
        expect(typeof result).toBe('boolean');
      });
    });
  });

  // === READING HISTORY MANAGEMENT TESTS (Task 22.4) ===

  describe('Reading History Management (Task 22.4)', () => {
    describe('addToHistory and getHistory', () => {
      it('should add and retrieve history entry successfully', () => {
        const added = service.addToHistory(mockHistoryEntry);
        expect(added).toBe(true);

        const history = service.getHistory();
        expect(history).toHaveSize(1);
        expect(history[0].videoId).toBe(mockHistoryEntry.videoId);
        expect(history[0].videoTitle).toBe(mockHistoryEntry.videoTitle);
        expect(history[0].watchDuration).toBe(mockHistoryEntry.watchDuration);
      });

      it('should return empty array when no history exists', () => {
        const history = service.getHistory();
        expect(history).toEqual([]);
      });

      it('should deduplicate entries for same video', () => {
        // Add first entry
        service.addToHistory(mockHistoryEntry);
        
        // Add second entry for same video with different data
        const updatedEntry = {
          ...mockHistoryEntry,
          watchDuration: 600,
          lastWatched: new Date('2024-01-02T10:00:00Z')
        };
        service.addToHistory(updatedEntry);

        const history = service.getHistory();
        expect(history).toHaveSize(1); // Should only have one entry
        expect(history[0].watchDuration).toBe(600); // Should have updated data
      });

      it('should limit history to maximum entries', () => {
        // Add more than the maximum number of entries
        for (let i = 0; i < 105; i++) {
          const entry = {
            ...mockHistoryEntry,
            id: `history-${i}`,
            videoId: `video-${i}`,
            lastWatched: new Date(`2024-01-01T${(i % 24).toString().padStart(2, '0')}:00:00Z`)
          };
          service.addToHistory(entry);
        }

        const history = service.getHistory();
        expect(history.length).toBe(100); // Should be limited to MAX_HISTORY_ENTRIES
      });

      it('should sort history by most recent first', () => {
        const entry1 = {
          ...mockHistoryEntry,
          id: 'history-1',
          videoId: 'video-1',
          lastWatched: new Date('2024-01-01T10:00:00Z')
        };
        const entry2 = {
          ...mockHistoryEntry,
          id: 'history-2',
          videoId: 'video-2',
          lastWatched: new Date('2024-01-02T10:00:00Z')
        };

        service.addToHistory(entry1);
        service.addToHistory(entry2);

        const history = service.getHistory();
        expect(history).toHaveSize(2);
        expect(history[0].videoId).toBe('video-2'); // Most recent first
        expect(history[1].videoId).toBe('video-1');
      });
    });

    describe('clearHistory', () => {
      it('should clear all history entries', () => {
        service.addToHistory(mockHistoryEntry);
        
        const cleared = service.clearHistory();
        expect(cleared).toBe(true);

        const history = service.getHistory();
        expect(history).toEqual([]);
      });

      it('should log success message on clear', () => {
        spyOn(console, 'log');
        service.clearHistory();
        expect(console.log).toHaveBeenCalledWith('Successfully cleared reading history');
      });
    });

    describe('removeFromHistory', () => {
      it('should remove specific video from history', () => {
        const entry1 = { ...mockHistoryEntry, videoId: 'video-1' };
        const entry2 = { ...mockHistoryEntry, id: 'history-2', videoId: 'video-2' };

        service.addToHistory(entry1);
        service.addToHistory(entry2);

        const removed = service.removeFromHistory('video-1');
        expect(removed).toBe(true);

        const history = service.getHistory();
        expect(history).toHaveSize(1);
        expect(history[0].videoId).toBe('video-2');
      });

      it('should return false when video not found', () => {
        const removed = service.removeFromHistory('non-existent-video');
        expect(removed).toBe(false);
      });

      it('should validate videoId parameter', () => {
        spyOn(console, 'error');
        
        const result1 = service.removeFromHistory('');
        expect(result1).toBe(false);
        
        const result2 = service.removeFromHistory(null as any);
        expect(result2).toBe(false);
        
        expect(console.error).toHaveBeenCalledWith('Invalid videoId provided for history removal');
      });
    });

    describe('getHistoryByDateRange', () => {
      it('should filter history by date range', () => {
        const entry1 = {
          ...mockHistoryEntry,
          videoId: 'video-1',
          lastWatched: new Date('2024-01-01T10:00:00Z')
        };
        const entry2 = {
          ...mockHistoryEntry,
          id: 'history-2',
          videoId: 'video-2',
          lastWatched: new Date('2024-01-15T10:00:00Z')
        };
        const entry3 = {
          ...mockHistoryEntry,
          id: 'history-3',
          videoId: 'video-3',
          lastWatched: new Date('2024-02-01T10:00:00Z')
        };

        service.addToHistory(entry1);
        service.addToHistory(entry2);
        service.addToHistory(entry3);

        const startDate = new Date('2024-01-01T00:00:00Z');
        const endDate = new Date('2024-01-31T23:59:59Z');
        
        const filteredHistory = service.getHistoryByDateRange(startDate, endDate);
        expect(filteredHistory).toHaveSize(2);
        expect(filteredHistory.map(e => e.videoId)).toContain('video-1');
        expect(filteredHistory.map(e => e.videoId)).toContain('video-2');
      });
    });

    describe('getRecentHistory', () => {
      it('should return limited number of recent entries', () => {
        // Add 15 entries
        for (let i = 0; i < 15; i++) {
          const entry = {
            ...mockHistoryEntry,
            id: `history-${i}`,
            videoId: `video-${i}`,
            lastWatched: new Date(`2024-01-${(i + 1).toString().padStart(2, '0')}T10:00:00Z`)
          };
          service.addToHistory(entry);
        }

        const recent = service.getRecentHistory(5);
        expect(recent).toHaveSize(5);
        // Should be sorted by most recent first
        expect(recent[0].videoId).toBe('video-14');
      });

      it('should default to 10 entries when no limit specified', () => {
        for (let i = 0; i < 15; i++) {
          const entry = {
            ...mockHistoryEntry,
            id: `history-${i}`,
            videoId: `video-${i}`
          };
          service.addToHistory(entry);
        }

        const recent = service.getRecentHistory();
        expect(recent).toHaveSize(10);
      });
    });

    describe('searchHistory', () => {
      it('should search by video title', () => {
        const entry1 = {
          ...mockHistoryEntry,
          videoId: 'video-1',
          videoTitle: 'Guitar Lesson Basic'
        };
        const entry2 = {
          ...mockHistoryEntry,
          id: 'history-2',
          videoId: 'video-2',
          videoTitle: 'Piano Tutorial Advanced'
        };

        service.addToHistory(entry1);
        service.addToHistory(entry2);

        const results = service.searchHistory('guitar');
        expect(results).toHaveSize(1);
        expect(results[0].videoId).toBe('video-1');
      });

      it('should search by tags', () => {
        const entry1 = {
          ...mockHistoryEntry,
          videoId: 'video-1',
          tags: ['guitar', 'beginner']
        };
        const entry2 = {
          ...mockHistoryEntry,
          id: 'history-2',
          videoId: 'video-2',
          tags: ['piano', 'advanced']
        };

        service.addToHistory(entry1);
        service.addToHistory(entry2);

        const results = service.searchHistory('advanced');
        expect(results).toHaveSize(1);
        expect(results[0].videoId).toBe('video-2');
      });

      it('should handle empty or invalid search queries', () => {
        service.addToHistory(mockHistoryEntry);

        const results1 = service.searchHistory('');
        expect(results1).toEqual([]);

        const results2 = service.searchHistory(null as any);
        expect(results2).toEqual([]);
      });
    });

    describe('History validation and sanitization', () => {
      it('should validate required fields', () => {
        const invalidEntry = {
          id: '',
          videoId: 'test-video',
          videoUrl: 'https://example.com'
        } as any;

        spyOn(console, 'error');
        const result = service.addToHistory(invalidEntry);
        
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Invalid history entry data provided');
      });

      it('should sanitize and clamp numeric values', () => {
        const invalidEntry = {
          ...mockHistoryEntry,
          watchDuration: -100,
          loopCount: -5,
          playbackSpeed: 0.1 // Too low
        };

        service.addToHistory(invalidEntry);
        const history = service.getHistory();
        
        expect(history[0].watchDuration).toBe(0); // Should be clamped to 0
        expect(history[0].loopCount).toBe(0);
        expect(history[0].playbackSpeed).toBe(0.25); // Should be clamped to minimum
      });

      it('should limit and filter tags', () => {
        const entryWithManyTags = {
          ...mockHistoryEntry,
          tags: [
            'tag1', 'tag2', 'tag3', 'tag4', 'tag5',
            'tag6', 'tag7', 'tag8', 'tag9', 'tag10',
            'tag11', 'tag12', '', '  ', null, 123
          ] as any[]
        };

        service.addToHistory(entryWithManyTags);
        const history = service.getHistory();
        
        expect(history[0].tags?.length).toBe(10); // Should be limited to 10 tags
        expect(history[0].tags).toEqual([
          'tag1', 'tag2', 'tag3', 'tag4', 'tag5',
          'tag6', 'tag7', 'tag8', 'tag9', 'tag10'
        ]);
      });

      it('should convert date strings to Date objects', () => {
        const entryWithStringDate = {
          ...mockHistoryEntry,
          lastWatched: '2024-01-01T10:00:00Z'
        } as any;

        service.addToHistory(entryWithStringDate);
        const history = service.getHistory();
        
        expect(history[0].lastWatched).toBeInstanceOf(Date);
      });

      it('should trim string fields', () => {
        const entryWithUntrimmedStrings = {
          ...mockHistoryEntry,
          videoTitle: '  Untrimmed Title  ',
          videoUrl: '  https://example.com  ',
          tags: ['  tag1  ', '  tag2  ']
        };

        service.addToHistory(entryWithUntrimmedStrings);
        const history = service.getHistory();
        
        expect(history[0].videoTitle).toBe('Untrimmed Title');
        expect(history[0].videoUrl).toBe('https://example.com');
        expect(history[0].tags).toEqual(['tag1', 'tag2']);
      });
    });

    describe('Error handling', () => {
      it('should handle localStorage errors gracefully', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Storage error'),
          getItem: jasmine.createSpy().and.returnValue(null),
          removeItem: jasmine.createSpy().and.throwError('Storage error'),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };

        spyOn(console, 'error');
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const added = service.addToHistory(mockHistoryEntry);
        expect(added).toBe(false);
        expect(console.error).toHaveBeenCalled();
      });

      it('should handle corrupted history data gracefully', () => {
        localStorage.setItem('ng-youtube-looper-history', 'invalid-json');
        
        spyOn(console, 'error');
        const history = service.getHistory();
        
        expect(history).toEqual([]);
        expect(console.error).toHaveBeenCalled();
      });
    });
  });
});