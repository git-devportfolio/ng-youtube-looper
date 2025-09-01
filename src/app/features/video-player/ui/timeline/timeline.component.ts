import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineViewModel, LoopSegment } from '../../../loop-manager/data-access/loop-manager.facade';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss'
})
export class TimelineComponent {
  // Input properties
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() disabled = false;
  @Input() isLoading = false;
  @Input() isPlaying = false; // New input for animation states
  @Input() loops: LoopSegment[] = [];
  @Input() timelineVm?: TimelineViewModel; // Optional ViewModel input
  @Input() canCreateLoop = true; // Allow loop creation by default

  // Output events for navigation
  @Output() seekTo = new EventEmitter<number>();
  @Output() timelineClick = new EventEmitter<number>();
  @Output() seekStart = new EventEmitter<void>();
  @Output() seekEnd = new EventEmitter<void>();
  
  // Output events for loop segments - updated to use string IDs
  @Output() loopMove = new EventEmitter<{id: string, startTime: number, endTime: number}>();
  @Output() loopResize = new EventEmitter<{id: string, startTime: number, endTime: number}>();
  @Output() loopSelect = new EventEmitter<string>();
  @Output() loopDeselect = new EventEmitter<void>();
  
  // Output events for loop creation
  @Output() loopCreate = new EventEmitter<{startTime: number, endTime: number}>();
  @Output() loopDelete = new EventEmitter<string>();
  @Output() loopUpdate = new EventEmitter<{id: string, name?: string, color?: string}>();

  // Internal state for seeking animation
  private isSeeking = false;
  
  // Touch interaction state
  private touchStartTime: number | null = null;
  
  // Interaction state for enhanced selection
  private interactionState = {
    lastClickTime: 0,
    isNavigating: false,
    focusedElement: null as HTMLElement | null
  };
  
  // Drag & drop state for loop segments - updated to use string IDs
  private dragState: {
    isDragging: boolean;
    dragType: 'move' | 'resize-left' | 'resize-right' | 'create' | null;
    loopId: string | null;
    startX: number;
    initialStartTime: number;
    initialEndTime: number;
    // Loop creation state
    createStartTime?: number;
    createStartX?: number;
  } = {
    isDragging: false,
    dragType: null,
    loopId: null,
    startX: 0,
    initialStartTime: 0,
    initialEndTime: 0
  };
  
  // Selected loop for editing - updated to use string ID
  private _selectedLoopId: string | null = null;
  
  /**
   * Get selected loop ID for template binding
   */
  get selectedLoopId(): string | null {
    return this._selectedLoopId;
  }
  
  /**
   * Get effective loops from input or ViewModel
   */
  get effectiveLoops(): LoopSegment[] {
    return this.timelineVm?.loops || this.loops;
  }
  
  /**
   * Check if loop creation is enabled
   */
  get canCreateLoops(): boolean {
    return this.canCreateLoop && (this.timelineVm?.canCreateLoop ?? true);
  }

  /**
   * Calculate the current time position as percentage
   */
  get currentTimePercentage(): number {
    if (this.duration === 0) return 0;
    return Math.min((this.currentTime / this.duration) * 100, 100);
  }

  /**
   * Check if timeline is ready for interactions
   */
  get isReady(): boolean {
    return !this.isLoading && !this.disabled && this.duration > 0;
  }

  /**
   * Get CSS classes for the current time indicator
   */
  get indicatorClasses(): string {
    const classes: string[] = [];
    
    if (this.isSeeking) {
      classes.push('seeking');
    }
    
    if (!this.isPlaying && this.isReady) {
      classes.push('paused');
    }
    
    return classes.join(' ');
  }


  /**
   * Start seeking state for visual feedback
   */
  private startSeeking(): void {
    this.isSeeking = true;
    this.seekStart.emit();
  }

  /**
   * End seeking state
   */
  private endSeeking(): void {
    this.isSeeking = false;
    this.seekEnd.emit();
  }

