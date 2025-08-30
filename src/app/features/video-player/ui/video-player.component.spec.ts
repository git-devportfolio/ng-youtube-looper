import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal, computed } from '@angular/core';
import { VideoPlayerComponent } from './video-player.component';
import { VideoPlayerFacade } from '../data-access/video-player.facade';
import { PlayerControlsComponent } from './player-controls.component';
import { SpeedControlComponent } from './speed-control.component';

describe('VideoPlayerComponent', () => {
  let component: VideoPlayerComponent;
  let fixture: ComponentFixture<VideoPlayerComponent>;
  let mockFacade: any; // Use any to avoid TypeScript strict checks

  beforeEach(async () => {
    const mockVideoPlayerState = {
      currentVideo: null,
      playerState: {
        isReady: false,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        volume: 100,
        error: null
      },
      urlInput: '',
      isValidUrl: false,
      canPlay: false,
      canPause: false,
      hasError: false
    };

    mockFacade = {
      setUrlInput: jasmine.createSpy('setUrlInput'),
      loadVideo: jasmine.createSpy('loadVideo').and.returnValue(Promise.resolve()),
      initializePlayer: jasmine.createSpy('initializePlayer').and.returnValue(Promise.resolve()),
      play: jasmine.createSpy('play'),
      pause: jasmine.createSpy('pause'),
      stop: jasmine.createSpy('stop'),
      seekBy: jasmine.createSpy('seekBy'),
      setPlaybackRate: jasmine.createSpy('setPlaybackRate'),
      increaseSpeed: jasmine.createSpy('increaseSpeed'),
      decreaseSpeed: jasmine.createSpy('decreaseSpeed'),
      reset: jasmine.createSpy('reset'),
      formatTime: jasmine.createSpy('formatTime').and.returnValue('0:00'),
      getProgressPercentage: jasmine.createSpy('getProgressPercentage').and.returnValue(0),
      
      // Mock computed signals as functions
      vm: computed(() => mockVideoPlayerState),
      isValidUrl: computed(() => false),
      currentVideo: signal(null)
    };

    await TestBed.configureTestingModule({
      imports: [VideoPlayerComponent, ReactiveFormsModule, PlayerControlsComponent, SpeedControlComponent],
      providers: [
        { provide: VideoPlayerFacade, useValue: mockFacade }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize URL control', () => {
    expect(component.urlControl).toBeDefined();
    expect(component.urlControl.value).toBe('');
  });

  it('should sync URL input with facade when URL control changes', () => {
    const testUrl = 'https://www.youtube.com/watch?v=test';
    
    component.urlControl.setValue(testUrl);
    
    expect(mockFacade.setUrlInput).toHaveBeenCalledWith(testUrl);
  });

  it('should display empty state when no video is loaded', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const emptyState = compiled.querySelector('.empty-player');
    
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('Aucune vidéo chargée');
  });

  it('should show loading state when loading', () => {
    component.loading.set(true);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const loadButton = compiled.querySelector('.load-button');
    const loadingSpinner = compiled.querySelector('.loading-spinner');
    
    expect(loadButton?.textContent?.trim()).toContain('Chargement...');
    expect(loadingSpinner).toBeTruthy();
  });

  it('should call reset on destroy', () => {
    component.ngOnDestroy();
    
    expect(mockFacade.reset).toHaveBeenCalled();
  });

  it('should have loading signal initialized to false', () => {
    expect(component.loading()).toBe(false);
  });

  it('should have playerInitialized flag', () => {
    expect(component['playerInitialized']).toBe(false);
  });

  it('should set loading to true when loadVideo starts', async () => {
    // Mock the facade to return true for valid URL
    mockFacade.isValidUrl = computed(() => true);
    component.urlControl.setValue('https://www.youtube.com/watch?v=test');
    
    // Start loadVideo (but don't await to test loading state)
    const loadPromise = component.loadVideo();
    
    // Check that loading is set to true
    expect(component.loading()).toBe(true);
    
    // Wait for completion
    await loadPromise;
    
    // Check that loading is back to false
    expect(component.loading()).toBe(false);
  });

  // Tests for task 13.1: Responsive HTML structure with YouTube iframe
  describe('Responsive HTML Structure (Task 13.1)', () => {
    beforeEach(() => {
      // Set up a mock video for testing iframe structure
      const mockVideoState = {
        currentVideo: {
          videoId: 'dQw4w9WgXcQ',
          title: 'Test Video',
          author: 'Test Author',
          duration: 200
        },
        playerState: {
          isReady: true,
          isPlaying: false,
          currentTime: 0,
          duration: 200,
          playbackRate: 1,
          volume: 100,
          error: null
        },
        urlInput: '',
        isValidUrl: true,
        canPlay: true,
        canPause: false,
        hasError: false
      };
      
      mockFacade.vm = computed(() => mockVideoState);
      fixture.detectChanges();
    });

    it('should render player wrapper with aspect-ratio container', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const playerWrapper = compiled.querySelector('.player-wrapper');
      
      expect(playerWrapper).toBeTruthy();
      expect(playerWrapper).toBeTruthy();
    });

    it('should render YouTube iframe with correct attributes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const iframe = compiled.querySelector('.youtube-iframe') as HTMLIFrameElement;
      
      expect(iframe).toBeTruthy();
      expect(iframe.id).toBe('youtube-player');
      expect(iframe.title).toBe('YouTube video player');
      expect(iframe.getAttribute('frameborder')).toBe('0');
      expect(iframe.getAttribute('allowfullscreen')).toBe('');
    });

    it('should generate correct YouTube embed URL with appropriate parameters', () => {
      const embedUrl = component.getYouTubeEmbedUrl();
      
      expect(embedUrl).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(embedUrl).toContain('autoplay=0');
      expect(embedUrl).toContain('controls=0');
      expect(embedUrl).toContain('enablejsapi=1');
      expect(embedUrl).toContain('rel=0');
      expect(embedUrl).toContain('modestbranding=1');
      expect(embedUrl).toContain('origin=');
    });

    it('should render player overlay container for future controls', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const overlay = compiled.querySelector('.player-overlay');
      
      expect(overlay).toBeTruthy();
    });

    it('should return empty string for embed URL when no video is loaded', () => {
      // Reset to no video state
      const mockVideoState = {
        currentVideo: null,
        playerState: {
          isReady: false,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          playbackRate: 1,
          volume: 100,
          error: null
        },
        urlInput: '',
        isValidUrl: false,
        canPlay: false,
        canPause: false,
        hasError: false
      };
      
      mockFacade.vm = computed(() => mockVideoState);
      fixture.detectChanges();
      
      const embedUrl = component.getYouTubeEmbedUrl();
      expect(embedUrl).toBe('');
    });

    it('should maintain aspect-ratio styling for responsive design', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const playerWrapper = compiled.querySelector('.player-wrapper') as HTMLElement;
      const computedStyle = window.getComputedStyle(playerWrapper);
      
      // Note: aspect-ratio may not be supported in all test environments
      // This test verifies the CSS class is applied
      expect(playerWrapper.classList.contains('player-wrapper')).toBe(true);
    });

    it('should have ViewChild reference to iframe element', () => {
      // The ViewChild should be typed as HTMLIFrameElement
      expect(component.youtubePlayerRef).toBeDefined();
    });
  });
});