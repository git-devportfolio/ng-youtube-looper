import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VideoPlayerFacade } from './video-player.facade';
import { YouTubeService } from '@core/services/youtube.service';

describe('VideoPlayerFacade', () => {
  let facade: VideoPlayerFacade;
  let mockYouTubeService: any; // Use any to avoid TypeScript strict checks

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

    TestBed.configureTestingModule({
      providers: [
        VideoPlayerFacade,
        { provide: YouTubeService, useValue: mockYouTubeService }
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
    spyOn(console, 'warn');
    
    await facade.loadVideo(testUrl);
    
    expect(console.warn).toHaveBeenCalledWith('URL YouTube invalide:', testUrl);
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
    facade.seekTo(45);
    
    expect(mockYouTubeService.seekTo).toHaveBeenCalledWith(45);
  });

  it('should set playback rate to closest valid value', () => {
    facade.setPlaybackRate(1.3); // Should round to 1.25
    
    expect(mockYouTubeService.setPlaybackRate).toHaveBeenCalledWith(1.25);
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
    
    expect(facade.getProgressPercentage()).toBe(30);
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
});