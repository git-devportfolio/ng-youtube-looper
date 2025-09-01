import { Component, Input, Output, EventEmitter, HostListener, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineViewModel, LoopSegment, LoopManagerFacade } from '../../../loop-manager/data-access/loop-manager.facade';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss'
})
export class TimelineComponent implements OnInit, OnDestroy {
  private readonly loopManagerFacade = inject(LoopManagerFacade);
  private readonly destroy$ = new Subject<void>();
  // Input properties
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() disabled = false;
  @Input() isLoading = false;
  @Input() isPlaying = false; // New input for animation states
  @Input() loops: LoopSegment[] = [];
  @Input() timelineVm?: TimelineViewModel; // Optional ViewModel input
  @Input() canCreateLoop = true; // Allow loop creation by default
  @Input() useFacade = true; // Enable automatic facade integration

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
  
  // Enhanced output events for facade integration
  @Output() validationErrorChange = new EventEmitter<string>();
  @Output() animationStateChange = new EventEmitter<{state: string, loopId?: string}>();

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
    createCurrentX?: number;
    createPreviewId?: string;
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
  
  // Visual creation preview state
  private _creationPreview: {
    startTime: number;
    endTime: number;
    startX: number;
    currentX: number;
    isVisible: boolean;
  } | null = null;
  
  // Animation states for smooth transitions
  private animationStates = {
    isCreatingLoop: false,
    draggedLoopId: null as string | null,
    hoveredLoopId: null as string | null,
    lastInteractionTime: 0
  };
  
  /**
   * Get selected loop ID for template binding
   */
  get selectedLoopId(): string | null {
    return this._selectedLoopId;
  }
  
  /**
   * Get creation preview state for template binding
   */
  get creationPreview(): {
    startTime: number;
    endTime: number;
    startX: number;
    currentX: number;
    isVisible: boolean;
  } | null {
    return this._creationPreview;
  }
  
  /**
   * Check if currently in loop creation mode
   */
  get isCreatingLoop(): boolean {
    return this.dragState.isDragging && this.dragState.dragType === 'create';
  }
  
  /**
   * Get effective loops from input, ViewModel, or Facade
   */
  get effectiveLoops(): LoopSegment[] {
    if (this.useFacade) {
      return this.loopManagerFacade.timelineVm().loops;
    }
    return this.timelineVm?.loops || this.loops;
  }

  /**
   * Get effective timelineVm from input or Facade
   */
  get effectiveTimelineVm(): TimelineViewModel {
    if (this.useFacade) {
      return this.loopManagerFacade.timelineVm();
    }
    return this.timelineVm || {
      loops: this.loops,
      editingLoop: null,
      activeLoopId: null,
      selectedLoopId: this._selectedLoopId,
      canCreateLoop: this.canCreateLoop
    };
  }
  
  /**
   * Check if loop creation is enabled
   */
  get canCreateLoops(): boolean {
    if (this.useFacade) {
      return this.effectiveTimelineVm.canCreateLoop;
    }
    return this.canCreateLoop && (this.timelineVm?.canCreateLoop ?? true);
  }

  /**
   * Get the active loop ID from facade or local state
   */
  get activeLoopId(): string | null {
    if (this.useFacade) {
      return this.loopManagerFacade.activeLoop()?.id || null;
    }
    return this.effectiveTimelineVm.activeLoopId;
  }

  /**
   * Check if there are any validation errors
   */
  get hasValidationError(): boolean {
    if (this.useFacade) {
      return this.loopManagerFacade.error() !== null;
    }
    return false;
  }

  /**
   * Get current validation error message
   */
  get validationError(): string | null {
    if (this.useFacade) {
      return this.loopManagerFacade.error();
    }
    return null;
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
    
    if (this.hasValidationError) {
      classes.push('error');
    }
    
    return classes.join(' ');
  }

