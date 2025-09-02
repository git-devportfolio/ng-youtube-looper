import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ValidationService {
  private readonly YOUTUBE_URL_REGEX = 
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

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

  isValidPlaybackSpeed(speed: number): boolean {
    return speed >= 0.25 && speed <= 2.0;
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
}