import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoPlayerViewModel } from '../../data-access/video-player.facade';
import { TimeDisplayComponent } from '../time-display';
import { TimeSliderComponent } from '../time-slider';
import { SpeedControlComponent } from '../speed-control';
import { LoopService } from '@core/services/loop.service';

@Component({
  selector: 'app-player-controls',
  imports: [CommonModule, TimeDisplayComponent, TimeSliderComponent, SpeedControlComponent],
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss']
})
export class PlayerControlsComponent {
  private readonly loopService = inject(LoopService);

  // Internal signal for viewModel to enable reactive computed properties
  private readonly viewModelSignal = signal<VideoPlayerViewModel | null>(null);
  
  // ViewModel input - the component is now stateless
  @Input({ required: true }) 
  set viewModel(value: VideoPlayerViewModel) {
    this.viewModelSignal.set(value);
  }
  get viewModel(): VideoPlayerViewModel {
    return this.viewModelSignal()!;
  }

  // Configuration inputs
  @Input() circular = false;
  @Input() compact = false;
  @Input() showTimeDisplay = true;
  @Input() showSpeedControls = true;
  @Input() showSlider = true;

  // Event outputs for pure UI component communication
  @Output() playRequested = new EventEmitter<void>();
  @Output() pauseRequested = new EventEmitter<void>();
  @Output() stopRequested = new EventEmitter<void>();
  @Output() togglePlayPauseRequested = new EventEmitter<void>();
  @Output() seekRequested = new EventEmitter<number>();
  @Output() seekByRequested = new EventEmitter<number>();
  @Output() playbackRateChangeRequested = new EventEmitter<number>();
  @Output() speedIncreaseRequested = new EventEmitter<void>();
  @Output() speedDecreaseRequested = new EventEmitter<void>();
  @Output() volumeChangeRequested = new EventEmitter<number>();
  @Output() muteRequested = new EventEmitter<void>();
  @Output() seekStarted = new EventEmitter<void>();
  @Output() seekEnded = new EventEmitter<void>();

  // Computed properties derived from viewModel signal for proper reactivity
  readonly isPlaying = computed(() => this.viewModelSignal()?.isPlaying ?? false);
  readonly isLoading = computed(() => this.viewModelSignal()?.loading ?? false);
  readonly currentTime = computed(() => this.viewModelSignal()?.currentTime ?? 0);
  readonly duration = computed(() => this.viewModelSignal()?.duration ?? 0);
  readonly playbackRate = computed(() => this.viewModelSignal()?.playbackRate ?? 1);
  readonly volume = computed(() => this.viewModelSignal()?.volume ?? 100);
  readonly hasError = computed(() => this.viewModelSignal()?.hasError ?? false);
  readonly canPlay = computed(() => this.viewModelSignal()?.canPlay ?? false);
  readonly canPause = computed(() => this.viewModelSignal()?.canPause ?? false);
  readonly canSeek = computed(() => this.viewModelSignal()?.canSeek ?? false);
  readonly isPlayerReady = computed(() => this.viewModelSignal()?.isPlayerReady ?? false);
  
  // Note: buffered is not available in the current PlayerViewModel interface
  // This could be added to VideoPlayerViewModel if needed for buffer visualization
  readonly buffered = computed(() => 0); // Placeholder for now

  // Control states derived from viewModel
  readonly controlsDisabled = computed(() => 
    !this.isPlayerReady() || this.hasError()
  );

  readonly progressPercentage = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  // Formatted time displays using LoopService
  readonly currentTimeFormatted = computed(() => 
    this.loopService.formatTime(this.currentTime())
  );
  
  readonly durationFormatted = computed(() => 
    this.loopService.formatTime(this.duration())
  );

  // No constructor needed - pure UI component without side effects

  // Pure UI event handlers that emit to parent components
  
  // Play/Pause controls
  togglePlayPause(): void {
    this.togglePlayPauseRequested.emit();
  }

  play(): void {
    this.playRequested.emit();
  }

  pause(): void {
    this.pauseRequested.emit();
  }

  stop(): void {
    this.stopRequested.emit();
  }

  // Seek controls
  seekTo(seconds: number): void {
    this.seekRequested.emit(seconds);
  }

  seekBack(): void {
    this.seekByRequested.emit(-10);
  }

  seekForward(): void {
    this.seekByRequested.emit(10);
  }

  // Speed controls
  setPlaybackRate(rate: number): void {
    this.playbackRateChangeRequested.emit(rate);
  }

  increaseSpeed(): void {
    this.speedIncreaseRequested.emit();
  }

  decreaseSpeed(): void {
    this.speedDecreaseRequested.emit();
  }

  // Slider events
  onSeekStart(): void {
    this.seekStarted.emit();
  }

  onSeekEnd(): void {
    this.seekEnded.emit();
  }

  // Volume controls
  setVolume(volume: number): void {
    this.volumeChangeRequested.emit(volume);
  }

  mute(): void {
    this.muteRequested.emit();
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

  get isLoadingValue(): boolean {
    return this.isLoading();
  }

  get hasErrorValue(): boolean {
    return this.hasError();
  }

  get controlsDisabledValue(): boolean {
    return this.controlsDisabled();
  }
}