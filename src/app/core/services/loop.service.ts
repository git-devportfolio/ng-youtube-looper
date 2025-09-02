import { Injectable, inject } from '@angular/core';
import { ValidationService } from './validation.service';
import { 
  LoopSegment as Loop, 
  LoopValidationError, 
  LoopValidationResult,
  LoopStatistics,
  LoopCollectionValidation,
  LoopConflictResolution,
  LoopConflictResult,
  DEFAULT_LOOP_CONFIGURATION
} from '@shared/interfaces';

// Re-export for backward compatibility
export { Loop, LoopValidationError, LoopValidationResult };

// Configuration par défaut pour les boucles
export const DEFAULT_LOOP_CONFIG = {
  color: '#3B82F6',
  playbackSpeed: 1.0,
  repeatCount: 1,
  playCount: 0,
  isActive: false
};

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

  /**
   * Advanced collision detection and resolution methods (Task 23.4)
   */

  /**
   * Detect all types of loop conflicts in a collection
   */
  detectLoopConflicts(loops: Loop[], videoDuration?: number): {
    overlapping: { loop1: Loop; loop2: Loop; overlapStart: number; overlapEnd: number; overlapDuration: number }[];
    exceedingDuration: Loop[];
    invalidTimes: Loop[];
    duplicateNames: Loop[];
  } {
    const conflicts = {
      overlapping: [] as { loop1: Loop; loop2: Loop; overlapStart: number; overlapEnd: number; overlapDuration: number }[],
      exceedingDuration: [] as Loop[],
      invalidTimes: [] as Loop[],
      duplicateNames: [] as Loop[]
    };

    // Check for invalid times (negative, NaN, or zero duration)
    conflicts.invalidTimes = loops.filter(loop => 
      isNaN(loop.startTime) || isNaN(loop.endTime) ||
      loop.startTime < 0 || loop.endTime < 0 ||
      loop.endTime <= loop.startTime
    );

    // Check for loops exceeding video duration
    if (videoDuration && videoDuration > 0) {
      conflicts.exceedingDuration = loops.filter(loop => 
        loop.endTime > videoDuration || loop.startTime >= videoDuration
      );
    }

    // Check for overlapping loops
    for (let i = 0; i < loops.length; i++) {
      for (let j = i + 1; j < loops.length; j++) {
        const loop1 = loops[i];
        const loop2 = loops[j];
        
        if (this.doLoopsOverlap(loop1, loop2)) {
          const overlapStart = Math.max(loop1.startTime, loop2.startTime);
          const overlapEnd = Math.min(loop1.endTime, loop2.endTime);
          const overlapDuration = overlapEnd - overlapStart;
          
          conflicts.overlapping.push({
            loop1,
            loop2,
            overlapStart,
            overlapEnd,
            overlapDuration
          });
        }
      }
    }

    // Check for duplicate names
    const nameCount = new Map<string, Loop[]>();
    loops.forEach(loop => {
      const normalizedName = loop.name.trim().toLowerCase();
      if (!nameCount.has(normalizedName)) {
        nameCount.set(normalizedName, []);
      }
      nameCount.get(normalizedName)!.push(loop);
    });

    nameCount.forEach(loopsWithSameName => {
      if (loopsWithSameName.length > 1) {
        conflicts.duplicateNames.push(...loopsWithSameName);
      }
    });

    return conflicts;
  }

  /**
   * Automatically resolve loop conflicts where possible
   */
  resolveLoopConflicts(
    loops: Loop[], 
    videoDuration?: number,
    options: {
      adjustOverlaps?: boolean;
      trimToVideoDuration?: boolean;
      renameDuplicates?: boolean;
      removeInvalid?: boolean;
    } = {}
  ): {
    resolvedLoops: Loop[];
    removedLoops: Loop[];
    modifications: Array<{
      loopId: string;
      action: 'renamed' | 'adjusted' | 'trimmed' | 'removed';
      details: string;
    }>;
  } {
    const {
      adjustOverlaps = true,
      trimToVideoDuration = true,
      renameDuplicates = true,
      removeInvalid = true
    } = options;

    let workingLoops = [...loops];
    const removedLoops: Loop[] = [];
    const modifications: Array<{
      loopId: string;
      action: 'renamed' | 'adjusted' | 'trimmed' | 'removed';
      details: string;
    }> = [];

    // Remove invalid loops
    if (removeInvalid) {
      const invalidLoops = workingLoops.filter(loop => 
        isNaN(loop.startTime) || isNaN(loop.endTime) ||
        loop.startTime < 0 || loop.endTime < 0 ||
        loop.endTime <= loop.startTime
      );
      
      invalidLoops.forEach(loop => {
        modifications.push({
          loopId: loop.id,
          action: 'removed',
          details: 'Invalid time values (negative, NaN, or zero duration)'
        });
        removedLoops.push(loop);
      });
      
      workingLoops = workingLoops.filter(loop => !invalidLoops.includes(loop));
    }

    // Trim loops that exceed video duration
    if (trimToVideoDuration && videoDuration && videoDuration > 0) {
      workingLoops = workingLoops.map(loop => {
        if (loop.endTime > videoDuration) {
          if (loop.startTime >= videoDuration) {
            // Loop starts after video ends, remove it
            modifications.push({
              loopId: loop.id,
              action: 'removed',
              details: `Loop starts after video duration (${videoDuration}s)`
            });
            removedLoops.push(loop);
            return null;
          } else {
            // Trim end time to video duration
            modifications.push({
              loopId: loop.id,
              action: 'trimmed',
              details: `End time adjusted from ${loop.endTime}s to ${videoDuration}s`
            });
            return { ...loop, endTime: videoDuration };
          }
        }
        return loop;
      }).filter((loop): loop is Loop => loop !== null);
    }

    // Resolve duplicate names
    if (renameDuplicates) {
      const nameCount = new Map<string, number>();
      workingLoops = workingLoops.map(loop => {
        const baseName = loop.name.trim();
        const normalizedName = baseName.toLowerCase();
        
        if (!nameCount.has(normalizedName)) {
          nameCount.set(normalizedName, 1);
          return loop;
        } else {
          const count = nameCount.get(normalizedName)!;
          nameCount.set(normalizedName, count + 1);
          const newName = `${baseName} (${count + 1})`;
          
          modifications.push({
            loopId: loop.id,
            action: 'renamed',
            details: `Renamed from "${baseName}" to "${newName}" to avoid duplicates`
          });
          
          return { ...loop, name: newName };
        }
      });
    }

    // Adjust overlapping loops
    if (adjustOverlaps) {
      const sortedLoops = this.sortLoopsByStartTime(workingLoops);
      const adjustedLoops: Loop[] = [];
      
      for (const currentLoop of sortedLoops) {
        let adjustedLoop = { ...currentLoop };
        let hasOverlap = true;
        let attempts = 0;
        const maxAttempts = 10; // Prevent infinite loops
        
        while (hasOverlap && attempts < maxAttempts) {
          hasOverlap = false;
          attempts++;
          
          for (const existingLoop of adjustedLoops) {
            if (this.doLoopsOverlap(adjustedLoop, existingLoop)) {
              hasOverlap = true;
              
              // Try to place after the existing loop
              const newStartTime = existingLoop.endTime;
              const duration = adjustedLoop.endTime - adjustedLoop.startTime;
              const newEndTime = newStartTime + duration;
              
              // Check if the new position would exceed video duration
              if (videoDuration && newEndTime > videoDuration) {
                // Try to place before the existing loop
                const beforeEndTime = existingLoop.startTime;
                const beforeStartTime = Math.max(0, beforeEndTime - duration);
                
                if (beforeStartTime >= 0 && beforeEndTime > beforeStartTime) {
                  adjustedLoop = {
                    ...adjustedLoop,
                    startTime: beforeStartTime,
                    endTime: beforeEndTime
                  };
                } else {
                  // Can't fit anywhere, remove this loop
                  modifications.push({
                    loopId: adjustedLoop.id,
                    action: 'removed',
                    details: 'Could not resolve overlap - insufficient space'
                  });
                  removedLoops.push(adjustedLoop);
                  hasOverlap = false; // Exit the loop
                  adjustedLoop = null as any;
                  break;
                }
              } else {
                adjustedLoop = {
                  ...adjustedLoop,
                  startTime: newStartTime,
                  endTime: newEndTime
                };
              }
              
              if (adjustedLoop) {
                modifications.push({
                  loopId: adjustedLoop.id,
                  action: 'adjusted',
                  details: `Moved to ${adjustedLoop.startTime}s-${adjustedLoop.endTime}s to resolve overlap`
                });
              }
              break; // Check overlaps again with the new position
            }
          }
        }
        
        if (adjustedLoop && attempts < maxAttempts) {
          adjustedLoops.push(adjustedLoop);
        } else if (adjustedLoop && attempts >= maxAttempts) {
          modifications.push({
            loopId: adjustedLoop.id,
            action: 'removed',
            details: 'Could not resolve overlap after maximum attempts'
          });
          removedLoops.push(adjustedLoop);
        }
      }
      
      workingLoops = adjustedLoops;
    }

    return {
      resolvedLoops: workingLoops,
      removedLoops,
      modifications
    };
  }

  /**
   * Check if loops collection has any critical issues
   */
  validateLoopCollection(loops: Loop[], videoDuration?: number): {
    isValid: boolean;
    criticalIssues: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (loops.length === 0) {
      warnings.push('No loops defined');
      suggestions.push('Add at least one loop to begin practicing');
      return { isValid: true, criticalIssues, warnings, suggestions };
    }

    const conflicts = this.detectLoopConflicts(loops, videoDuration);

    // Critical issues
    if (conflicts.invalidTimes.length > 0) {
      criticalIssues.push(`${conflicts.invalidTimes.length} loop(s) have invalid time values`);
    }

    if (videoDuration && conflicts.exceedingDuration.length > 0) {
      criticalIssues.push(`${conflicts.exceedingDuration.length} loop(s) exceed video duration (${videoDuration}s)`);
    }

    // Warnings
    if (conflicts.overlapping.length > 0) {
      warnings.push(`${conflicts.overlapping.length} overlapping loop pair(s) detected`);
      suggestions.push('Use resolveLoopConflicts() to automatically adjust overlapping loops');
    }

    if (conflicts.duplicateNames.length > 0) {
      const uniqueNames = new Set(conflicts.duplicateNames.map(l => l.name.toLowerCase()));
      warnings.push(`${uniqueNames.size} duplicate loop name(s) found`);
      suggestions.push('Consider renaming loops for better organization');
    }

    // Performance suggestions
    const totalDuration = this.calculateTotalLoopsDuration(loops);
    if (videoDuration && totalDuration > videoDuration * 1.5) {
      suggestions.push('Total loop duration exceeds 150% of video duration - consider reducing overlap');
    }

    const activeLoops = this.getActiveLoops(loops);
    if (activeLoops.length === 0) {
      warnings.push('No active loops - enable at least one loop for playback');
    }

    if (activeLoops.length > 5) {
      suggestions.push('Consider organizing loops into practice sessions for better focus');
    }

    return {
      isValid: criticalIssues.length === 0,
      criticalIssues,
      warnings,
      suggestions
    };
  }

  /**
   * Get comprehensive loop analysis for debugging
   */
  analyzeLoopsForDebug(loops: Loop[], videoDuration?: number): {
    summary: {
      total: number;
      active: number;
      totalDuration: number;
      averageDuration: number;
      coveragePercentage?: number;
    };
    timeRanges: {
      earliest: number;
      latest: number;
      gaps: Array<{ start: number; end: number; duration: number }>;
      overlaps: Array<{ start: number; end: number; duration: number; loopCount: number }>;
    };
    conflicts: {
      overlapping: { loop1: Loop; loop2: Loop; overlapStart: number; overlapEnd: number; overlapDuration: number }[];
      exceedingDuration: Loop[];
      invalidTimes: Loop[];
      duplicateNames: Loop[];
    };
    validation: {
      isValid: boolean;
      criticalIssues: string[];
      warnings: string[];
      suggestions: string[];
    };
  } {
    const totalDuration = this.calculateTotalLoopsDuration(loops);
    const sortedLoops = this.sortLoopsByStartTime(loops);
    
    const summary = {
      total: loops.length,
      active: this.getActiveLoops(loops).length,
      totalDuration,
      averageDuration: loops.length > 0 ? totalDuration / loops.length : 0,
      ...(videoDuration && { coveragePercentage: (totalDuration / videoDuration) * 100 })
    };

    // Analyze time ranges
    const timeRanges = {
      earliest: loops.length > 0 ? Math.min(...loops.map(l => l.startTime)) : 0,
      latest: loops.length > 0 ? Math.max(...loops.map(l => l.endTime)) : 0,
      gaps: [] as Array<{ start: number; end: number; duration: number }>,
      overlaps: [] as Array<{ start: number; end: number; duration: number; loopCount: number }>
    };

    // Find gaps between loops
    for (let i = 0; i < sortedLoops.length - 1; i++) {
      const currentEnd = sortedLoops[i].endTime;
      const nextStart = sortedLoops[i + 1].startTime;
      if (nextStart > currentEnd) {
        timeRanges.gaps.push({
          start: currentEnd,
          end: nextStart,
          duration: nextStart - currentEnd
        });
      }
    }

    // Find overlapping regions
    const conflicts = this.detectLoopConflicts(loops, videoDuration);
    const overlapMap = new Map<string, { start: number; end: number; loopIds: Set<string> }>();
    
    conflicts.overlapping.forEach(({ overlapStart, overlapEnd, loop1, loop2 }) => {
      const key = `${overlapStart}-${overlapEnd}`;
      if (!overlapMap.has(key)) {
        overlapMap.set(key, {
          start: overlapStart,
          end: overlapEnd,
          loopIds: new Set([loop1.id, loop2.id])
        });
      } else {
        overlapMap.get(key)!.loopIds.add(loop1.id);
        overlapMap.get(key)!.loopIds.add(loop2.id);
      }
    });

    timeRanges.overlaps = Array.from(overlapMap.values()).map(overlap => ({
      start: overlap.start,
      end: overlap.end,
      duration: overlap.end - overlap.start,
      loopCount: overlap.loopIds.size
    }));

    const validation = this.validateLoopCollection(loops, videoDuration);

    return {
      summary,
      timeRanges,
      conflicts,
      validation
    };
  }
}