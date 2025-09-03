import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private readonly YOUTUBE_URL_REGEX = 
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  // Speed validation constants
  readonly MIN_PLAYBACK_SPEED = 0.25;
  readonly MAX_PLAYBACK_SPEED = 2.0;
  readonly DEFAULT_PLAYBACK_SPEED = 1.0;
  readonly PRECISION_THRESHOLD = 0.001;
  
  // Predefined speed steps for consistent control
  private readonly SPEED_STEPS = [
    0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0
  ];
  
  // Speed presets for quick selection
  private readonly SPEED_PRESETS = [
    { label: 'Très lent', value: 0.25, description: 'Pour apprentissage difficile' },
    { label: 'Lent', value: 0.5, description: 'Pour passages complexes' },
    { label: 'Modéré', value: 0.75, description: 'Pratique confortable' },
    { label: 'Normal', value: 1.0, description: 'Vitesse originale' },
    { label: 'Rapide', value: 1.25, description: 'Légèrement accéléré' },
    { label: 'Très rapide', value: 1.5, description: 'Pour révision' },
    { label: 'Maximum', value: 2.0, description: 'Vitesse maximale' }
  ];

  validateYouTubeUrl(url: string): string | null {
    const match = url.match(this.YOUTUBE_URL_REGEX);
    return match ? match[1] : null;
  }

  sanitizeVideoId(videoId: string): string {
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  isValidTimeRange(start: number, end: number, duration: number): boolean {
    return start >= 0 && end > start && end <= duration;
  }

  isValidLoopName(name: string): boolean {
    return name.trim().length > 0 && name.trim().length <= 50;
  }

  isValidPlaybackSpeed(speed: number, enforceSteps: boolean = false): boolean {
    if (speed < this.MIN_PLAYBACK_SPEED || speed > this.MAX_PLAYBACK_SPEED) {
      return false;
    }
    
    if (enforceSteps) {
      return this.SPEED_STEPS.some(step => 
        Math.abs(step - speed) < this.PRECISION_THRESHOLD
      );
    }
    
    return true;
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  parseTime(timeString: string): number {
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    
    if (isNaN(minutes) || isNaN(seconds)) return 0;
    
    return minutes * 60 + seconds;
  }

  /**
   * Validates and formats a complete speed control configuration
   */
  validateSpeedConfiguration(config: {
    currentSpeed: number;
    allowedRange?: [number, number];
    enforceSteps?: boolean;
  }): {
    isValid: boolean;
    correctedSpeed?: number;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    const { currentSpeed, allowedRange, enforceSteps = true } = config;
    
    // Validate current speed
    if (!this.isValidPlaybackSpeed(currentSpeed, enforceSteps)) {
      if (currentSpeed < this.MIN_PLAYBACK_SPEED || currentSpeed > this.MAX_PLAYBACK_SPEED) {
        errors.push(`Vitesse ${currentSpeed}x hors limite (${this.MIN_PLAYBACK_SPEED}x - ${this.MAX_PLAYBACK_SPEED}x)`);
      } else if (enforceSteps) {
        warnings.push(`Vitesse ${currentSpeed}x arrondie au pas le plus proche`);
      }
    }
    
    // Validate custom range if provided
    if (allowedRange) {
      const [min, max] = allowedRange;
      if (currentSpeed < min || currentSpeed > max) {
        errors.push(`Vitesse ${currentSpeed}x hors de la plage autorisée (${min}x - ${max}x)`);
      }
    }
    
    const correctedSpeed = this.roundToValidStep(currentSpeed);
    
    return {
      isValid: errors.length === 0,
      correctedSpeed: correctedSpeed !== currentSpeed ? correctedSpeed : undefined,
      warnings,
      errors
    };
  }

  /**
   * Gets the next valid speed increment
   */
  getNextValidSpeed(currentSpeed: number, direction: 'up' | 'down' = 'up'): number | null {
    const validSpeeds = this.getAllValidSpeeds();
    const currentIndex = validSpeeds.findIndex(speed => 
      Math.abs(speed - currentSpeed) < this.PRECISION_THRESHOLD
    );
    
    if (currentIndex === -1) {
      // Current speed not in valid list, find nearest
      const rounded = this.roundToValidStep(currentSpeed);
      return this.getNextValidSpeed(rounded, direction);
    }
    
    const nextIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex < 0 || nextIndex >= validSpeeds.length) {
      return null; // No more valid speeds in that direction
    }
    
    return validSpeeds[nextIndex];
  }

  /**
   * Checks if two speeds are effectively equal (within precision threshold)
   */
  areSpeedsEqual(speed1: number, speed2: number): boolean {
    return Math.abs(speed1 - speed2) < this.PRECISION_THRESHOLD;
  }

  /**
   * Gets all valid speed values
   */
  getAllValidSpeeds(): number[] {
    return [...this.SPEED_STEPS];
  }

  /**
   * Rounds a speed to the nearest valid step
   */
  roundToValidStep(speed: number): number {
    if (speed < this.MIN_PLAYBACK_SPEED) return this.MIN_PLAYBACK_SPEED;
    if (speed > this.MAX_PLAYBACK_SPEED) return this.MAX_PLAYBACK_SPEED;

    return this.SPEED_STEPS.reduce((closest, step) => {
      return Math.abs(step - speed) < Math.abs(closest - speed) ? step : closest;
    });
  }

  /**
   * Gets predefined speed presets for quick selection
   */
  getValidSpeedPresets(): Array<{label: string, value: number, description: string}> {
    return [...this.SPEED_PRESETS];
  }

  /**
   * Validates speed input from user interface
   */
  validateSpeedInput(input: string, allowFreeForm: boolean = false): {
    isValid: boolean;
    value?: number;
    error?: string;
    suggestion?: number;
  } {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return {
        isValid: false,
        error: 'Vitesse requise'
      };
    }

    // Remove 'x' suffix if present
    const cleanInput = trimmed.replace(/x$/i, '');
    const numericValue = parseFloat(cleanInput);

    if (isNaN(numericValue)) {
      return {
        isValid: false,
        error: 'Format invalide (exemple: 1.5 ou 1.5x)'
      };
    }

    if (numericValue < this.MIN_PLAYBACK_SPEED) {
      return {
        isValid: false,
        error: `Minimum ${this.MIN_PLAYBACK_SPEED}x`,
        suggestion: this.MIN_PLAYBACK_SPEED
      };
    }

    if (numericValue > this.MAX_PLAYBACK_SPEED) {
      return {
        isValid: false,
        error: `Maximum ${this.MAX_PLAYBACK_SPEED}x`,
        suggestion: this.MAX_PLAYBACK_SPEED
      };
    }

    if (!allowFreeForm) {
      const rounded = this.roundToValidStep(numericValue);
      if (!this.areSpeedsEqual(numericValue, rounded)) {
        return {
          isValid: false,
          error: `Vitesse non autorisée`,
          suggestion: rounded
        };
      }
    }

    return {
      isValid: true,
      value: numericValue
    };
  }

  /**
   * Formats a speed value for display
   */
  formatSpeed(speed: number, showUnit: boolean = true): string {
    const formatted = speed.toFixed(2).replace(/\.?0+$/, '');
    return showUnit ? `${formatted}x` : formatted;
  }

  /**
   * Gets speed step size for increment/decrement operations
   */
  getSpeedStepSize(): number {
    return 0.25;
  }

  /**
   * Validates if a speed is within custom range
   */
  isSpeedInRange(speed: number, minSpeed?: number, maxSpeed?: number): boolean {
    const min = minSpeed ?? this.MIN_PLAYBACK_SPEED;
    const max = maxSpeed ?? this.MAX_PLAYBACK_SPEED;
    return speed >= min && speed <= max;
  }
}