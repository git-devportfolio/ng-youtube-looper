import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { trigger, style, transition, animate } from '@angular/animations';
import { YouTubeService } from '../../../../core/services/youtube.service';
import { ValidationService } from '../../../../core/services/validation.service';
import { LoopSpeedManagerService } from '../../../../core/services/loop-speed-manager.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-speed-control',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './speed-control.component.html',
  styleUrls: ['./speed-control.component.scss'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px) scale(0.95)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateX(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateX(-20px) scale(0.95)' }))
      ])
    ])
  ]
})
export class SpeedControlComponent implements OnInit, OnDestroy {
  @Input() currentRate = 1;
  @Input() disabled = false;
  @Input() useDirectIntegration = true; // Enable direct YouTube integration
  @Input() activeLoopId: string | null = null; // Current loop ID for speed management
  @Input() enableLoopSpeedManagement = true; // Enable per-loop speed saving

  @Output() rateChange = new EventEmitter<number>();
  @Output() increaseSpeed = new EventEmitter<void>();
  @Output() decreaseSpeed = new EventEmitter<void>();
  @Output() loopSpeedChanged = new EventEmitter<{loopId: string, speed: number}>();

  private readonly youTubeService = inject(YouTubeService);
  private readonly validationService = inject(ValidationService);
  private readonly loopSpeedManager = inject(LoopSpeedManagerService);
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
      return validation.isValid ? null : { invalidSpeed: { message: validation.error } };
    }
  ]);

  showManualInput = false;
  
  // Enhanced UI feedback signals
  readonly isTransitioning = signal(false);
  
  constructor() {
    // Synchronize current rate with YouTube player state
    effect(() => {
      const playerState = this.youTubeService.playerState();
      if (playerState.isReady && !this.validationService.areSpeedsEqual(playerState.playbackRate, this.currentRate)) {
        this.currentRate = playerState.playbackRate;
        this.manualSpeedControl.setValue(this.currentRate, { emitEvent: false });
      }
    });

    // Synchronize with loop speed manager when active loop changes
    effect(() => {
      if (this.enableLoopSpeedManagement && this.activeLoopId) {
        const loopSpeed = this.loopSpeedManager.getLoopSpeed(this.activeLoopId);
        if (!this.validationService.areSpeedsEqual(loopSpeed, this.currentRate)) {
          this.currentRate = loopSpeed;
          this.manualSpeedControl.setValue(this.currentRate, { emitEvent: false });
          
          // Apply the speed if using direct integration
          if (this.useDirectIntegration) {
            this.youTubeService.setPlaybackRate(loopSpeed);
          } else {
            this.rateChange.emit(loopSpeed);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    // Set up loop speed manager for current active loop
    if (this.enableLoopSpeedManagement && this.activeLoopId) {
      this.loopSpeedManager.setActiveLoop(this.activeLoopId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Method called when active loop changes from parent component
   */
  onActiveLoopChange(newLoopId: string | null): void {
    if (this.enableLoopSpeedManagement) {
      this.activeLoopId = newLoopId;
      
      if (newLoopId) {
        const result = this.loopSpeedManager.setActiveLoop(newLoopId);
        if (result.success && result.speed !== undefined) {
          this.currentRate = result.speed;
          this.manualSpeedControl.setValue(result.speed, { emitEvent: false });
          
          if (this.useDirectIntegration) {
            this.youTubeService.setPlaybackRate(result.speed);
          } else {
            this.rateChange.emit(result.speed);
          }
        }
      } else {
        // No active loop, use global speed
        const globalSpeed = this.loopSpeedManager.globalSpeed();
        this.currentRate = globalSpeed;
        this.manualSpeedControl.setValue(globalSpeed, { emitEvent: false });
        
        if (this.useDirectIntegration) {
          this.youTubeService.setPlaybackRate(globalSpeed);
        } else {
          this.rateChange.emit(globalSpeed);
        }
      }
    }
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
      this.isTransitioning.set(true);
      
      // Validate and round the speed
      const validatedSpeed = this.validationService.roundToValidStep(rate);
      
      // Save speed for active loop if enabled
      if (this.enableLoopSpeedManagement && this.activeLoopId) {
        const result = this.loopSpeedManager.setLoopSpeed(this.activeLoopId, validatedSpeed);
        if (result.success) {
          this.loopSpeedChanged.emit({ loopId: this.activeLoopId, speed: validatedSpeed });
        }
      }
      
      if (this.useDirectIntegration) {
        // Direct integration with YouTube API
        this.youTubeService.setPlaybackRate(validatedSpeed);
        this.currentRate = validatedSpeed;
      } else {
        // Legacy mode: emit event for parent handling
        this.rateChange.emit(validatedSpeed);
      }
      
      // Reset transition state after animation completes
      setTimeout(() => this.isTransitioning.set(false), 300);
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
      this.isTransitioning.set(true);
      
      const inputValue = this.manualSpeedControl.value;
      if (inputValue !== null) {
        const validation = this.validationService.validateSpeedInput(inputValue.toString(), true);
        
        if (validation.isValid && validation.value !== undefined) {
          const validatedSpeed = validation.value;
          
          // Save speed for active loop if enabled
          if (this.enableLoopSpeedManagement && this.activeLoopId) {
            const result = this.loopSpeedManager.setLoopSpeed(this.activeLoopId, validatedSpeed);
            if (result.success) {
              this.loopSpeedChanged.emit({ loopId: this.activeLoopId, speed: validatedSpeed });
            }
          }
          
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
          
          // Close manual input after successful application
          setTimeout(() => {
            this.showManualInput = false;
            this.isTransitioning.set(false);
          }, 300);
        } else {
          // Reset transition state if validation failed
          setTimeout(() => this.isTransitioning.set(false), 300);
        }
      } else {
        // Reset transition state if no value
        setTimeout(() => this.isTransitioning.set(false), 300);
      }
    }
  }

  /**
   * Increase playback speed by 0.25x step
   */
  increasePlaybackSpeed(): void {
    if (this.canIncrease && !this.disabled) {
      this.isTransitioning.set(true);
      
      const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'up');
      if (nextSpeed !== null) {
        // Save speed for active loop if enabled
        if (this.enableLoopSpeedManagement && this.activeLoopId) {
          const result = this.loopSpeedManager.setLoopSpeed(this.activeLoopId, nextSpeed);
          if (result.success) {
            this.loopSpeedChanged.emit({ loopId: this.activeLoopId, speed: nextSpeed });
          }
        }
        
        if (this.useDirectIntegration) {
          this.youTubeService.setPlaybackRate(nextSpeed);
          this.currentRate = nextSpeed;
        } else {
          this.increaseSpeed.emit();
        }
        
        // Reset transition state after animation completes
        setTimeout(() => this.isTransitioning.set(false), 300);
      }
    }
  }

  /**
   * Decrease playback speed by 0.25x step
   */
  decreasePlaybackSpeed(): void {
    if (this.canDecrease && !this.disabled) {
      this.isTransitioning.set(true);
      
      const nextSpeed = this.validationService.getNextValidSpeed(this.currentRate, 'down');
      if (nextSpeed !== null) {
        // Save speed for active loop if enabled
        if (this.enableLoopSpeedManagement && this.activeLoopId) {
          const result = this.loopSpeedManager.setLoopSpeed(this.activeLoopId, nextSpeed);
          if (result.success) {
            this.loopSpeedChanged.emit({ loopId: this.activeLoopId, speed: nextSpeed });
          }
        }
        
        if (this.useDirectIntegration) {
          this.youTubeService.setPlaybackRate(nextSpeed);
          this.currentRate = nextSpeed;
        } else {
          this.decreaseSpeed.emit();
        }
        
        // Reset transition state after animation completes
        setTimeout(() => this.isTransitioning.set(false), 300);
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

  /**
   * Get loop speed management status
   */
  get loopSpeedStatus(): {
    hasActiveLoop: boolean;
    activeLoopSpeed?: number;
    totalMappings: number;
  } {
    const hasActiveLoop = this.loopSpeedManager.hasActiveLoop();
    const activeLoopSpeed = this.activeLoopId ? this.loopSpeedManager.getLoopSpeed(this.activeLoopId) : undefined;
    
    const result = {
      hasActiveLoop,
      totalMappings: this.loopSpeedManager.totalMappings()
    } as {
      hasActiveLoop: boolean;
      activeLoopSpeed?: number;
      totalMappings: number;
    };
    
    if (activeLoopSpeed !== undefined) {
      result.activeLoopSpeed = activeLoopSpeed;
    }
    
    return result;
  }

  /**
   * Reset speed for current active loop
   */
  resetCurrentLoopSpeed(): void {
    if (this.activeLoopId && this.enableLoopSpeedManagement) {
      this.loopSpeedManager.removeLoopSpeed(this.activeLoopId);
      const globalSpeed = this.loopSpeedManager.globalSpeed();
      
      if (this.useDirectIntegration) {
        this.youTubeService.setPlaybackRate(globalSpeed);
      } else {
        this.rateChange.emit(globalSpeed);
      }
      
      this.currentRate = globalSpeed;
      this.manualSpeedControl.setValue(globalSpeed, { emitEvent: false });
    }
  }
}