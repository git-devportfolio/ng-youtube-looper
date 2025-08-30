import { Component, Input, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoPlayerFacade } from '../data-access/video-player.facade';
import { TimeDisplayComponent } from './time-display.component';
import { TimeSliderComponent } from './time-slider.component';
import { SpeedControlComponent } from './speed-control.component';

@Component({
  selector: 'app-player-controls',
  imports: [CommonModule, TimeDisplayComponent, TimeSliderComponent, SpeedControlComponent],
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss']
})
export class PlayerControlsComponent {
  private readonly videoPlayerFacade = inject(VideoPlayerFacade);

  // Configuration inputs
  @Input() circular = false;
  @Input() compact = false;
  @Input() showTimeDisplay = true;
  @Input() showSpeedControls = true;
  @Input() showSlider = true;

  // Real-time synchronized computed signals
  readonly playerState = this.videoPlayerFacade.playerState;
  readonly currentVideo = this.videoPlayerFacade.currentVideo;
  readonly canPlay = this.videoPlayerFacade.canPlay;
  readonly canPause = this.videoPlayerFacade.canPause;
  readonly hasError = this.videoPlayerFacade.hasError;

  // Derived states for UI components
  readonly isPlaying = computed(() => this.playerState().isPlaying);
  readonly isLoading = computed(() => !this.playerState().isReady);
  readonly currentTime = computed(() => this.playerState().currentTime);
  readonly duration = computed(() => this.playerState().duration);
  readonly playbackRate = computed(() => this.playerState().playbackRate);
  readonly volume = computed(() => this.playerState().volume);
  
  // Note: buffered is not available in the current PlayerState interface
  // This could be added to YouTubeService if needed for buffer visualization
  readonly buffered = computed(() => 0); // Placeholder for now

  // Control states
  readonly controlsDisabled = computed(() => 
    !this.playerState().isReady || this.hasError()
  );

  readonly canSeek = computed(() => 
    this.playerState().isReady && this.duration() > 0
  );

  readonly progressPercentage = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  constructor() {
    // Effect for error handling and user feedback
    effect(() => {
      const state = this.playerState();
      const error = state.error;
      
      if (error) {
        console.error('Player error:', error);
        // Could trigger user notifications here
      }
    });

    // Effect for logging state changes in development
    effect(() => {
      const state = this.playerState();
      if (state.isReady) {
        console.log('Player state updated:', {
          playing: state.isPlaying,
          currentTime: state.currentTime,
          duration: state.duration,
          rate: state.playbackRate
        });
      }
    });
  }

  // Play/Pause controls
  togglePlayPause(): void {
    this.videoPlayerFacade.togglePlayPause();
  }

  play(): void {
    this.videoPlayerFacade.play();
  }

  pause(): void {
    this.videoPlayerFacade.pause();
  }

  stop(): void {
    this.videoPlayerFacade.stop();
  }

  // Seek controls
  seekTo(seconds: number): void {
    this.videoPlayerFacade.seekTo(seconds);
  }

  seekBack(): void {
    this.videoPlayerFacade.seekBy(-10);
  }

  seekForward(): void {
    this.videoPlayerFacade.seekBy(10);
  }

  // Speed controls
  setPlaybackRate(rate: number): void {
    this.videoPlayerFacade.setPlaybackRate(rate);
  }

  increaseSpeed(): void {
    this.videoPlayerFacade.increaseSpeed();
  }

  decreaseSpeed(): void {
    this.videoPlayerFacade.decreaseSpeed();
  }

  // Slider events
  onSeekStart(): void {
    // Optional: Pause updates while seeking for smoother UX
    console.log('Seek started');
  }

  onSeekEnd(): void {
    // Optional: Resume updates after seeking
    console.log('Seek ended');
  }

  // Volume controls
  setVolume(volume: number): void {
    this.videoPlayerFacade.setVolume(volume);
  }

  mute(): void {
    this.videoPlayerFacade.mute();
  }

  // Utility getters for template readability
  get canSeekValue(): boolean {
    return this.canSeek();
  }

  get isPlayingValue(): boolean {
    return this.isPlaying();
  }

  get canPlayValue(): boolean {
    return this.canPlay();
  }

  get canPauseValue(): boolean {
    return this.canPause();
  }
}