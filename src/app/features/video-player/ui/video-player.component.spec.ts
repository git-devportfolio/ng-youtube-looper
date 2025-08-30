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
});