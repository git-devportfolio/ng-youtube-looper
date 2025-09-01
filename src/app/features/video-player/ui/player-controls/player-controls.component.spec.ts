import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PlayerControlsComponent } from './player-controls.component';
import { VideoPlayerViewModel } from '../../data-access/video-player.facade';
import { LoopService } from '@core/services/loop.service';

describe('PlayerControlsComponent', () => {
  let component: PlayerControlsComponent;
  let fixture: ComponentFixture<PlayerControlsComponent>;
  let mockLoopService: jasmine.SpyObj<LoopService>;

  // Mock VideoPlayerViewModel for testing
  const createMockViewModel = (overrides: Partial<VideoPlayerViewModel> = {}): VideoPlayerViewModel => ({
    // Core video information
    currentVideo: null,
    isVideoLoaded: false,
    
    // Player state
    isPlayerReady: true,
    isPlaying: false,
    loading: false,
    error: null,
    
    // Time information
    currentTime: 0,
    duration: 300,
    currentTimeFormatted: '00:00',
    durationFormatted: '05:00',
    progress: 0,
    
    // Playback controls
    playbackRate: 1,
    volume: 100,
    canPlay: true,
    canPause: false,
    canSeek: true,
    
    // Loop information
    loops: [],
    currentLoop: null,
    isLooping: false,
    
    // UI state
    urlInput: '',
    isValidUrl: false,
    hasError: false,
    
    ...overrides
  });

  beforeEach(async () => {
    const loopServiceSpy = jasmine.createSpyObj('LoopService', ['formatTime']);
    loopServiceSpy.formatTime.and.callFake((seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    });

    await TestBed.configureTestingModule({
      imports: [PlayerControlsComponent],
      providers: [
        { provide: LoopService, useValue: loopServiceSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    mockLoopService = TestBed.inject(LoopService) as jasmine.SpyObj<LoopService>;
    fixture = TestBed.createComponent(PlayerControlsComponent);
    component = fixture.componentInstance;
    
    // Set required input
    component.viewModel = createMockViewModel();
    fixture.detectChanges();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have default configuration values', () => {
      expect(component.circular).toBe(false);
      expect(component.compact).toBe(false);
      expect(component.showTimeDisplay).toBe(true);
      expect(component.showSpeedControls).toBe(true);
      expect(component.showSlider).toBe(true);
    });

    it('should require viewModel input', () => {
      expect(component.viewModel).toBeDefined();
    });
  });

  describe('Computed Properties', () => {
    it('should compute player state properties correctly', () => {
      expect(component.isPlaying()).toBe(false);
      expect(component.isLoading()).toBe(false);
      expect(component.currentTime()).toBe(0);
      expect(component.duration()).toBe(300);
      expect(component.playbackRate()).toBe(1);
      expect(component.volume()).toBe(100);
      expect(component.hasError()).toBe(false);
      expect(component.canPlay()).toBe(true);
      expect(component.canPause()).toBe(false);
      expect(component.canSeek()).toBe(true);
    });

    it('should compute control states correctly', () => {
      expect(component.controlsDisabled()).toBe(false); // isPlayerReady=true && hasError=false
      expect(component.progressPercentage()).toBe(0); // currentTime=0 / duration=300 * 100 = 0
    });

    it('should handle null viewModel gracefully', () => {
      component.viewModel = null as any;
      fixture.detectChanges();

      expect(component.isPlaying()).toBe(false);
      expect(component.currentTime()).toBe(0);
      expect(component.duration()).toBe(0);
      expect(component.canPlay()).toBe(false);
    });

    it('should calculate progress percentage correctly', () => {
      component.viewModel = createMockViewModel({
        currentTime: 150,
        duration: 300
      });
      fixture.detectChanges();

      expect(component.progressPercentage()).toBe(50);
    });

    it('should disable controls when player not ready', () => {
      component.viewModel = createMockViewModel({
        isPlayerReady: false
      });
      fixture.detectChanges();

      expect(component.controlsDisabled()).toBe(true);
    });

    it('should disable controls when has error', () => {
      component.viewModel = createMockViewModel({
        hasError: true,
        error: 'Network error'
      });
      fixture.detectChanges();

      expect(component.controlsDisabled()).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    it('should emit playRequested when play is called', () => {
      spyOn(component.playRequested, 'emit');
      
      component.play();
      
      expect(component.playRequested.emit).toHaveBeenCalled();
    });

    it('should emit pauseRequested when pause is called', () => {
      spyOn(component.pauseRequested, 'emit');
      
      component.pause();
      
      expect(component.pauseRequested.emit).toHaveBeenCalled();
    });

    it('should emit stopRequested when stop is called', () => {
      spyOn(component.stopRequested, 'emit');
      
      component.stop();
      
      expect(component.stopRequested.emit).toHaveBeenCalled();
    });

    it('should emit togglePlayPauseRequested when togglePlayPause is called', () => {
      spyOn(component.togglePlayPauseRequested, 'emit');
      
      component.togglePlayPause();
      
      expect(component.togglePlayPauseRequested.emit).toHaveBeenCalled();
    });

    it('should emit seekRequested with correct time when seekTo is called', () => {
      spyOn(component.seekRequested, 'emit');
      
      component.seekTo(120);
      
      expect(component.seekRequested.emit).toHaveBeenCalledWith(120);
    });

    it('should emit seekByRequested with -10 when seekBack is called', () => {
      spyOn(component.seekByRequested, 'emit');
      
      component.seekBack();
      
      expect(component.seekByRequested.emit).toHaveBeenCalledWith(-10);
    });

    it('should emit seekByRequested with +10 when seekForward is called', () => {
      spyOn(component.seekByRequested, 'emit');
      
      component.seekForward();
      
      expect(component.seekByRequested.emit).toHaveBeenCalledWith(10);
    });

    it('should emit playbackRateChangeRequested when setPlaybackRate is called', () => {
      spyOn(component.playbackRateChangeRequested, 'emit');
      
      component.setPlaybackRate(1.5);
      
      expect(component.playbackRateChangeRequested.emit).toHaveBeenCalledWith(1.5);
    });

    it('should emit speedIncreaseRequested when increaseSpeed is called', () => {
      spyOn(component.speedIncreaseRequested, 'emit');
      
      component.increaseSpeed();
      
      expect(component.speedIncreaseRequested.emit).toHaveBeenCalled();
    });

    it('should emit speedDecreaseRequested when decreaseSpeed is called', () => {
      spyOn(component.speedDecreaseRequested, 'emit');
      
      component.decreaseSpeed();
      
      expect(component.speedDecreaseRequested.emit).toHaveBeenCalled();
    });

    it('should emit volumeChangeRequested when setVolume is called', () => {
      spyOn(component.volumeChangeRequested, 'emit');
      
      component.setVolume(50);
      
      expect(component.volumeChangeRequested.emit).toHaveBeenCalledWith(50);
    });

    it('should emit muteRequested when mute is called', () => {
      spyOn(component.muteRequested, 'emit');
      
      component.mute();
      
      expect(component.muteRequested.emit).toHaveBeenCalled();
    });

    it('should emit seekStarted when onSeekStart is called', () => {
      spyOn(component.seekStarted, 'emit');
      
      component.onSeekStart();
      
      expect(component.seekStarted.emit).toHaveBeenCalled();
    });

    it('should emit seekEnded when onSeekEnd is called', () => {
      spyOn(component.seekEnded, 'emit');
      
      component.onSeekEnd();
      
      expect(component.seekEnded.emit).toHaveBeenCalled();
    });
  });

  describe('Template Integration', () => {
    it('should render time display when showTimeDisplay is true', () => {
      component.showTimeDisplay = true;
      fixture.detectChanges();

      const timeDisplay = fixture.nativeElement.querySelector('app-time-display');
      expect(timeDisplay).toBeTruthy();
    });

    it('should not render time display when showTimeDisplay is false', () => {
      component.showTimeDisplay = false;
      fixture.detectChanges();

      const timeDisplay = fixture.nativeElement.querySelector('app-time-display');
      expect(timeDisplay).toBeFalsy();
    });

    it('should render speed controls when showSpeedControls is true', () => {
      component.showSpeedControls = true;
      fixture.detectChanges();

      const speedControls = fixture.nativeElement.querySelector('app-speed-control');
      expect(speedControls).toBeTruthy();
    });

    it('should not render speed controls when showSpeedControls is false', () => {
      component.showSpeedControls = false;
      fixture.detectChanges();

      const speedControls = fixture.nativeElement.querySelector('app-speed-control');
      expect(speedControls).toBeFalsy();
    });

    it('should render slider when showSlider is true', () => {
      component.showSlider = true;
      fixture.detectChanges();

      const slider = fixture.nativeElement.querySelector('app-time-slider');
      expect(slider).toBeTruthy();
    });

    it('should not render slider when showSlider is false', () => {
      component.showSlider = false;
      fixture.detectChanges();

      const slider = fixture.nativeElement.querySelector('app-time-slider');
      expect(slider).toBeFalsy();
    });

    it('should apply loading class when loading', () => {
      component.viewModel = createMockViewModel({
        loading: true
      });
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.player-controls');
      expect(controls.classList.contains('loading')).toBe(true);
    });

    it('should apply error class when has error', () => {
      component.viewModel = createMockViewModel({
        hasError: true,
        error: 'Network error'
      });
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.player-controls');
      expect(controls.classList.contains('error')).toBe(true);
    });

    it('should apply compact class when compact is true', () => {
      component.compact = true;
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.player-controls');
      expect(controls.classList.contains('compact')).toBe(true);
    });

    it('should display error message when has error', () => {
      component.viewModel = createMockViewModel({
        hasError: true,
        error: 'Test error message'
      });
      fixture.detectChanges();

      const errorMessage = fixture.nativeElement.querySelector('.error-message .error-text');
      expect(errorMessage?.textContent).toContain('Test error message');
    });

    it('should display loading indicator when loading', () => {
      component.viewModel = createMockViewModel({
        loading: true
      });
      fixture.detectChanges();

      const loadingIndicator = fixture.nativeElement.querySelector('.loading-indicator .loading-text');
      expect(loadingIndicator?.textContent).toContain('Chargement...');
    });
  });

  describe('User Interactions', () => {
    it('should emit togglePlayPauseRequested when play/pause button is clicked', () => {
      spyOn(component.togglePlayPauseRequested, 'emit');
      
      const playButton = fixture.nativeElement.querySelector('.play-pause-button');
      playButton.click();
      
      expect(component.togglePlayPauseRequested.emit).toHaveBeenCalled();
    });

    it('should emit stopRequested when stop button is clicked', () => {
      spyOn(component.stopRequested, 'emit');
      
      const stopButton = fixture.nativeElement.querySelector('.stop-button');
      stopButton.click();
      
      expect(component.stopRequested.emit).toHaveBeenCalled();
    });

    it('should emit seekByRequested when seek buttons are clicked', () => {
      spyOn(component.seekByRequested, 'emit');
      
      const seekBackButton = fixture.nativeElement.querySelector('.seek-button:first-of-type');
      const seekForwardButton = fixture.nativeElement.querySelector('.seek-button:last-of-type');
      
      seekBackButton.click();
      expect(component.seekByRequested.emit).toHaveBeenCalledWith(-10);
      
      seekForwardButton.click();
      expect(component.seekByRequested.emit).toHaveBeenCalledWith(10);
    });

    it('should disable buttons when controls are disabled', () => {
      component.viewModel = createMockViewModel({
        isPlayerReady: false
      });
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('.control-button');
      buttons.forEach((button: HTMLButtonElement) => {
        expect(button.disabled).toBe(true);
      });
    });

    it('should show correct icon based on player state', () => {
      // Test loading state
      component.viewModel = createMockViewModel({
        loading: true
      });
      fixture.detectChanges();

      let playButton = fixture.nativeElement.querySelector('.play-pause-button .control-icon');
      expect(playButton.textContent).toContain('⏳');

      // Test error state
      component.viewModel = createMockViewModel({
        hasError: true,
        error: 'Test error'
      });
      fixture.detectChanges();

      playButton = fixture.nativeElement.querySelector('.play-pause-button .control-icon');
      expect(playButton.textContent).toContain('❌');

      // Test playing state
      component.viewModel = createMockViewModel({
        isPlaying: true
      });
      fixture.detectChanges();

      playButton = fixture.nativeElement.querySelector('.play-pause-button .control-icon');
      expect(playButton.textContent).toContain('⏸️');

      // Test paused state
      component.viewModel = createMockViewModel({
        isPlaying: false
      });
      fixture.detectChanges();

      playButton = fixture.nativeElement.querySelector('.play-pause-button .control-icon');
      expect(playButton.textContent).toContain('▶️');
    });
  });

  describe('Time Formatting Integration', () => {
    it('should format time using LoopService', () => {
      // Clear any previous calls
      mockLoopService.formatTime.calls.reset();
      
      component.viewModel = createMockViewModel({
        currentTime: 125
      });
      fixture.detectChanges();
      
      // Call the computed property to trigger formatTime
      const formatted = component.currentTimeFormatted();
      
      expect(formatted).toBeDefined();
      expect(mockLoopService.formatTime).toHaveBeenCalledWith(125);
    });

    it('should format duration using LoopService', () => {
      component.viewModel = createMockViewModel({
        duration: 300
      });
      fixture.detectChanges();

      expect(component.durationFormatted()).toBeDefined();
      expect(mockLoopService.formatTime).toHaveBeenCalledWith(300);
    });
  });

  describe('Utility Getters', () => {
    it('should provide utility getters that match computed properties', () => {
      expect(component.canSeekValue).toBe(component.canSeek());
      expect(component.isPlayingValue).toBe(component.isPlaying());
      expect(component.canPlayValue).toBe(component.canPlay());
      expect(component.canPauseValue).toBe(component.canPause());
      expect(component.isLoadingValue).toBe(component.isLoading());
      expect(component.hasErrorValue).toBe(component.hasError());
      expect(component.controlsDisabledValue).toBe(component.controlsDisabled());
    });
  });

  describe('Conditional Rendering with @if', () => {
    it('should render components based on configuration flags', () => {
      // Enable all
      component.showTimeDisplay = true;
      component.showSlider = true;
      component.showSpeedControls = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-time-display')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-time-slider')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-speed-control')).toBeTruthy();

      // Disable all
      component.showTimeDisplay = false;
      component.showSlider = false;
      component.showSpeedControls = false;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-time-display')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('app-time-slider')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('app-speed-control')).toBeFalsy();
    });

    it('should conditionally show error message', () => {
      // No error
      component.viewModel = createMockViewModel({
        hasError: false
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.error-message')).toBeFalsy();

      // With error
      component.viewModel = createMockViewModel({
        hasError: true,
        error: 'Test error'
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.error-message')).toBeTruthy();
    });

    it('should conditionally show loading indicator', () => {
      // Not loading
      component.viewModel = createMockViewModel({
        loading: false
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.loading-indicator')).toBeFalsy();

      // Loading
      component.viewModel = createMockViewModel({
        loading: true
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.loading-indicator')).toBeTruthy();
    });
  });

  describe('Integration with Child Components', () => {
    it('should pass correct inputs to TimeDisplayComponent', () => {
      component.viewModel = createMockViewModel({
        currentTime: 125,
        duration: 300,
        loading: true,
        hasError: false
      });
      component.showTimeDisplay = true;
      fixture.detectChanges();

      const timeDisplay = fixture.nativeElement.querySelector('app-time-display');
      expect(timeDisplay).toBeTruthy();
      // Note: Detailed input validation would require component testing framework
      // or exposing inputs through data attributes
    });

    it('should pass correct inputs to TimeSliderComponent', () => {
      component.viewModel = createMockViewModel({
        currentTime: 150,
        duration: 300,
        canSeek: true
      });
      component.showSlider = true;
      fixture.detectChanges();

      const timeSlider = fixture.nativeElement.querySelector('app-time-slider');
      expect(timeSlider).toBeTruthy();
    });

    it('should pass correct inputs to SpeedControlComponent', () => {
      component.viewModel = createMockViewModel({
        playbackRate: 1.5,
        isPlayerReady: true
      });
      component.showSpeedControls = true;
      fixture.detectChanges();

      const speedControl = fixture.nativeElement.querySelector('app-speed-control');
      expect(speedControl).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration gracefully', () => {
      const mockViewModel = createMockViewModel({
        duration: 0,
        currentTime: 0,
        canSeek: false
      });
      component.viewModel = mockViewModel;
      fixture.detectChanges();

      expect(component.progressPercentage()).toBe(0);
      expect(component.canSeek()).toBe(false);
    });

    it('should handle undefined viewModel properties gracefully', () => {
      component.viewModel = {} as VideoPlayerViewModel;
      fixture.detectChanges();

      expect(() => {
        component.isPlaying();
        component.currentTime();
        component.duration();
        component.canPlay();
      }).not.toThrow();
    });

    it('should apply circular class to play button when circular is true', () => {
      component.circular = true;
      fixture.detectChanges();

      const playButton = fixture.nativeElement.querySelector('.play-pause-button');
      expect(playButton.classList.contains('circular')).toBe(true);
    });

    it('should apply playing class to play button when playing', () => {
      component.viewModel = createMockViewModel({
        isPlaying: true
      });
      fixture.detectChanges();

      const playButton = fixture.nativeElement.querySelector('.play-pause-button');
      expect(playButton.classList.contains('playing')).toBe(true);
    });
  });
});