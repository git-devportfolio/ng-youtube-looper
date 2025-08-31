import { Injectable, inject } from '@angular/core';
import { ValidationService } from './validation.service';

// Types alignés avec les interfaces existantes
export interface Loop {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  color?: string;
  playCount: number;
  isActive: boolean;
  playbackSpeed?: number;
  repeatCount?: number;
}

// Configuration par défaut pour les boucles
export const DEFAULT_LOOP_CONFIG = {
  color: '#3B82F6',
  playbackSpeed: 1.0,
  repeatCount: 1,
  playCount: 0,
  isActive: false
};

// Codes d'erreur pour la validation des boucles
export enum LoopValidationError {
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  OVERLAPPING_LOOPS = 'OVERLAPPING_LOOPS',
  EXCEEDS_VIDEO_DURATION = 'EXCEEDS_VIDEO_DURATION',
  INVALID_NAME = 'INVALID_NAME',
  INVALID_PLAYBACK_SPEED = 'INVALID_PLAYBACK_SPEED',
  NEGATIVE_TIME = 'NEGATIVE_TIME',
  ZERO_DURATION = 'ZERO_DURATION'
}

// Résultat de validation avec détails
export interface LoopValidationResult {
  isValid: boolean;
  errors: LoopValidationError[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LoopService {
  private readonly validationService = inject(ValidationService);

  /**
   * Generate a unique ID for a new loop
   */
  private generateLoopId(): string {
    return `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new loop with default values
   */
  createLoop(
    name: string,
    startTime: number,
    endTime: number,
    options: Partial<Loop> = {}
  ): Loop {
    return {
      id: this.generateLoopId(),
      name: name.trim(),
      startTime,
      endTime,
      color: options.color || DEFAULT_LOOP_CONFIG.color,
      playbackSpeed: options.playbackSpeed || DEFAULT_LOOP_CONFIG.playbackSpeed,
      repeatCount: options.repeatCount || DEFAULT_LOOP_CONFIG.repeatCount,
      playCount: DEFAULT_LOOP_CONFIG.playCount,
      isActive: DEFAULT_LOOP_CONFIG.isActive,
      ...options
    };
  }

  /**
   * Validate a loop against various criteria
   */
  validateLoop(loop: Loop, videoDuration?: number, existingLoops: Loop[] = []): LoopValidationResult {
    const errors: LoopValidationError[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!this.validationService.isValidLoopName(loop.name)) {
      errors.push(LoopValidationError.INVALID_NAME);
    }

    // Validate time range
    if (!this.isValidTimeRange(loop.startTime, loop.endTime)) {
      errors.push(LoopValidationError.INVALID_TIME_RANGE);
    }

    // Check for negative times
    if (loop.startTime < 0 || loop.endTime < 0) {
      errors.push(LoopValidationError.NEGATIVE_TIME);
    }

    // Check for zero duration
    if (loop.endTime <= loop.startTime) {
      errors.push(LoopValidationError.ZERO_DURATION);
    }

    // Validate playback speed if provided
    if (loop.playbackSpeed && !this.validationService.isValidPlaybackSpeed(loop.playbackSpeed)) {
      errors.push(LoopValidationError.INVALID_PLAYBACK_SPEED);
    }

    // Validate against video duration if provided
    if (videoDuration && loop.endTime > videoDuration) {
      errors.push(LoopValidationError.EXCEEDS_VIDEO_DURATION);
    }

    // Check for overlapping loops
    const overlapping = this.findOverlappingLoops(loop, existingLoops);
    if (overlapping.length > 0) {
      errors.push(LoopValidationError.OVERLAPPING_LOOPS);
      warnings.push(`Overlaps with loops: ${overlapping.map(l => l.name).join(', ')}`);
    }

    // Performance warnings
    if (videoDuration && this.calculateLoopDuration(loop) > videoDuration * 0.8) {
      warnings.push('Loop covers more than 80% of video duration');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if time range is valid
   */
  isValidTimeRange(startTime: number, endTime: number, videoDuration?: number): boolean {
    if (videoDuration) {
      return this.validationService.isValidTimeRange(startTime, endTime, videoDuration);
    }
    // Basic validation without duration check
    return startTime >= 0 && endTime > startTime;
  }

  /**
   * Calculate the duration of a loop in seconds
   */
  calculateLoopDuration(loop: Loop): number {
    return Math.max(0, loop.endTime - loop.startTime);
  }

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds: number): string {
    return this.validationService.formatTime(seconds);
  }

  /**
   * Parse time string to seconds
   */
  parseTime(timeString: string): number {
    return this.validationService.parseTime(timeString);
  }

  /**
   * Find loops that overlap with the given loop
   */
  findOverlappingLoops(loop: Loop, existingLoops: Loop[]): Loop[] {
    return existingLoops.filter(existing => 
      existing.id !== loop.id && this.doLoopsOverlap(loop, existing)
    );
  }

  /**
   * Check if two loops overlap
   */
  private doLoopsOverlap(loop1: Loop, loop2: Loop): boolean {
    return loop1.startTime < loop2.endTime && loop1.endTime > loop2.startTime;
  }

  /**
   * Get loops sorted by start time
   */
  sortLoopsByStartTime(loops: Loop[]): Loop[] {
    return [...loops].sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get active loops from a collection
   */
  getActiveLoops(loops: Loop[]): Loop[] {
    return loops.filter(loop => loop.isActive);
  }

  /**
   * Find the currently playing loop based on current time
   */
  getCurrentLoop(currentTime: number, loops: Loop[]): Loop | null {
    return loops.find(loop => 
      loop.isActive && 
      currentTime >= loop.startTime && 
      currentTime <= loop.endTime
    ) || null;
  }

  /**
   * Calculate total duration of all loops
   */
  calculateTotalLoopsDuration(loops: Loop[]): number {
    return loops.reduce((total, loop) => total + this.calculateLoopDuration(loop), 0);
  }

  /**
   * Get loop statistics
   */
  getLoopStatistics(loops: Loop[]): {
    totalCount: number;
    activeCount: number;
    totalDuration: number;
    averageDuration: number;
    mostPlayed: Loop | null;
  } {
    const totalCount = loops.length;
    const activeLoops = this.getActiveLoops(loops);
    const totalDuration = this.calculateTotalLoopsDuration(loops);
    const averageDuration = totalCount > 0 ? totalDuration / totalCount : 0;
    const mostPlayed = loops.reduce((prev, current) => 
      (prev.playCount > current.playCount) ? prev : current, loops[0] || null
    );

    return {
      totalCount,
      activeCount: activeLoops.length,
      totalDuration,
      averageDuration,
      mostPlayed
    };
  }
}