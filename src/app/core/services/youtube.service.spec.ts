import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { YouTubeService } from './youtube.service';

describe('YouTubeService', () => {
  let service: YouTubeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    
    // Mock window.YT pour éviter le chargement réel de l'API
    (window as any).YT = {
      Player: jasmine.createSpy('Player').and.returnValue({
        loadVideoById: jasmine.createSpy('loadVideoById'),
        playVideo: jasmine.createSpy('playVideo'),
        pauseVideo: jasmine.createSpy('pauseVideo'),
        stopVideo: jasmine.createSpy('stopVideo'),
        seekTo: jasmine.createSpy('seekTo'),
        setPlaybackRate: jasmine.createSpy('setPlaybackRate'),
        setVolume: jasmine.createSpy('setVolume'),
        getCurrentTime: jasmine.createSpy('getCurrentTime').and.returnValue(0),
        getDuration: jasmine.createSpy('getDuration').and.returnValue(100),
        getPlaybackRate: jasmine.createSpy('getPlaybackRate').and.returnValue(1),
        getVolume: jasmine.createSpy('getVolume').and.returnValue(100),
        getVideoData: jasmine.createSpy('getVideoData').and.returnValue({
          title: 'Test Video',
          author: 'Test Author'
        }),
        destroy: jasmine.createSpy('destroy')
      }),
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5
      }
    };
    
    service = TestBed.inject(YouTubeService);
  });

  afterEach(() => {
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('extractVideoId', () => {
    it('should extract video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from short YouTube URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from mobile URL', () => {
      const url = 'https://m.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should handle direct video ID', () => {
      const videoId = 'dQw4w9WgXcQ';
      expect(service.extractVideoId(videoId)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://www.example.com/video';
      expect(service.extractVideoId(url)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(service.extractVideoId('')).toBeNull();
    });

    it('should handle URL with additional parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s';
      expect(service.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });
  });

  describe('isValidYouTubeUrl', () => {
    it('should return true for valid YouTube URL', () => {
      expect(service.isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for invalid URL', () => {
      expect(service.isValidYouTubeUrl('https://www.example.com')).toBe(false);
    });
  });

  describe('state management', () => {
    it('should initialize with default state', () => {
      const state = service.playerState();
      expect(state.isReady).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.playbackRate).toBe(1);
      expect(state.volume).toBe(100);
      expect(state.error).toBe(null);
    });
  });

  describe('getters without initialized player', () => {
    it('should return defaults when player is not initialized', () => {
      expect(service.getCurrentTime()).toBe(0);
      expect(service.getDuration()).toBe(0);
      expect(service.getPlaybackRate()).toBe(1);
      expect(service.getVolume()).toBe(100);
    });
  });

  describe('platform check', () => {
    it('should throw error when not in browser environment', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PLATFORM_ID, useValue: 'server' }
        ]
      });
      
      const serverService = TestBed.inject(YouTubeService);
      
      try {
        await serverService.initializePlayer('test-player', 'dQw4w9WgXcQ');
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('YouTube player can only be initialized in browser environment');
      }
    });
  });

  describe('video info', () => {
    it('should return null when player is not ready', async () => {
      const videoInfo = await service.getVideoInfo('dQw4w9WgXcQ');
      expect(videoInfo).toBeNull();
    });
  });

  describe('controls without player', () => {
    it('should handle play when player is not initialized', () => {
      expect(() => service.play()).not.toThrow();
    });

    it('should handle pause when player is not initialized', () => {
      expect(() => service.pause()).not.toThrow();
    });

    it('should handle stop when player is not initialized', () => {
      expect(() => service.stop()).not.toThrow();
    });

    it('should handle seekTo when player is not initialized', () => {
      expect(() => service.seekTo(30)).not.toThrow();
    });

    it('should handle setPlaybackRate when player is not initialized', () => {
      expect(() => service.setPlaybackRate(0.5)).not.toThrow();
    });

    it('should handle setVolume when player is not initialized', () => {
      expect(() => service.setVolume(75)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should reset state when destroy is called', () => {
      service.destroy();
      
      const state = service.playerState();
      expect(state.isReady).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(service.currentVideo()).toBe(null);
    });
  });
});