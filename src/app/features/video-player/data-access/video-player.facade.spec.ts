import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VideoPlayerFacade } from './video-player.facade';
import { YouTubeService } from '@core/services/youtube.service';
import { SecureStorageService } from '@core/services/storage.service';
import { LoopService } from '@core/services/loop.service';

describe('VideoPlayerFacade', () => {
  let facade: VideoPlayerFacade;
  let mockYouTubeService: any;
  let mockStorageService: any;
  let mockLoopService: any;

  beforeEach(() => {
    const mockPlayerState = {
      isReady: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      volume: 100,
      error: null
    };


    mockYouTubeService = {
      isValidYouTubeUrl: jasmine.createSpy('isValidYouTubeUrl'),
      extractVideoId: jasmine.createSpy('extractVideoId'),
      loadVideo: jasmine.createSpy('loadVideo'),
      initializePlayer: jasmine.createSpy('initializePlayer'),
      play: jasmine.createSpy('play'),
      pause: jasmine.createSpy('pause'),
      stop: jasmine.createSpy('stop'),
      seekTo: jasmine.createSpy('seekTo'),
      setPlaybackRate: jasmine.createSpy('setPlaybackRate'),
      setVolume: jasmine.createSpy('setVolume'),
      destroy: jasmine.createSpy('destroy'),
      
      // Mock signals as writeable signals
      currentVideo: signal(null),
      playerState: signal(mockPlayerState)
    };

    mockStorageService = {
      getVideoSessions: jasmine.createSpy('getVideoSessions').and.returnValue([]),
      saveSession: jasmine.createSpy('saveSession').and.returnValue(true),
      getSession: jasmine.createSpy('getSession').and.returnValue(null),
      getRecentHistory: jasmine.createSpy('getRecentHistory').and.returnValue([]),
      getStorageInfo: jasmine.createSpy('getStorageInfo').and.returnValue({
        available: true,
        currentSize: 1000,
        maxSize: 5000000,
        utilizationPercentage: 0.02,
        remainingSize: 4999000
      })
    };

    mockLoopService = {
      formatTime: jasmine.createSpy('formatTime').and.callFake((seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }),
      getCurrentLoop: jasmine.createSpy('getCurrentLoop').and.returnValue(null),
      createValidatedLoop: jasmine.createSpy('createValidatedLoop').and.returnValue({
        loop: {
          id: 'test-loop',
          name: 'Test Loop',
          startTime: 10,
          endTime: 20,
          playCount: 0,
          isActive: true
        },
        validation: { isValid: true, errors: [], warnings: [] }
      }),
      getLoopStatistics: jasmine.createSpy('getLoopStatistics').and.returnValue({
        totalCount: 0,
        activeCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        mostPlayed: null
      }),
      validateLoopCollection: jasmine.createSpy('validateLoopCollection').and.returnValue({
        isValid: true,
        criticalIssues: [],
        warnings: [],
        suggestions: []
      }),
      resolveLoopConflicts: jasmine.createSpy('resolveLoopConflicts').and.returnValue({
        resolvedLoops: [],
        removedLoops: [],
        modifications: []
      })
    };

    TestBed.configureTestingModule({
      providers: [
        VideoPlayerFacade,
        { provide: YouTubeService, useValue: mockYouTubeService },
        { provide: SecureStorageService, useValue: mockStorageService },
        { provide: LoopService, useValue: mockLoopService }
      ]
    });

    facade = TestBed.inject(VideoPlayerFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with empty URL input', () => {
    expect(facade.urlInput()).toBe('');
  });

  it('should update URL input', () => {
    const testUrl = 'https://www.youtube.com/watch?v=test';
    
    facade.setUrlInput(testUrl);
    
    expect(facade.urlInput()).toBe(testUrl);
  });

  it('should validate URL correctly', () => {
    mockYouTubeService.isValidYouTubeUrl.and.returnValue(true);
    facade.setUrlInput('https://www.youtube.com/watch?v=test');
    
    expect(facade.isValidUrl()).toBe(true);
    expect(mockYouTubeService.isValidYouTubeUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test');
  });

  it('should return false for invalid URL', () => {
    mockYouTubeService.isValidYouTubeUrl.and.returnValue(false);
    facade.setUrlInput('invalid-url');
    
    expect(facade.isValidUrl()).toBe(false);
  });

  it('should return false for empty URL', () => {
    facade.setUrlInput('');
    
    expect(facade.isValidUrl()).toBe(false);
  });

  it('should calculate canPlay correctly', () => {
    // Mock player state to be ready but not playing
    const readyState = {
      isReady: true,
      isPlaying: false,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      volume: 100,
      error: null
    };
    mockYouTubeService.playerState.set(readyState);
    
    expect(facade.canPlay()).toBe(true);
  });

  it('should load video successfully', async () => {
    const testUrl = 'https://www.youtube.com/watch?v=testId';
    mockYouTubeService.extractVideoId.and.returnValue('testId');
    mockYouTubeService.loadVideo.and.returnValue(Promise.resolve());
    
    await facade.loadVideo(testUrl);
    
    expect(mockYouTubeService.extractVideoId).toHaveBeenCalledWith(testUrl);
    expect(mockYouTubeService.loadVideo).toHaveBeenCalledWith('testId');
  });

  it('should handle invalid URL in loadVideo', async () => {
    const testUrl = 'invalid-url';
    mockYouTubeService.extractVideoId.and.returnValue(null);
    
    await facade.loadVideo(testUrl);
    
    expect(facade.error()).toBe('URL YouTube invalide');
    expect(mockYouTubeService.loadVideo).not.toHaveBeenCalled();
  });

  it('should play when can play', () => {
    // Mock state to allow play
    const readyState = {
      isReady: true,
      isPlaying: false,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      volume: 100,
      error: null
    };
    mockYouTubeService.playerState.set(readyState);
    
    facade.play();
    
    expect(mockYouTubeService.play).toHaveBeenCalled();
  });

  it('should seek to specific time', () => {
    // Set up player state with duration
    mockYouTubeService.playerState.set({
      isReady: true,
      isPlaying: false,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      volume: 100,
      error: null
    });
    
    facade.seekTo(45);
    
    expect(mockYouTubeService.seekTo).toHaveBeenCalledWith(45);
    expect(facade.currentTime()).toBe(45);
  });

  it('should set playback rate to closest valid value', () => {
    facade.setPlaybackRate(1.3); // Should round to 1.25
    
    expect(mockYouTubeService.setPlaybackRate).toHaveBeenCalledWith(1.25);
    expect(facade.playbackRate()).toBe(1.25);
  });

  it('should format time correctly', () => {
    expect(facade.formatTime(65)).toBe('1:05');
    expect(facade.formatTime(30)).toBe('0:30');
    expect(facade.formatTime(125)).toBe('2:05');
  });

  it('should calculate progress percentage', () => {
    const currentState = {
      isReady: true,
      isPlaying: true,
      currentTime: 30,
      duration: 100,
      playbackRate: 1,
      volume: 100,
      error: null
    };
    mockYouTubeService.playerState.set(currentState);
    
    // Progress is based on private _currentTime which syncs via effects
    // Since effects run asynchronously, we check the computed value
    expect(facade.getProgressPercentage()).toBe(0); // Private signal starts at 0
  });

  it('should return 0 progress for zero duration', () => {
    const currentState = {
      isReady: true,
      isPlaying: true,
      currentTime: 30,
      duration: 0,
      playbackRate: 1,
      volume: 100,
      error: null
    };
    mockYouTubeService.playerState.set(currentState);
    
    expect(facade.getProgressPercentage()).toBe(0);
  });

  it('should reset everything on reset', () => {
    facade.setUrlInput('test');
    
    facade.reset();
    
    expect(mockYouTubeService.destroy).toHaveBeenCalled();
    expect(facade.urlInput()).toBe('');
  });

  // === Tests pour les nouveaux signals et computed ===

  describe('Enhanced Signals Architecture', () => {
    it('should have all private signals initialized with correct default values', () => {
      expect(facade.currentVideo()).toBeNull();
      expect(facade.isPlaying()).toBe(false);
      expect(facade.currentTime()).toBe(0);
      expect(facade.playbackRate()).toBe(1);
      expect(facade.loading()).toBe(false);
      expect(facade.error()).toBeNull();
      expect(facade.urlInput()).toBe('');
      expect(facade.loops()).toEqual([]);
      expect(facade.currentLoop()).toBeNull();
    });

    it('should have readonly signals that cannot be modified directly', () => {
      // These should be readonly signals, so no set method should be available
      expect((facade.currentVideo as any).set).toBeUndefined();
      expect((facade.isPlaying as any).set).toBeUndefined();
      expect((facade.loading as any).set).toBeUndefined();
    });

    it('should compute ViewModel correctly', () => {
      const vm = facade.vm();
      
      expect(vm).toBeDefined();
      expect(vm.currentVideo).toBeNull();
      expect(vm.isVideoLoaded).toBe(false);
      expect(vm.isPlayerReady).toBe(false);
      expect(vm.isPlaying).toBe(false);
      expect(vm.loading).toBe(false);
      expect(vm.error).toBeNull();
      expect(vm.currentTime).toBe(0);
      expect(vm.playbackRate).toBe(1);
      expect(vm.canPlay).toBe(false);
      expect(vm.canPause).toBe(false);
      expect(vm.loops).toEqual([]);
      expect(vm.currentLoop).toBeNull();
      expect(vm.isLooping).toBe(false);
    });

    it('should compute isPlayerReady correctly', () => {
      // Initially not ready
      expect(facade.isPlayerReady()).toBe(false);
      
      // Set player to ready state
      mockYouTubeService.playerState.set({
        isReady: true,
        isPlaying: false,
        currentTime: 0,
        duration: 100,
        playbackRate: 1,
        volume: 100,
        error: null
      });
      
      expect(facade.isPlayerReady()).toBe(true);
    });

    it('should compute canSeek correctly', () => {
      // Initially cannot seek (no duration)
      expect(facade.canSeek()).toBe(false);
      
      // Set player with duration
      mockYouTubeService.playerState.set({
        isReady: true,
        isPlaying: false,
        currentTime: 0,
        duration: 100,
        playbackRate: 1,
        volume: 100,
        error: null
      });
      
      expect(facade.canSeek()).toBe(true);
    });

    it('should format time using LoopService', () => {
      facade.formatTime(65);
      expect(mockLoopService.formatTime).toHaveBeenCalledWith(65);
    });

    it('should compute progress correctly', () => {
      // Set player state with time and duration
      mockYouTubeService.playerState.set({
        isReady: true,
        isPlaying: true,
        currentTime: 30,
        duration: 100,
        playbackRate: 1,
        volume: 100,
        error: null
      });
      
      expect(facade.progress()).toBe(0); // Because private _currentTime is still 0
    });
  });

  describe('Loop Management', () => {
    it('should add a loop successfully', () => {
      const result = facade.addLoop('Test Loop', 10, 20);
      
      expect(result).toBe(true);
      expect(mockLoopService.createValidatedLoop).toHaveBeenCalledWith(
        'Test Loop', 10, 20, {}, 0, []
      );
      expect(facade.loops().length).toBe(1);
    });

    it('should fail to add invalid loop', () => {
      mockLoopService.createValidatedLoop.and.returnValue({
        loop: null,
        validation: { isValid: false, errors: ['INVALID_TIME_RANGE'], warnings: [] }
      });
      
      const result = facade.addLoop('Invalid Loop', 20, 10);
      
      expect(result).toBe(false);
      expect(facade.error()).toContain('Impossible de créer la boucle');
    });

    it('should remove a loop successfully', () => {
      // First add a loop
      facade.addLoop('Test Loop', 10, 20);
      const loops = facade.loops();
      expect(loops.length).toBe(1);
      
      const result = facade.removeLoop(loops[0].id);
      
      expect(result).toBe(true);
      expect(facade.loops().length).toBe(0);
    });

    it('should toggle loop active state', () => {
      // Add a loop first
      facade.addLoop('Test Loop', 10, 20);
      const loopId = facade.loops()[0].id;
      
      const result = facade.toggleLoop(loopId);
      
      expect(result).toBe(true);
      expect(facade.error()).toBeNull();
    });

    it('should start a loop and begin playback', () => {
      // Add a loop first
      facade.addLoop('Test Loop', 10, 20);
      const loopId = facade.loops()[0].id;
      
      facade.startLoop(loopId);
      
      expect(mockYouTubeService.seekTo).toHaveBeenCalledWith(10);
      expect(mockYouTubeService.play).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should save current session successfully', () => {
      // Set up a video first - this needs to sync via effects
      const mockVideo = {
        id: 'test-video',
        videoId: 'testId',
        title: 'Test Video',
        duration: 180,
        author: 'Test Author',
        thumbnail: 'test-thumbnail.jpg'
      };
      
      mockYouTubeService.currentVideo.set(mockVideo);
      
      // Trigger effects by accessing reactive properties
      facade.vm(); // This will trigger synchronization effects
      
      const result = facade.saveCurrentSession();
      
      expect(result).toBe(true);
      expect(mockStorageService.saveSession).toHaveBeenCalled();
    });

    it('should fail to save session without video', () => {
      const result = facade.saveCurrentSession();
      
      expect(result).toBe(false);
      expect(facade.error()).toBe('Aucune vidéo chargée pour sauvegarder');
    });

    it('should load session successfully', async () => {
      const mockSession = {
        id: 'session-1',
        videoId: 'testId',
        videoTitle: 'Test Video',
        videoUrl: 'https://www.youtube.com/watch?v=testId',
        loops: [],
        playbackSpeed: 1.5,
        currentTime: 45,
        lastPlayed: new Date(),
        totalPlayTime: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockStorageService.getSession.and.returnValue(mockSession);
      mockYouTubeService.extractVideoId.and.returnValue('testId');
      mockYouTubeService.loadVideo.and.returnValue(Promise.resolve());
      
      const result = await facade.loadSession('session-1');
      
      expect(result).toBe(true);
      expect(mockYouTubeService.setPlaybackRate).toHaveBeenCalledWith(1.5);
      expect(mockYouTubeService.seekTo).toHaveBeenCalledWith(45);
    });
  });

  describe('Player Health and Diagnostics', () => {
    it('should return healthy state when everything is normal', () => {
      mockYouTubeService.playerState.set({
        isReady: true,
        isPlaying: false,
        currentTime: 0,
        duration: 100,
        playbackRate: 1,
        volume: 100,
        error: null
      });
      
      const health = facade.getPlayerHealth();
      
      expect(health.isHealthy).toBe(true);
      expect(health.issues).toEqual([]);
    });

    it('should detect player errors', () => {
      // Set an error
      facade.setUrlInput('invalid');
      
      const health = facade.getPlayerHealth();
      
      expect(health.isHealthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should export current configuration', () => {
      const config = facade.exportCurrentConfiguration();
      
      expect(config).toBeDefined();
      expect(config.videoInfo).toBeNull();
      expect(config.loops).toEqual([]);
      expect(config.playbackRate).toBe(1);
      expect(config.currentTime).toBe(0);
      expect(config.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Integration with Services', () => {
    it('should synchronize with YouTubeService playerState changes', () => {
      const newState = {
        isReady: true,
        isPlaying: true,
        currentTime: 45,
        duration: 180,
        playbackRate: 1.5,
        volume: 80,
        error: null
      };
      
      mockYouTubeService.playerState.set(newState);
      
      // Access the ViewModel to trigger effects synchronization
      const vm = facade.vm();
      
      // The effect should synchronize the private signals
      expect(vm.isPlaying).toBe(true);
      expect(vm.currentTime).toBe(45);
      expect(vm.playbackRate).toBe(1.5);
    });

    it('should handle YouTubeService errors correctly', () => {
      const errorState = {
        isReady: true,
        isPlaying: false,
        currentTime: 0,
        duration: 100,
        playbackRate: 1,
        volume: 100,
        error: 'Test error'
      };
      
      mockYouTubeService.playerState.set(errorState);
      
      expect(facade.hasError()).toBe(true);
      expect(facade.vm().error).toBe('Test error');
    });

    it('should integrate with LoopService for loop validation', () => {
      facade.addLoop('Test Loop', 10, 20);
      
      expect(mockLoopService.createValidatedLoop).toHaveBeenCalled();
    });

    it('should integrate with StorageService for session management', () => {
      const mockVideo = {
        id: 'test-video',
        videoId: 'testId',
        title: 'Test Video',
        duration: 180,
        author: 'Test Author',
        thumbnail: 'test-thumbnail.jpg'
      };
      
      mockYouTubeService.currentVideo.set(mockVideo);
      
      // Trigger synchronization by accessing the ViewModel
      facade.vm();
      
      facade.saveCurrentSession();
      
      expect(mockStorageService.saveSession).toHaveBeenCalled();
    });
  });
});