  /**
   * Convert time to readable format with precision
   */
  getTimeAtPosition(percentage: number): number {
    return (percentage / 100) * this.duration;
  }

  /**
   * Get position percentage for a given time with enhanced precision and optimization
   */
  getPositionForTime(time: number): number {
    // Handle edge cases
    if (this.duration === 0 || time < 0) return 0;
    if (time >= this.duration) return 100;
    
    // Optimized calculation with better precision
    return Math.round(((time / this.duration) * 100) * 1000) / 1000;
  }

  /**
   * Get multiple position percentages for an array of times (batch optimization)
   */
  getPositionsForTimes(times: number[]): number[] {
    if (this.duration === 0) return times.map(() => 0);
    
    // Optimized calculation with better precision for multiple times
    const durationReciprocal = 100 / this.duration;
    return times.map(time => {
      if (time < 0) return 0;
      if (time >= this.duration) return 100;
      return Math.round((time * durationReciprocal) * 1000) / 1000;
    });
  }
  

  /**
   * Handle touch start for mobile navigation with enhanced interaction
   */
  onTouchStart(event: TouchEvent): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    this.touchStartTime = Date.now();
    this.interactionState.isNavigating = true;
    this.startSeeking();
    
    // Store touch position for enhanced handling in touch end
    const touch = event.touches[0];
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const percentage = Math.min(Math.max(touchX / rect.width, 0), 1);
    const touchTime = percentage * this.duration;
    
