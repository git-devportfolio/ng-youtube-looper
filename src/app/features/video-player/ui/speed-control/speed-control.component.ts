import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { YouTubeService } from '../../../../core/services/youtube.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-speed-control',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './speed-control.component.html',
  styleUrls: ['./speed-control.component.scss']
})
export class SpeedControlComponent implements OnInit, OnDestroy {
  @Input() currentRate = 1;
  @Input() disabled = false;
  @Input() useDirectIntegration = true; // Enable direct YouTube integration

  @Output() rateChange = new EventEmitter<number>();
  @Output() increaseSpeed = new EventEmitter<void>();
  @Output() decreaseSpeed = new EventEmitter<void>();

  private readonly youTubeService = inject(YouTubeService);
  private readonly destroy$ = new Subject<void>();

  readonly speedPresets = [
    { value: 0.25, display: '0.25x', label: 'Quart de vitesse' },
    { value: 0.5, display: '0.5x', label: 'Demi vitesse' }, // Added missing 0.5x preset
    { value: 0.75, display: '0.75x', label: 'Trois quarts vitesse' },
    { value: 1, display: '1x', label: 'Vitesse normale' },
    { value: 1.25, display: '1.25x', label: 'Vitesse accélérée' },
    { value: 1.5, display: '1.5x', label: 'Une fois et demie' },
    { value: 2, display: '2x', label: 'Double vitesse' }
  ];

  readonly manualSpeedControl = new FormControl(1, [
    Validators.required,
    Validators.min(0.25),
    Validators.max(2)
  ]);

  showManualInput = false;
  
  constructor() {
    // Synchronize current rate with YouTube player state
    effect(() => {
      const playerState = this.youTubeService.playerState();
      if (playerState.isReady && playerState.playbackRate !== this.currentRate) {
        this.currentRate = playerState.playbackRate;
        this.manualSpeedControl.setValue(this.currentRate, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    // No additional initialization needed for now
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canIncrease(): boolean {
    return this.currentRate < 2;
  }

  get canDecrease(): boolean {
    return this.currentRate > 0.25;
  }

  setPresetSpeed(rate: number): void {
    if (!this.disabled) {
      if (this.useDirectIntegration) {
        // Direct integration with YouTube API
        this.youTubeService.setPlaybackRate(rate);
        this.currentRate = rate;
      } else {
        // Legacy mode: emit event for parent handling
        this.rateChange.emit(rate);
      }
    }
  }

  toggleManualInput(): void {
    if (!this.disabled) {
      this.showManualInput = !this.showManualInput;
      if (this.showManualInput) {
        this.manualSpeedControl.setValue(this.currentRate);
      }
    }
  }

  applyManualSpeed(): void {
    if (this.manualSpeedControl.valid && !this.disabled) {
      const value = this.manualSpeedControl.value;
      if (value !== null) {
        if (this.useDirectIntegration) {
          // Direct integration with YouTube API
          this.youTubeService.setPlaybackRate(value);
          this.currentRate = value;
        } else {
          // Legacy mode: emit event for parent handling
          this.rateChange.emit(value);
        }
        this.showManualInput = false;
      }
    }
  }

  /**
   * Increase playback speed by 0.25x step
   */
  increasePlaybackSpeed(): void {
    if (this.canIncrease && !this.disabled) {
      const newRate = Math.min(2, this.currentRate + 0.25);
      if (this.useDirectIntegration) {
        this.youTubeService.setPlaybackRate(newRate);
        this.currentRate = newRate;
      } else {
        this.increaseSpeed.emit();
      }
    }
  }

  /**
   * Decrease playback speed by 0.25x step
   */
  decreasePlaybackSpeed(): void {
    if (this.canDecrease && !this.disabled) {
      const newRate = Math.max(0.25, this.currentRate - 0.25);
      if (this.useDirectIntegration) {
        this.youTubeService.setPlaybackRate(newRate);
        this.currentRate = newRate;
      } else {
        this.decreaseSpeed.emit();
      }
    }
  }

  /**
   * Get the current playback rate from YouTube player
   */
  get actualPlaybackRate(): number {
    return this.youTubeService.getPlaybackRate();
  }

  /**
   * Check if component is synchronized with YouTube player
   */
  get isSynchronized(): boolean {
    return this.actualPlaybackRate === this.currentRate;
  }
}