  ngOnInit(): void {
    // Setup facade integration if enabled
    if (this.useFacade) {
      this.setupFacadeIntegration();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup integration with LoopManagerFacade
   */
  private setupFacadeIntegration(): void {
    // Sync selected loop with facade
    effect(() => {
      const facadeSelectedId = this.loopManagerFacade.timelineVm().selectedLoopId;
      if (facadeSelectedId !== this._selectedLoopId) {
        this._selectedLoopId = facadeSelectedId || null;
      }
    });

    // Monitor facade errors for visual feedback
    effect(() => {
      const error = this.loopManagerFacade.error();
      if (error) {
        this.handleValidationError(error);
      }
    });
  }

  /**
   * Handle validation errors from facade
   */
  private handleValidationError(error: string): void {
    // Add visual feedback for validation errors
    this.animationStates.lastInteractionTime = Date.now();
    
    // Could emit an error event or show visual feedback
    console.warn('Timeline validation error:', error);
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
   * Handle mouse down on track for visual loop creation
   */
  onTrackMouseDown(event: MouseEvent): void {
    if (!this.isReady || !this.canCreateLoops) return;
    
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(mouseX / rect.width, 0), 1);
    const targetTime = percentage * this.duration;
    
    // Check if mouse down is in empty space (not on existing loop)
    const clickedLoop = this.getLoopAtTime(targetTime);
    if (clickedLoop) return; // Let existing loop handle the drag
    
    // Prevent default to avoid text selection
    event.preventDefault();
    event.stopPropagation();
    
    // Start visual loop creation
    this.startVisualLoopCreation(mouseX, targetTime);
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
    
    if (this.dragState.dragType === 'create') {
      this.updateVisualLoopCreation(event.clientX);
      return;
    }
    
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
      if (this.dragState.dragType === 'create') {
        this.finishVisualLoopCreation();
      }
      
      this.dragState = {
        isDragging: false,
        dragType: null,
        loopId: null,
        startX: 0,
        initialStartTime: 0,
        initialEndTime: 0
      };
      
      // Clear creation preview
      this._creationPreview = null;
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
    recommendedPosition: {startTime: number, endTime: number} | undefined;
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
  
  /**
   * Handle loop segment hover for enhanced visual feedback
   */
  onLoopMouseEnter(loop: LoopSegment): void {
    if (!this.isReady) return;
    
    this.animationStates.hoveredLoopId = loop.id;
    this.animationStateChange.emit({ state: 'hover', loopId: loop.id });
  }

  /**
   * Handle loop segment hover end
   */
  onLoopMouseLeave(loop: LoopSegment): void {
    if (!this.isReady) return;
    
    if (this.animationStates.hoveredLoopId === loop.id) {
      this.animationStates.hoveredLoopId = null;
      this.animationStateChange.emit({ state: 'idle' });
    }
  }

  /**
   * Get container classes with loading and error states
   */
  getContainerClasses(): string {
    const classes: string[] = ['timeline-container'];
    
    if (this.isLoading) {
      classes.push('loading');
    }
    
    if (this.disabled) {
      classes.push('disabled');
    }
    
    if (this.isReady) {
      classes.push('ready');
    }
    
    if (this.hasValidationError) {
      classes.push('validation-error');
    }
    
    if (this.useFacade && this.loopManagerFacade.isLooping()) {
      classes.push('looping');
    }
    
    if (this.animationStates.isCreatingLoop) {
      classes.push('creating-loop');
    }
    
    return classes.join(' ');
  }

  /**
   * Get progress for currently playing loop
   */
  getActiveLoopProgress(): number {
    if (!this.useFacade || !this.activeLoopId) {
      return 0;
    }
    
    const activeLoop = this.effectiveLoops.find(loop => loop.id === this.activeLoopId);
    if (!activeLoop) {
      return 0;
    }
    
    return this.loopManagerFacade.getLoopProgress(this.currentTime, activeLoop);
  }

  /**
   * Check if a loop is currently playing
   */
  isLoopPlaying(loop: LoopSegment): boolean {
    if (!this.useFacade) {
      return false;
    }
    
    return this.loopManagerFacade.isLooping() && this.activeLoopId === loop.id;
  }

  /**
   * Get staggered animation delay for loop segment
   */
  getLoopAnimationDelay(index: number): string {
    return `${index * 0.05}s`; // 50ms stagger between loops
  }

  /**
   * Handle validation and provide user feedback
   */
  private handleLoopValidation(startTime: number, endTime: number, excludeLoopId?: string): boolean {
    // Check basic bounds
    const boundsValidation = this.validateSegmentBounds(startTime, endTime);
    if (!boundsValidation.isValid) {
      this.validationErrorChange.emit(boundsValidation.errors.join(', '));
      return false;
    }
    
    // Check collisions
    if (this.checkLoopCollision(excludeLoopId || '', startTime, endTime)) {
      const collisionInfo = this.getLoopCollisionInfo(excludeLoopId || '', startTime, endTime);
      if (collisionInfo.recommendedPosition) {
        const suggestion = collisionInfo.recommendedPosition;
        this.validationErrorChange.emit(
          `Collision detected. Try position ${this.formatDuration(suggestion.startTime)} - ${this.formatDuration(suggestion.endTime)}`
        );
      } else {
        this.validationErrorChange.emit('Collision detected with existing loops');
      }
      return false;
    }
    
    return true;
  }

  /**
   * Start visual loop creation with drag
   */
  private startVisualLoopCreation(startX: number, startTime: number): void {
    if (!this.isReady || !this.canCreateLoops) return;
    
    // Initialize drag state for creation
    this.dragState = {
      isDragging: true,
      dragType: 'create',
      loopId: null,
      startX: startX,
      initialStartTime: startTime,
      initialEndTime: startTime,
      createStartTime: startTime,
      createStartX: startX,
      createCurrentX: startX
    };
    
    // Initialize creation preview
    this._creationPreview = {
      startTime: startTime,
      endTime: startTime,
      startX: startX,
      currentX: startX,
      isVisible: true
    };
    
    // Add visual feedback class to timeline
    document.body.classList.add('creating-loop');
  }
  
  /**
   * Update visual loop creation during drag
   */
  private updateVisualLoopCreation(currentX: number): void {
    if (!this._creationPreview || !this.dragState.createStartX || !this.dragState.createStartTime) return;
    
    const track = document.querySelector('.timeline-track') as HTMLElement;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const relativeCurrentX = currentX - rect.left;
    const relativeBounds = Math.min(Math.max(relativeCurrentX, 0), rect.width);
    const currentTime = (relativeBounds / rect.width) * this.duration;
    
    // Determine start and end times based on drag direction
    const startTime = Math.min(this.dragState.createStartTime, currentTime);
    const endTime = Math.max(this.dragState.createStartTime, currentTime);
    
    // Minimum loop duration (0.5 seconds)
    const minDuration = 0.5;
    const adjustedEndTime = Math.max(startTime + minDuration, endTime);
    
    // Update creation preview
    this._creationPreview = {
      startTime,
      endTime: adjustedEndTime,
      startX: Math.min(this.dragState.createStartX, relativeBounds),
      currentX: Math.max(this.dragState.createStartX, relativeBounds),
      isVisible: true
    };
    
    // Store current X for drag state
    this.dragState.createCurrentX = currentX;
    
    // Check for collisions and update visual feedback
    const hasCollision = this.checkLoopCollision('', startTime, adjustedEndTime);
    if (hasCollision) {
      document.body.classList.add('creation-collision');
    } else {
      document.body.classList.remove('creation-collision');
    }
  }
  
  /**
   * Finish visual loop creation and emit event
   */
  private finishVisualLoopCreation(): void {
    if (!this._creationPreview || !this.dragState.createStartTime) return;
    
    const startTime = this._creationPreview.startTime;
    const endTime = this._creationPreview.endTime;
    
    // Minimum duration validation
    if (endTime - startTime < 0.5) {
      this.cancelVisualLoopCreation();
      return;
    }
    
    // Check for collisions before creating
    if (!this.checkLoopCollision('', startTime, endTime)) {
      // Validate bounds
      const validation = this.validateSegmentBounds(startTime, endTime);
      if (validation.isValid) {
        this.loopCreate.emit({ startTime, endTime });
      } else if (validation.adjustedStartTime !== undefined && validation.adjustedEndTime !== undefined) {
        // Use adjusted bounds if available
        this.loopCreate.emit({ 
          startTime: validation.adjustedStartTime, 
          endTime: validation.adjustedEndTime 
        });
      }
    }
    
    this.cleanupVisualLoopCreation();
  }
  
  /**
   * Cancel visual loop creation
   */
  private cancelVisualLoopCreation(): void {
    this.cleanupVisualLoopCreation();
  }
  
  /**
   * Clean up visual loop creation state and classes
   */
  private cleanupVisualLoopCreation(): void {
    // Remove visual feedback classes
    document.body.classList.remove('creating-loop', 'creation-collision');
    
    // Clear creation preview
    this._creationPreview = null;
  }
  
  /**
   * Get creation preview position for template
   */
  getCreationPreviewPosition(): {left: number, width: number} | null {
    if (!this._creationPreview || !this.duration) return null;
    
    const left = (this._creationPreview.startTime / this.duration) * 100;
    const width = ((this._creationPreview.endTime - this._creationPreview.startTime) / this.duration) * 100;
    
    return {
      left: Math.max(0, Math.min(left, 100)),
      width: Math.max(0.1, Math.min(width, 100 - left)) // Minimum visible width
    };
  }
  
  /**
   * Check if creation preview has collision
   */
  get creationHasCollision(): boolean {
    if (!this._creationPreview) return false;
    return this.checkLoopCollision('', this._creationPreview.startTime, this._creationPreview.endTime);
  }
}