    // Pre-identify touched loop for smoother interaction
    const touchedLoop = this.getLoopAtTime(touchTime);
    if (touchedLoop) {
      // Pre-select visual feedback (can be enhanced with CSS)
      this.interactionState.focusedElement = event.target as HTMLElement;
    }
  }

  /**
   * Handle touch end for mobile navigation with loop segment awareness
   */
  onTouchEnd(event: TouchEvent): void {
    if (!this.isReady || this.touchStartTime === null) return;
    
    event.preventDefault();
    
    // Only process as tap if touch was brief (< 300ms)
    const touchDuration = Date.now() - this.touchStartTime;
    if (touchDuration < 300) {
      const touch = event.changedTouches[0];
      const track = event.currentTarget as HTMLElement;
      const rect = track.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const percentage = Math.min(Math.max(touchX / rect.width, 0), 1);
      const targetTime = percentage * this.duration;
      
      // Check for loop segment at touch position
      const touchedLoop = this.getLoopAtTime(targetTime);
      
      if (touchedLoop) {
        // If touching within a loop, select it
        if (this._selectedLoopId !== touchedLoop.id) {
          this._selectedLoopId = touchedLoop.id;
          this.loopSelect.emit(touchedLoop.id);
          
          // Update focus for accessibility
          this.updateFocusState(event.target as HTMLElement);
        }
      } else if (this._selectedLoopId !== null) {
        // If touching outside loops, deselect
        this._selectedLoopId = null;
        this.loopDeselect.emit();
      }
      
      // Always perform navigation
      this.seekTo.emit(targetTime);
      this.timelineClick.emit(targetTime);
    }
    
    this.touchStartTime = null;
    this.interactionState.isNavigating = false;
    this.interactionState.focusedElement = null;
    
    // End seeking state after a short delay
    setTimeout(() => this.endSeeking(), 200);
  }

  /**
   * Enhanced click handler with touch prevention and loop segment awareness
   */
  onTrackClick(event: MouseEvent): void {
    if (!this.isReady) return;
    
    // Prevent double events from touch devices
    if (this.touchStartTime !== null) return;
    
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    const targetTime = percentage * this.duration;
    
    // Check if click is within a loop segment
    const clickedLoop = this.getLoopAtTime(targetTime);
    
    // Update interaction state
    const now = Date.now();
    const isDoubleClick = now - this.interactionState.lastClickTime < 300;
    this.interactionState.lastClickTime = now;
    this.interactionState.isNavigating = true;
    
    this.startSeeking();
    
    if (clickedLoop && !isDoubleClick) {
      // If clicking within a loop, select it first
      if (this._selectedLoopId !== clickedLoop.id) {
        this._selectedLoopId = clickedLoop.id;
        this.loopSelect.emit(clickedLoop.id);
        
        // Focus management for accessibility
        this.updateFocusState(event.target as HTMLElement);
      }
    } else if (!clickedLoop) {
      // If clicking outside loops, deselect any selected loop
      if (this._selectedLoopId !== null) {
        this._selectedLoopId = null;
        this.loopDeselect.emit();
      }
    }
    
    // Always perform navigation
    this.seekTo.emit(targetTime);
    this.timelineClick.emit(targetTime);
    
    // End seeking state after a short delay
    setTimeout(() => {
      this.endSeeking();
      this.interactionState.isNavigating = false;
    }, 200);
  }

  /**
   * Handle double-click for loop creation
   */
  onTrackDoubleClick(event: MouseEvent): void {
    if (!this.isReady || !this.canCreateLoops) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    const clickTime = percentage * this.duration;
    
    // Create a 5-second loop centered on the click position
    const loopDuration = 5; // 5 seconds
    const startTime = Math.max(0, clickTime - loopDuration / 2);
    const endTime = Math.min(this.duration, startTime + loopDuration);
    
    // Check for collisions before creating
    if (!this.checkLoopCollision('', startTime, endTime)) {
      this.loopCreate.emit({ startTime, endTime });
    }
  }

  /**
   * Handle keyboard shortcuts for loop creation
   */
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isReady || !this.canCreateLoops) return;
    
    // Ctrl+L or Cmd+L to create loop at current time
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      
      const loopDuration = 5; // 5 seconds
      const startTime = Math.max(0, this.currentTime - loopDuration / 2);
      const endTime = Math.min(this.duration, startTime + loopDuration);
      
      if (!this.checkLoopCollision('', startTime, endTime)) {
        this.loopCreate.emit({ startTime, endTime });
      }
    }
    
    // Delete key to delete selected loop
    if (event.key === 'Delete' && this._selectedLoopId) {
      event.preventDefault();
      this.loopDelete.emit(this._selectedLoopId);
      this._selectedLoopId = null;
    }
  }

  /**
   * Get loop segment position and width as percentages with enhanced precision
   */
  getLoopPosition(loop: LoopSegment): {left: number, width: number} {
    if (this.duration === 0) return {left: 0, width: 0};
    
    // Enhanced edge case handling
    const startTime = Math.max(0, Math.min(loop.startTime, this.duration));
    const endTime = Math.max(startTime, Math.min(loop.endTime, this.duration));
    
    // Pre-calculate reciprocal for performance
    const durationReciprocal = 100 / this.duration;
    
    const left = startTime * durationReciprocal;
    const width = (endTime - startTime) * durationReciprocal;
    
    return {
      left: Math.round(Math.max(0, Math.min(left, 100)) * 1000) / 1000,
      width: Math.round(Math.max(0, Math.min(width, 100 - left)) * 1000) / 1000
    };
  }

  /**
   * Get multiple loop positions simultaneously for performance optimization
   */
  getMultipleLoopPositions(loops: LoopSegment[]): Array<{id: string, left: number, width: number}> {
    if (this.duration === 0) {
      return loops.map(loop => ({id: loop.id, left: 0, width: 0}));
    }

    // Pre-calculate reciprocal once for all loops
    const durationReciprocal = 100 / this.duration;
    
    return loops.map(loop => {
      const startTime = Math.max(0, Math.min(loop.startTime, this.duration));
      const endTime = Math.max(startTime, Math.min(loop.endTime, this.duration));
      
      const left = startTime * durationReciprocal;
      const width = (endTime - startTime) * durationReciprocal;
      
      return {
        id: loop.id,
        left: Math.round(Math.max(0, Math.min(left, 100)) * 1000) / 1000,
        width: Math.round(Math.max(0, Math.min(width, 100 - left)) * 1000) / 1000
      };
    });
  }

  /**
   * Get CSS classes for loop segment
   */
  getLoopClasses(loop: LoopSegment): string {
    const classes: string[] = ['loop-segment'];
    
    if (this._selectedLoopId === loop.id) {
      classes.push('selected');
    }
    
    if (this.dragState.isDragging && this.dragState.loopId === loop.id) {
      classes.push('dragging');
    }
    
    return classes.join(' ');
  }

  /**
   * Handle loop segment mouse down for drag operations
   */
  onLoopMouseDown(event: MouseEvent, loop: LoopSegment, dragType: 'move' | 'resize-left' | 'resize-right'): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.dragState = {
      isDragging: true,
      dragType,
      loopId: loop.id,
      startX: event.clientX,
      initialStartTime: loop.startTime,
      initialEndTime: loop.endTime
    };
    
    this._selectedLoopId = loop.id;
    this.loopSelect.emit(loop.id);
  }

  /**
   * Handle loop segment selection
   */
  onLoopClick(event: MouseEvent, loop: LoopSegment): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (this._selectedLoopId === loop.id) {
      this._selectedLoopId = null;
      this.loopDeselect.emit();
    } else {
      this._selectedLoopId = loop.id;
      this.loopSelect.emit(loop.id);
    }
  }

  /**
   * Global mouse move handler for drag operations
   */
  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.dragState.isDragging || !this.isReady) return;
    
    const deltaX = event.clientX - this.dragState.startX;
    const track = document.querySelector('.timeline-track') as HTMLElement;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const deltaTime = (deltaX / rect.width) * this.duration;
    
    const loop = this.effectiveLoops.find(l => l.id === this.dragState.loopId);
    if (!loop) return;
    
    let newStartTime = this.dragState.initialStartTime;
    let newEndTime = this.dragState.initialEndTime;
    
    switch (this.dragState.dragType) {
      case 'move':
        newStartTime = Math.max(0, Math.min(this.dragState.initialStartTime + deltaTime, this.duration - (this.dragState.initialEndTime - this.dragState.initialStartTime)));
        newEndTime = newStartTime + (this.dragState.initialEndTime - this.dragState.initialStartTime);
        break;
        
      case 'resize-left':
        newStartTime = Math.max(0, Math.min(this.dragState.initialStartTime + deltaTime, this.dragState.initialEndTime - 1));
        break;
        
      case 'resize-right':
        newEndTime = Math.max(this.dragState.initialStartTime + 1, Math.min(this.dragState.initialEndTime + deltaTime, this.duration));
        break;
    }
    
    // Check for collisions with other loops
    if (this.checkLoopCollision(this.dragState.loopId!, newStartTime, newEndTime)) {
      return; // Prevent collision
    }
    
    // Emit appropriate event
    const eventData = {id: this.dragState.loopId!, startTime: newStartTime, endTime: newEndTime};
    if (this.dragState.dragType === 'move') {
      this.loopMove.emit(eventData);
    } else {
      this.loopResize.emit(eventData);
    }
  }

  /**
   * Global mouse up handler to end drag operations
   */
  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(): void {
    if (this.dragState.isDragging) {
      this.dragState = {
        isDragging: false,
        dragType: null,
        loopId: null,
        startX: 0,
        initialStartTime: 0,
        initialEndTime: 0
      };
    }
  }

  /**
   * Enhanced collision detection with detailed collision information
   */
  private checkLoopCollision(excludeLoopId: string, startTime: number, endTime: number): boolean {
    return this.effectiveLoops.some(loop => 
      loop.id !== excludeLoopId &&
      !(endTime <= loop.startTime || startTime >= loop.endTime)
    );
  }

  /**
   * Get detailed collision information for better UI feedback
   */
  getLoopCollisionInfo(excludeLoopId: string, startTime: number, endTime: number): {
    hasCollision: boolean;
    collidingLoops: LoopSegment[];
    overlapDuration: number;
    recommendedPosition?: {startTime: number, endTime: number};
  } {
    const collidingLoops = this.effectiveLoops.filter(loop => 
      loop.id !== excludeLoopId &&
      !(endTime <= loop.startTime || startTime >= loop.endTime)
    );

    let overlapDuration = 0;
    if (collidingLoops.length > 0) {
      // Calculate total overlap duration
      collidingLoops.forEach(loop => {
        const overlapStart = Math.max(startTime, loop.startTime);
        const overlapEnd = Math.min(endTime, loop.endTime);
        overlapDuration += Math.max(0, overlapEnd - overlapStart);
      });
    }

    // Find recommended position if collision exists
    let recommendedPosition: {startTime: number, endTime: number} | undefined;
    if (collidingLoops.length > 0) {
      recommendedPosition = this.findNearestAvailablePosition(startTime, endTime, excludeLoopId);
    }

    return {
      hasCollision: collidingLoops.length > 0,
      collidingLoops,
      overlapDuration,
      recommendedPosition: recommendedPosition || undefined
    };
  }

  /**
   * Find the nearest available position for a loop segment
   */
  private findNearestAvailablePosition(preferredStart: number, preferredEnd: number, excludeLoopId: string): {startTime: number, endTime: number} | undefined {
    const duration = preferredEnd - preferredStart;
    const sortedLoops = this.effectiveLoops
      .filter(loop => loop.id !== excludeLoopId)
      .sort((a, b) => a.startTime - b.startTime);

    // Try placing after the last conflicting loop
    const lastConflictingLoop = sortedLoops
      .filter(loop => loop.startTime < preferredEnd)
      .pop();

    if (lastConflictingLoop) {
      const suggestedStart = lastConflictingLoop.endTime;
      const suggestedEnd = suggestedStart + duration;
      
      // Check if this position is valid and doesn't exceed video duration
      if (suggestedEnd <= this.duration && !this.checkLoopCollision(excludeLoopId, suggestedStart, suggestedEnd)) {
        return {
          startTime: suggestedStart,
          endTime: suggestedEnd
        };
      }
    }

    // Try placing before the first conflicting loop
    const firstConflictingLoop = sortedLoops
      .find(loop => loop.endTime > preferredStart);

    if (firstConflictingLoop) {
      const suggestedEnd = firstConflictingLoop.startTime;
      const suggestedStart = suggestedEnd - duration;
      
      if (suggestedStart >= 0 && !this.checkLoopCollision(excludeLoopId, suggestedStart, suggestedEnd)) {
        return {
          startTime: suggestedStart,
          endTime: suggestedEnd
        };
      }
    }

    return undefined;
  }

  /**
   * Get loop segment at specific time position
   */
  private getLoopAtTime(time: number): LoopSegment | null {
    return this.effectiveLoops.find(loop => 
      time >= loop.startTime && time <= loop.endTime
    ) || null;
  }

  /**
   * Validate segment position bounds with detailed feedback
   */
  validateSegmentBounds(startTime: number, endTime: number): {
    isValid: boolean;
    errors: string[];
    adjustedStartTime: number | undefined;
    adjustedEndTime: number | undefined;
  } {
    const errors: string[] = [];
    let adjustedStartTime = startTime;
    let adjustedEndTime = endTime;

    // Check minimum duration requirement
    const minDuration = 0.1; // 100ms minimum
    if (endTime - startTime < minDuration) {
      errors.push(`Segment duration must be at least ${minDuration} seconds`);
      adjustedEndTime = adjustedStartTime + minDuration;
    }

    // Check bounds
    if (startTime < 0) {
      errors.push('Start time cannot be negative');
      adjustedStartTime = 0;
    }

    if (endTime > this.duration) {
      errors.push('End time cannot exceed video duration');
      adjustedEndTime = this.duration;
    }

    if (startTime >= endTime) {
      errors.push('Start time must be less than end time');
      adjustedEndTime = adjustedStartTime + minDuration;
    }

    // Ensure adjusted bounds are still within video duration
    if (adjustedEndTime > this.duration) {
      adjustedEndTime = this.duration;
      adjustedStartTime = Math.max(0, adjustedEndTime - minDuration);
    }

    return {
      isValid: errors.length === 0,
      errors,
      adjustedStartTime: errors.length > 0 ? adjustedStartTime : undefined,
      adjustedEndTime: errors.length > 0 ? adjustedEndTime : undefined
    };
  }

  /**
   * Performance-optimized getter for sorted loops by start time
   */
  private _sortedLoopsCache: {loops: LoopSegment[], timestamp: number} | null = null;
  
  get sortedLoops(): LoopSegment[] {
    const currentLoops = this.effectiveLoops;
    const now = Date.now();
    
    // Use cache if loops haven't changed and cache is fresh (< 1 second)
    if (this._sortedLoopsCache && 
        this._sortedLoopsCache.loops === currentLoops && 
        now - this._sortedLoopsCache.timestamp < 1000) {
      return this._sortedLoopsCache.loops;
    }
    
    const sorted = [...currentLoops].sort((a, b) => a.startTime - b.startTime);
    this._sortedLoopsCache = {
      loops: sorted,
      timestamp: now
    };
    
    return sorted;
  }
  
  /**
   * Update focus state for accessibility and visual feedback
   */
  private updateFocusState(element: HTMLElement): void {
    this.interactionState.focusedElement = element;
    
    // Ensure keyboard accessibility by updating focus
    if (element && element.focus) {
      element.focus();
    }
  }
  
  /**
   * Navigate to specific loop segment
   */
  navigateToLoop(loopId: string): void {
    if (!this.isReady) return;
    
    const loop = this.effectiveLoops.find(l => l.id === loopId);
    if (loop) {
      // Select the loop
      this._selectedLoopId = loopId;
      this.loopSelect.emit(loopId);
      
      // Navigate to loop start
      this.seekTo.emit(loop.startTime);
      this.timelineClick.emit(loop.startTime);
    }
  }
  
  /**
   * Navigate to next loop segment
   */
  navigateToNextLoop(): void {
    if (!this.isReady || this.effectiveLoops.length === 0) return;
    
    const sortedLoops = [...this.effectiveLoops].sort((a, b) => a.startTime - b.startTime);
    
    let targetLoop: LoopSegment | null = null;
    
    if (this._selectedLoopId) {
      // Find next loop after current selection
      const currentIndex = sortedLoops.findIndex(l => l.id === this._selectedLoopId);
      if (currentIndex >= 0 && currentIndex < sortedLoops.length - 1) {
        targetLoop = sortedLoops[currentIndex + 1];
      } else {
        // Wrap to first loop
        targetLoop = sortedLoops[0];
      }
    } else {
      // Find first loop after current time
      targetLoop = sortedLoops.find(l => l.startTime > this.currentTime) || sortedLoops[0];
    }
    
    if (targetLoop) {
      this.navigateToLoop(targetLoop.id);
    }
  }
  
  /**
   * Navigate to previous loop segment
   */
  navigateToPrevLoop(): void {
    if (!this.isReady || this.effectiveLoops.length === 0) return;
    
    const sortedLoops = [...this.effectiveLoops].sort((a, b) => a.startTime - b.startTime);
    
    let targetLoop: LoopSegment | null = null;
    
    if (this._selectedLoopId) {
      // Find previous loop before current selection
      const currentIndex = sortedLoops.findIndex(l => l.id === this._selectedLoopId);
      if (currentIndex > 0) {
        targetLoop = sortedLoops[currentIndex - 1];
      } else {
        // Wrap to last loop
        targetLoop = sortedLoops[sortedLoops.length - 1];
      }
    } else {
      // Find last loop before current time
      const reversedLoops = [...sortedLoops].reverse();
      targetLoop = reversedLoops.find(l => l.endTime < this.currentTime) || sortedLoops[sortedLoops.length - 1];
    }
    
    if (targetLoop) {
      this.navigateToLoop(targetLoop.id);
    }
  }
  
  /**
   * Check if currently navigating (for UI state)
   */
  get isNavigating(): boolean {
    return this.interactionState.isNavigating;
  }
  
  /**
   * Format duration in MM:SS format
   */
  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}