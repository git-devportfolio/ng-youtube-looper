import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { YouTubeService } from '../../../../core/services/youtube.service';
import { ValidationService } from '../../../../core/services/validation.service';
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
  private readonly validationService = inject(ValidationService);
  private readonly destroy$ = new Subject<void>();

  // Use ValidationService to get consistent presets
  get speedPresets() {
    return this.validationService.getValidSpeedPresets();
  }

  readonly manualSpeedControl = new FormControl(1, [
    Validators.required,
    Validators.min(this.validationService.MIN_PLAYBACK_SPEED),
    Validators.max(this.validationService.MAX_PLAYBACK_SPEED),
    (control) => {
      if (!control.value) return null;
      const validation = this.validationService.validateSpeedInput(control.value.toString(), false);
      return validation.valid ? null : { invalidSpeed: { message: validation.error } };
    }
  ]);

  showManualInput = false;
  
  constructor() {
    // Synchronize current rate with YouTube player state
    effect(() => {
      const playerState = this.youTubeService.playerState();
      if (playerState.isReady && !this.validationService.areSpeedsEqual(playerState.playbackRate, this.currentRate)) {
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
    const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'up');
    return nextSpeed !== null;
  }

  get canDecrease(): boolean {
    const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'down');
    return nextSpeed !== null;
  }

  setPresetSpeed(rate: number): void {
    if (!this.disabled) {
      // Validate and round the speed
      const validatedSpeed = this.validationService.roundToValidStep(rate);
      
      if (this.useDirectIntegration) {
        // Direct integration with YouTube API
        this.youTubeService.setPlaybackRate(validatedSpeed);
        this.currentRate = validatedSpeed;
      } else {
        // Legacy mode: emit event for parent handling
        this.rateChange.emit(validatedSpeed);
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
    if (!this.disabled) {
      const inputValue = this.manualSpeedControl.value;
      if (inputValue !== null) {
        const validation = this.validationService.validateSpeedInput(inputValue.toString(), true);
        
        if (validation.valid && validation.speed !== undefined) {
          const validatedSpeed = validation.speed;
          
          if (this.useDirectIntegration) {
            // Direct integration with YouTube API
            this.youTubeService.setPlaybackRate(validatedSpeed);
            this.currentRate = validatedSpeed;
          } else {
            // Legacy mode: emit event for parent handling
            this.rateChange.emit(validatedSpeed);
          }
          
          // Update the form control to show the rounded value
          this.manualSpeedControl.setValue(validatedSpeed, { emitEvent: false });
          this.showManualInput = false;
        }
      }
    }
  }

  /**
   * Increase playback speed by 0.25x step
   */
  increasePlaybackSpeed(): void {
    if (this.canIncrease && !this.disabled) {
      const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'up');
      if (nextSpeed !== null) {
        if (this.useDirectIntegration) {
          this.youTubeService.setPlaybackRate(nextSpeed);
          this.currentRate = nextSpeed;
        } else {
          this.increaseSpeed.emit();
        }
      }
    }
  }

  /**
   * Decrease playback speed by 0.25x step
   */
  decreasePlaybackSpeed(): void {
    if (this.canDecrease && !this.disabled) {
      const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'down');
      if (nextSpeed !== null) {
        if (this.useDirectIntegration) {
          this.youTubeService.setPlaybackRate(nextSpeed);
          this.currentRate = nextSpeed;
        } else {
          this.decreaseSpeed.emit();
        }
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
    return this.validationService.areSpeedsEqual(this.actualPlaybackRate, this.currentRate);
  }

  /**
   * Get validation errors for manual input
   */
  get manualInputError(): string | null {
    if (this.manualSpeedControl.errors) {
      if (this.manualSpeedControl.errors['required']) {
        return 'Vitesse requise';
      }
      if (this.manualSpeedControl.errors['min']) {
        return `Minimum ${this.validationService.MIN_PLAYBACK_SPEED}x`;
      }
      if (this.manualSpeedControl.errors['max']) {
        return `Maximum ${this.validationService.MAX_PLAYBACK_SPEED}x`;
      }
      if (this.manualSpeedControl.errors['invalidSpeed']) {
        return this.manualSpeedControl.errors['invalidSpeed'].message;
      }
    }
    return null;
  }

  /**
   * Get all valid speeds for debugging/advanced usage
   */
  get allValidSpeeds(): number[] {
    return this.validationService.getAllValidSpeeds();
  }
}