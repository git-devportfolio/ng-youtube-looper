import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlayerControlsComponent } from './player-controls.component';
import { VideoPlayerFacade } from '../data-access/video-player.facade';

describe('PlayerControlsComponent', () => {
  let component: PlayerControlsComponent;
  let fixture: ComponentFixture<PlayerControlsComponent>;
  let mockVideoPlayerFacade: jasmine.SpyObj<VideoPlayerFacade>;

  // Mock player state
  const mockPlayerState = signal<{
    isReady: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    playbackRate: number;
    volume: number;
    error: string | null;
  }>({
    isReady: true,
    isPlaying: false,
    currentTime: 0,
    duration: 300,
    playbackRate: 1,
    volume: 100,
    error: null
  });

  const mockCurrentVideo = signal(null);
  const mockCanPlay = signal(true);
  const mockCanPause = signal(false);
  const mockHasError = signal(false);

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('VideoPlayerFacade', [
      'togglePlayPause',
      'play',
      'pause',
      'stop',
      'seekTo',
      'seekBy',
      'setPlaybackRate',
      'increaseSpeed',
      'decreaseSpeed',
      'setVolume',
      'mute'
    ]);

    spy.playerState = mockPlayerState.asReadonly();
    spy.currentVideo = mockCurrentVideo.asReadonly();
    spy.canPlay = mockCanPlay.asReadonly();
    spy.canPause = mockCanPause.asReadonly();
    spy.hasError = mockHasError.asReadonly();

    await TestBed.configureTestingModule({
      imports: [PlayerControlsComponent],
      providers: [
        { provide: VideoPlayerFacade, useValue: spy }
      ]
    }).compileComponents();

    mockVideoPlayerFacade = TestBed.inject(VideoPlayerFacade) as jasmine.SpyObj<VideoPlayerFacade>;
    fixture = TestBed.createComponent(PlayerControlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

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

  it('should compute derived states correctly', () => {
    expect(component.isPlaying()).toBe(false);
    expect(component.isLoading()).toBe(false);
    expect(component.currentTime()).toBe(0);
    expect(component.duration()).toBe(300);
    expect(component.playbackRate()).toBe(1);
  });

  it('should compute control states correctly', () => {
    // Debug the actual values
    console.log('playerState isReady:', component.playerState().isReady);
    console.log('hasError:', component.hasError());
    console.log('controlsDisabled:', component.controlsDisabled());
    console.log('canSeek:', component.canSeek());
    console.log('duration:', component.duration());
    
    // controlsDisabled = !isReady || hasError()
    // hasError() should return false since mockHasError signal is set to false
    expect(component.controlsDisabled()).toBe(false); 
    expect(component.canSeek()).toBe(true); // isReady=true && duration=300 > 0
    expect(component.progressPercentage()).toBe(0); // currentTime=0 / duration=300 * 100 = 0
  });

  it('should disable controls when not ready', () => {
    mockPlayerState.set({
      isReady: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      volume: 100,
      error: null
    });
    fixture.detectChanges();

    expect(component.controlsDisabled()).toBe(true);
    expect(component.canSeek()).toBe(false);
  });

  it('should calculate progress percentage correctly', () => {
    mockPlayerState.set({
      isReady: true,
      isPlaying: true,
      currentTime: 150,
      duration: 300,
      playbackRate: 1,
      volume: 100,
      error: null
    });
    fixture.detectChanges();

    expect(component.progressPercentage()).toBe(50);
  });

  it('should call togglePlayPause on facade when togglePlayPause is called', () => {
    component.togglePlayPause();
    expect(mockVideoPlayerFacade.togglePlayPause).toHaveBeenCalled();
  });

  it('should call play on facade when play is called', () => {
    component.play();
    expect(mockVideoPlayerFacade.play).toHaveBeenCalled();
  });

  it('should call pause on facade when pause is called', () => {
    component.pause();
    expect(mockVideoPlayerFacade.pause).toHaveBeenCalled();
  });

  it('should call stop on facade when stop is called', () => {
    component.stop();
    expect(mockVideoPlayerFacade.stop).toHaveBeenCalled();
  });

  it('should call seekTo on facade when seekTo is called', () => {
    component.seekTo(120);
    expect(mockVideoPlayerFacade.seekTo).toHaveBeenCalledWith(120);
  });

  it('should call seekBy(-10) on facade when seekBack is called', () => {
    component.seekBack();
    expect(mockVideoPlayerFacade.seekBy).toHaveBeenCalledWith(-10);
  });

  it('should call seekBy(10) on facade when seekForward is called', () => {
    component.seekForward();
    expect(mockVideoPlayerFacade.seekBy).toHaveBeenCalledWith(10);
  });

  it('should call setPlaybackRate on facade when setPlaybackRate is called', () => {
    component.setPlaybackRate(1.5);
    expect(mockVideoPlayerFacade.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  it('should call increaseSpeed on facade when increaseSpeed is called', () => {
    component.increaseSpeed();
    expect(mockVideoPlayerFacade.increaseSpeed).toHaveBeenCalled();
  });

  it('should call decreaseSpeed on facade when decreaseSpeed is called', () => {
    component.decreaseSpeed();
    expect(mockVideoPlayerFacade.decreaseSpeed).toHaveBeenCalled();
  });

  it('should call setVolume on facade when setVolume is called', () => {
    component.setVolume(50);
    expect(mockVideoPlayerFacade.setVolume).toHaveBeenCalledWith(50);
  });

  it('should call mute on facade when mute is called', () => {
    component.mute();
    expect(mockVideoPlayerFacade.mute).toHaveBeenCalled();
  });

  it('should handle error state correctly', () => {
    mockHasError.set(true);
    mockPlayerState.set({
      isReady: true,
      isPlaying: false,
      currentTime: 0,
      duration: 300,
      playbackRate: 1,
      volume: 100,
      error: 'Network error'
    });
    fixture.detectChanges();

    expect(component.hasError()).toBe(true);
    expect(component.controlsDisabled()).toBe(true);
  });

  it('should provide utility getters for template', () => {
    expect(component.canSeekValue).toBe(component.canSeek());
    expect(component.isPlayingValue).toBe(component.isPlaying());
    expect(component.canPlayValue).toBe(component.canPlay());
    expect(component.canPauseValue).toBe(component.canPause());
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

    it('should render slider when showSlider is true', () => {
      component.showSlider = true;
      fixture.detectChanges();

      const slider = fixture.nativeElement.querySelector('app-time-slider');
      expect(slider).toBeTruthy();
    });

    it('should apply loading class when loading', () => {
      mockPlayerState.set({
        isReady: false,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        playbackRate: 1,
        volume: 100,
        error: null
      });
      fixture.detectChanges();

      const controls = fixture.nativeElement.querySelector('.player-controls');
      expect(controls.classList.contains('loading')).toBe(true);
    });

    it('should apply error class when has error', () => {
      mockHasError.set(true);
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
  });
});