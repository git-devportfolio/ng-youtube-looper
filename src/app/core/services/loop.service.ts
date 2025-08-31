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
   * Calculate duration accounting for playback speed
   */
  calculateAdjustedLoopDuration(loop: Loop): number {
    const baseDuration = this.calculateLoopDuration(loop);
    const speed = loop.playbackSpeed || 1;
    return speed > 0 ? baseDuration / speed : baseDuration;
  }

  /**
   * Calculate total playback time for a loop with repeats
   */
  calculateTotalPlaybackTime(loop: Loop): number {
    const duration = this.calculateAdjustedLoopDuration(loop);
    const repeats = Math.max(1, loop.repeatCount || 1);
    return duration * repeats;
  }

  /**
   * Format time in MM:SS format
   */
  formatTime(seconds: number): string {
    return this.validationService.formatTime(seconds);
  }

  /**
   * Format time with extended precision (MM:SS.ms)
   */
  formatTimeExtended(seconds: number, showMilliseconds: boolean = false): string {
    if (seconds < 0) return '0:00' + (showMilliseconds ? '.000' : '');
    
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    const formatted = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    return showMilliseconds ? `${formatted}.${milliseconds.toString().padStart(3, '0')}` : formatted;
  }

  /**
   * Format duration with hours if needed (HH:MM:SS)
   */
  formatDuration(seconds: number): string {
    if (seconds < 0) return '0:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Parse time string to seconds (supports MM:SS, HH:MM:SS, and SS formats)
   */
  parseTime(timeString: string): number {
    if (!timeString || typeof timeString !== 'string') return 0;
    
    const trimmed = timeString.trim();
    if (!trimmed) return 0;
    
    // Handle direct seconds input
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const seconds = parseFloat(trimmed);
      return isNaN(seconds) ? 0 : Math.max(0, seconds);
    }
    
    // Handle MM:SS or HH:MM:SS format
    const parts = trimmed.split(':').map(part => part.trim());
    if (parts.length < 2 || parts.length > 3) {
      return this.validationService.parseTime(timeString);
    }
    
    let totalSeconds = 0;
    
    if (parts.length === 3) {
      // HH:MM:SS format
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
      if (hours < 0 || minutes < 0 || seconds < 0) return 0;
      if (minutes >= 60 || seconds >= 60) return 0;
      
      totalSeconds = hours * 3600 + minutes * 60 + seconds;
    } else {
      // MM:SS format
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      
      if (isNaN(minutes) || isNaN(seconds)) return 0;
      if (minutes < 0 || seconds < 0) return 0;
      if (seconds >= 60) return 0;
      
      totalSeconds = minutes * 60 + seconds;
    }
    
    return Math.max(0, totalSeconds);
  }

  /**
   * Convert seconds to frame number (useful for video editing)
   */
  secondsToFrames(seconds: number, frameRate: number = 30): number {
    return Math.floor(seconds * frameRate);
  }

  /**
   * Convert frame number to seconds
   */
  framesToSeconds(frames: number, frameRate: number = 30): number {
    return frameRate > 0 ? frames / frameRate : 0;
  }

  /**
   * Round time to nearest frame boundary
   */
  roundToFrame(seconds: number, frameRate: number = 30): number {
    if (frameRate <= 0) return seconds;
    const frames = Math.round(seconds * frameRate);
    return frames / frameRate;
  }

  /**
   * Calculate time remaining in loop at current position
   */
  getTimeRemainingInLoop(currentTime: number, loop: Loop): number {
    if (currentTime < loop.startTime || currentTime > loop.endTime) return 0;
    return Math.max(0, loop.endTime - currentTime);
  }

  /**
   * Calculate progress percentage within a loop
   */
  getLoopProgress(currentTime: number, loop: Loop): number {
    const duration = this.calculateLoopDuration(loop);
    if (duration <= 0) return 0;
    
    if (currentTime < loop.startTime) return 0;
    if (currentTime > loop.endTime) return 100;
    
    const progress = (currentTime - loop.startTime) / duration;
    return Math.max(0, Math.min(100, progress * 100));
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

  /**
   * Create a loop with automatic validation
   * Returns both the loop and validation result
   */
  createValidatedLoop(
    name: string,
    startTime: number,
    endTime: number,
    options: Partial<Loop> = {},
    videoDuration?: number,
    existingLoops: Loop[] = []
  ): { loop: Loop; validation: LoopValidationResult } {
    const loop = this.createLoop(name, startTime, endTime, options);
    const validation = this.validateLoop(loop, videoDuration, existingLoops);
    
    return { loop, validation };
  }

  /**
   * Suggest optimal loop placement to avoid overlaps
   */
  suggestNonOverlappingTimeRange(
    desiredStart: number,
    desiredDuration: number,
    existingLoops: Loop[],
    videoDuration?: number
  ): { startTime: number; endTime: number } | null {
    const desiredEnd = desiredStart + desiredDuration;
    
    // Sort existing loops by start time
    const sortedLoops = this.sortLoopsByStartTime(existingLoops);
    
    // Check if desired range is available
    const mockLoop: Loop = {
      id: 'temp',
      name: 'temp',
      startTime: desiredStart,
      endTime: desiredEnd,
      playCount: 0,
      isActive: false
    };
    
    if (this.findOverlappingLoops(mockLoop, existingLoops).length === 0) {
      // Check against video duration if provided
      if (!videoDuration || desiredEnd <= videoDuration) {
        return { startTime: desiredStart, endTime: desiredEnd };
      }
    }
    
    // Find gaps between existing loops
    for (let i = 0; i < sortedLoops.length - 1; i++) {
      const gapStart = sortedLoops[i].endTime;
      const gapEnd = sortedLoops[i + 1].startTime;
      const gapDuration = gapEnd - gapStart;
      
      if (gapDuration >= desiredDuration) {
        const suggestedEnd = gapStart + desiredDuration;
        if (!videoDuration || suggestedEnd <= videoDuration) {
          return { startTime: gapStart, endTime: suggestedEnd };
        }
      }
    }
    
    // Try placing after the last loop
    if (sortedLoops.length > 0) {
      const lastLoop = sortedLoops[sortedLoops.length - 1];
      const suggestedStart = lastLoop.endTime;
      const suggestedEnd = suggestedStart + desiredDuration;
      
      if (!videoDuration || suggestedEnd <= videoDuration) {
        return { startTime: suggestedStart, endTime: suggestedEnd };
      }
    }
    
    // Try placing before the first loop
    if (sortedLoops.length > 0 && sortedLoops[0].startTime >= desiredDuration) {
      const suggestedEnd = sortedLoops[0].startTime;
      const suggestedStart = Math.max(0, suggestedEnd - desiredDuration);
      
      if (suggestedStart >= 0) {
        return { startTime: suggestedStart, endTime: suggestedEnd };
      }
    }
    
    return null; // No suitable placement found
  }

  /**
   * Validate multiple loops for batch operations
   */
  validateMultipleLoops(
    loops: Loop[],
    videoDuration?: number
  ): Map<string, LoopValidationResult> {
    const results = new Map<string, LoopValidationResult>();
    
    loops.forEach((loop, index) => {
      // For each loop, exclude it from the existing loops when checking for overlaps
      const otherLoops = loops.filter((_, i) => i !== index);
      const validation = this.validateLoop(loop, videoDuration, otherLoops);
      results.set(loop.id, validation);
    });
    
    return results;
  }

  /**
   * Get optimal loop creation suggestions based on video analysis
   */
  getLoopCreationSuggestions(videoDuration: number, existingLoops: Loop[] = []): {
    shortLoop: { startTime: number; endTime: number; duration: number };
    mediumLoop: { startTime: number; endTime: number; duration: number };
    longLoop: { startTime: number; endTime: number; duration: number };
  } | null {
    if (videoDuration <= 0) return null;
    
    const shortDuration = Math.min(30, videoDuration * 0.1); // 30s or 10% of video
    const mediumDuration = Math.min(120, videoDuration * 0.25); // 2min or 25% of video
    const longDuration = Math.min(300, videoDuration * 0.5); // 5min or 50% of video
    
    const shortSuggestion = this.suggestNonOverlappingTimeRange(0, shortDuration, existingLoops, videoDuration);
    const mediumSuggestion = this.suggestNonOverlappingTimeRange(0, mediumDuration, existingLoops, videoDuration);
    const longSuggestion = this.suggestNonOverlappingTimeRange(0, longDuration, existingLoops, videoDuration);
    
    if (shortSuggestion && mediumSuggestion && longSuggestion) {
      return {
        shortLoop: { ...shortSuggestion, duration: shortDuration },
        mediumLoop: { ...mediumSuggestion, duration: mediumDuration },
        longLoop: { ...longSuggestion, duration: longDuration }
      };
    }
    
    return null;
  }
}