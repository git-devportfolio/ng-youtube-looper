import { Component, Input, Output, EventEmitter, HostListener, inject, OnInit, OnDestroy, effect, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineViewModel, LoopSegment, LoopManagerFacade } from '../../../loop-manager/data-access/loop-manager.facade';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-timeline',
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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
  
  // Enhanced touch interaction state for mobile gestures
  private touchStartTime: number | null = null;
  private touchState: {
    startX: number;
    startY: number;
    startTime: number;
    currentX: number;
    currentY: number;
    touchStartTimePosition: number;
    isDragging: boolean;
    dragThreshold: number;
    swipeVelocityThreshold: number;
    initialTouchCount: number;
    gestureType: 'none' | 'tap' | 'drag' | 'swipe' | 'pinch' | null;
  } = {
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    touchStartTimePosition: 0,
    isDragging: false,
    dragThreshold: 10, // pixels to start drag
    swipeVelocityThreshold: 0.5, // pixels per ms
    initialTouchCount: 0,
    gestureType: null
  };
  
  // Interaction state for enhanced selection
  private interactionState = {
    lastClickTime: 0,
    isNavigating: false,
    focusedElement: null as HTMLElement | null
  };
  
  // Legacy drag state for compatibility (will be migrated to signals gradually)
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
  
  // Signal-based state management for OnPush optimization
  private readonly _selectedLoopId = signal<string | null>(null);
  private readonly _currentTime = signal<number>(0);
  private readonly _duration = signal<number>(0);
  private readonly _isPlaying = signal<boolean>(false);
  private readonly _loops = signal<LoopSegment[]>([]);
  private readonly _dragState = signal({
    isDragging: false,
    dragType: null as 'move' | 'resize-left' | 'resize-right' | 'create' | null,
    loopId: null as string | null,
    startX: 0,
    initialStartTime: 0,
    initialEndTime: 0
  });
  
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
    return this._selectedLoopId();
  }

  /**
   * Computed signals for optimized calculations
   */
  private readonly currentTimePercentageSignal = computed(() => {
    const duration = this._duration();
    const currentTime = this._currentTime();
    if (duration === 0) return 0;
    return Math.min((currentTime / duration) * 100, 100);
  });

  private readonly effectiveLoopsSignal = computed(() => {
    if (this.useFacade) {
      return this.loopManagerFacade.timelineVm().loops;
    }
    return this.timelineVm?.loops || this._loops();
  });

  private readonly sortedLoopsSignal = computed(() => {
    return [...this.effectiveLoopsSignal()].sort((a, b) => a.startTime - b.startTime);
  });
  
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
   * Get effective loops from input, ViewModel, or Facade (optimized with signals)
   */
  get effectiveLoops(): LoopSegment[] {
    return this.effectiveLoopsSignal();
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
   * Calculate the current time position as percentage (optimized with computed signal)
   */
  get currentTimePercentage(): number {
    return this.currentTimePercentageSignal();
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
    
    // Initialize signal-based state synchronization
    this.initializeSignalSync();
  }

  /**
   * Initialize signal synchronization with inputs for OnPush optimization
   */
  private initializeSignalSync(): void {
    // Sync input properties with signals for better change detection
    effect(() => {
      this._currentTime.set(this.currentTime);
      this._duration.set(this.duration);
      this._isPlaying.set(this.isPlaying);
      this._loops.set(this.loops);
    });
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
      if (facadeSelectedId !== this._selectedLoopId()) {
        this._selectedLoopId.set(facadeSelectedId || null);
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
   * Enhanced touch start handler with precise gesture detection and drag support
   */
  onTouchStart(event: TouchEvent): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    
    const touch = event.touches[0];
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    const percentage = Math.min(Math.max(touchX / rect.width, 0), 1);
    const touchTime = this.applyMagneticGuides(percentage * this.duration);
    
    // Initialize enhanced touch state
    this.touchStartTime = Date.now();
    this.touchState = {
      startX: touchX,
      startY: touchY,
      startTime: this.touchStartTime,
      currentX: touchX,
      currentY: touchY,
      touchStartTimePosition: touchTime,
      isDragging: false,
      dragThreshold: this.getMobileDragThreshold(),
      swipeVelocityThreshold: 0.5,
      initialTouchCount: event.touches.length,
      gestureType: 'none'
    };
    
    this.interactionState.isNavigating = true;
    this.startSeeking();
    
    // Pre-identify touched loop for enhanced interaction
    const touchedLoop = this.getLoopAtTime(touchTime);
    if (touchedLoop && event.touches.length === 1) {
      // Check if touch is on a draggable area (loop segment)
      this.initializeTouchDrag(touchedLoop, touchX, touchTime);
      this.interactionState.focusedElement = event.target as HTMLElement;
    }
    
    // Handle multi-touch gestures
    if (event.touches.length > 1) {
      this.handleMultiTouchStart(event);
    }
  }

  /**
   * Enhanced touch end handler with gesture recognition and precise interactions
   */
  onTouchEnd(event: TouchEvent): void {
    if (!this.isReady || this.touchStartTime === null) return;
    
    event.preventDefault();
    
    const touchDuration = Date.now() - this.touchStartTime;
    const touch = event.changedTouches[0];
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // Update current touch position
    this.touchState.currentX = touchX;
    this.touchState.currentY = touchY;
    
    // Calculate touch movement and velocity
    const deltaX = Math.abs(touchX - this.touchState.startX);
    const deltaY = Math.abs(touchY - this.touchState.startY);
    const velocity = deltaX / touchDuration;
    
    // Determine gesture type
    this.determineGestureType(deltaX, deltaY, velocity, touchDuration);
    
    // Handle different gesture types
    switch (this.touchState.gestureType) {
      case 'tap':
        this.handleTouchTap(touchX, touchY);
        break;
      case 'drag':
        this.handleTouchDragEnd();
        break;
      case 'swipe':
        this.handleTouchSwipe(deltaX, touchX > this.touchState.startX);
        break;
      case 'pinch':
        this.handleMultiTouchEnd(event);
        break;
      default:
        // Fallback to basic navigation
        this.handleTouchNavigation(touchX);
    }
    
    // Cleanup touch state
    this.cleanupTouchState();
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
      // If clicking within a loop, select it first (batch optimized)
      if (this._selectedLoopId() !== clickedLoop.id) {
        this.updateSelectedLoopBatch(clickedLoop.id);
        
        // Focus management for accessibility
        this.updateFocusState(event.target as HTMLElement);
      }
    } else if (!clickedLoop) {
      // If clicking outside loops, deselect any selected loop (batch optimized)
      if (this._selectedLoopId() !== null) {
        this.updateSelectedLoopBatch(null);
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
   * Handle keyboard shortcuts for timeline navigation and loop management
   */
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isReady) return;
    
    const selectedId = this._selectedLoopId();
    const loops = this.effectiveLoops;
    
    switch (event.key) {
      case 'ArrowLeft':
        if (event.shiftKey && selectedId) {
          // Resize selected loop start (move left edge)
          event.preventDefault();
          this.resizeSelectedLoop('left', -1);
        } else if (event.ctrlKey || event.metaKey) {
          // Seek backward
          event.preventDefault();
          const newTime = Math.max(0, this.currentTime - 10);
          this.seekTo.emit(newTime);
        } else if (loops.length > 0) {
          // Navigate to previous loop
          event.preventDefault();
          this.navigateToPrevLoop();
        }
        break;
        
      case 'ArrowRight':
        if (event.shiftKey && selectedId) {
          // Resize selected loop end (move right edge)
          event.preventDefault();
          this.resizeSelectedLoop('right', 1);
        } else if (event.ctrlKey || event.metaKey) {
          // Seek forward
          event.preventDefault();
          const newTime = Math.min(this.duration, this.currentTime + 10);
          this.seekTo.emit(newTime);
        } else if (loops.length > 0) {
          // Navigate to next loop
          event.preventDefault();
          this.navigateToNextLoop();
        }
        break;
        
      case 'ArrowUp':
        if (selectedId) {
          // Move selected loop up in timeline (earlier)
          event.preventDefault();
          this.moveSelectedLoop(-5); // Move 5 seconds earlier
        }
        break;
        
      case 'ArrowDown':
        if (selectedId) {
          // Move selected loop down in timeline (later)
          event.preventDefault();
          this.moveSelectedLoop(5); // Move 5 seconds later
        }
        break;
        
      case 'Enter':
      case ' ':
        if (selectedId) {
          // Play selected loop
          event.preventDefault();
          const selectedLoop = loops.find(l => l.id === selectedId);
          if (selectedLoop && this.useFacade) {
            this.seekTo.emit(selectedLoop.startTime);
          }
        } else {
          // Toggle play/pause at current position
          event.preventDefault();
          // This would need to be handled by parent component
        }
        break;
        
      case 'Delete':
      case 'Backspace':
        if (selectedId) {
          event.preventDefault();
          this.loopDelete.emit(selectedId);
          this.updateSelectedLoopBatch(null);
        }
        break;
        
      case 'l':
      case 'L':
        if ((event.ctrlKey || event.metaKey) && this.canCreateLoops) {
          // Ctrl+L or Cmd+L to create loop at current time
          event.preventDefault();
          const loopDuration = 5; // 5 seconds
          const startTime = Math.max(0, this.currentTime - loopDuration / 2);
          const endTime = Math.min(this.duration, startTime + loopDuration);
          
          if (!this.checkLoopCollision('', startTime, endTime)) {
            this.loopCreate.emit({ startTime, endTime });
          }
        }
        break;
        
      case 'c':
      case 'C':
        if ((event.ctrlKey || event.metaKey) && selectedId) {
          // Copy/duplicate selected loop
          event.preventDefault();
          const selectedLoop = loops.find(l => l.id === selectedId);
          if (selectedLoop) {
            const duration = selectedLoop.endTime - selectedLoop.startTime;
            const newStartTime = Math.min(this.duration - duration, selectedLoop.endTime + 1);
            const newEndTime = newStartTime + duration;
            
            if (!this.checkLoopCollision('', newStartTime, newEndTime)) {
              this.loopCreate.emit({ startTime: newStartTime, endTime: newEndTime });
            }
          }
        }
        break;
        
      case 'Escape':
        // Deselect current loop and cancel any creation mode
        event.preventDefault();
        if (selectedId) {
          this.updateSelectedLoopBatch(null);
          this.loopDeselect.emit();
        }
        if (this.isCreatingLoop) {
          this.cancelVisualLoopCreation();
        }
        break;
        
      case 'Home':
        // Go to beginning of timeline
        event.preventDefault();
        this.seekTo.emit(0);
        break;
        
      case 'End':
        // Go to end of timeline
        event.preventDefault();
        this.seekTo.emit(this.duration);
        break;
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
    
    if (this._selectedLoopId() === loop.id) {
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
    
    this.updateSelectedLoopBatch(loop.id);
  }

  /**
   * Handle loop segment selection
   */
  onLoopClick(event: MouseEvent, loop: LoopSegment): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (this._selectedLoopId() === loop.id) {
      this.updateSelectedLoopBatch(null);
    } else {
      this.updateSelectedLoopBatch(loop.id);
    }
  }

  /**
   * Global mouse move handler for drag operations with temporal precision
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
    const rawDeltaTime = (deltaX / rect.width) * this.duration;
    // Apply temporal precision to delta time
    const deltaTime = this.roundToPrecision(rawDeltaTime, this.PRECISION_DECIMALS);
    
    const loop = this.effectiveLoops.find(l => l.id === this.dragState.loopId);
    if (!loop) return;
    
    let newStartTime = this.dragState.initialStartTime;
    let newEndTime = this.dragState.initialEndTime;
    
    switch (this.dragState.dragType) {
      case 'move':
        const rawNewStartTime = Math.max(0, Math.min(this.dragState.initialStartTime + deltaTime, this.duration - (this.dragState.initialEndTime - this.dragState.initialStartTime)));
        newStartTime = this.roundToPrecision(rawNewStartTime, this.PRECISION_DECIMALS);
        newEndTime = this.roundToPrecision(newStartTime + (this.dragState.initialEndTime - this.dragState.initialStartTime), this.PRECISION_DECIMALS);
        break;
        
      case 'resize-left':
        const rawNewStartTime2 = Math.max(0, Math.min(this.dragState.initialStartTime + deltaTime, this.dragState.initialEndTime - 1));
        newStartTime = this.roundToPrecision(rawNewStartTime2, this.PRECISION_DECIMALS);
        break;
        
      case 'resize-right':
        const rawNewEndTime = Math.max(this.dragState.initialStartTime + 1, Math.min(this.dragState.initialEndTime + deltaTime, this.duration));
        newEndTime = this.roundToPrecision(rawNewEndTime, this.PRECISION_DECIMALS);
        break;
    }
    
    // Apply magnetic guide snapping (mobile-adapted if touch device)
    const isTouchDrag = this.touchState.isDragging;
    if (isTouchDrag) {
      newStartTime = this.applyMobileMagneticGuides(newStartTime);
      if (this.dragState.dragType !== 'resize-left') {
        newEndTime = this.applyMobileMagneticGuides(newEndTime);
      }
    } else {
      newStartTime = this.applyMagneticGuides(newStartTime);
      if (this.dragState.dragType !== 'resize-left') {
        newEndTime = this.applyMagneticGuides(newEndTime);
      }
    }
    
    // Update drag feedback for visual indicators
    this.updateDragFeedback(newStartTime, newEndTime);
    
    // Check for collisions with other loops
    if (this.checkLoopCollision(this.dragState.loopId!, newStartTime, newEndTime)) {
      this.markDragCollision(true);
      // Trigger haptic feedback for collision on touch devices
      if (this.touchState.isDragging) {
        this.triggerHapticFeedback('collision');
      }
      return; // Prevent collision
    } else {
      this.markDragCollision(false);
    }
    
    // Emit appropriate event with precise time values
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
      
      // Clear drag feedback and visual states
      this.clearDragFeedback();
      
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
   * Enhanced collision detection with optimized real-time checking
   */
  private checkLoopCollision(excludeLoopId: string, startTime: number, endTime: number): boolean {
    // Early return if no loops to check
    if (this.effectiveLoops.length === 0) return false;
    
    // Use cached sorted loops for better performance
    const loopsToCheck = this.sortedLoops.filter(loop => loop.id !== excludeLoopId);
    
    // Optimized collision detection using sorted order
    for (const loop of loopsToCheck) {
      // Early exit if loop starts after our end time (sorted order optimization)
      if (loop.startTime >= endTime) break;
      
      // Check for overlap
      if (!(endTime <= loop.startTime || startTime >= loop.endTime)) {
        return true; // Collision found
      }
    }
    
    return false; // No collision
  }

  /**
   * Get optimized collision information with better performance and UI feedback
   */
  getLoopCollisionInfo(excludeLoopId: string, startTime: number, endTime: number): {
    hasCollision: boolean;
    collidingLoops: LoopSegment[];
    overlapDuration: number;
    recommendedPosition: {startTime: number, endTime: number} | undefined;
    collisionSeverity: 'none' | 'minor' | 'major';
  } {
    // Use optimized collision detection with sorted loops
    const loopsToCheck = this.sortedLoops.filter(loop => loop.id !== excludeLoopId);
    const collidingLoops: LoopSegment[] = [];
    let totalOverlapDuration = 0;

    // Find all colliding loops and calculate overlap in one pass
    for (const loop of loopsToCheck) {
      // Early exit optimization using sorted order
      if (loop.startTime >= endTime) break;
      
      // Check for overlap
      if (!(endTime <= loop.startTime || startTime >= loop.endTime)) {
        collidingLoops.push(loop);
        
        // Calculate overlap duration for this loop
        const overlapStart = Math.max(startTime, loop.startTime);
        const overlapEnd = Math.min(endTime, loop.endTime);
        totalOverlapDuration += Math.max(0, overlapEnd - overlapStart);
      }
    }

    // Determine collision severity for better UI feedback
    const segmentDuration = endTime - startTime;
    const overlapRatio = segmentDuration > 0 ? totalOverlapDuration / segmentDuration : 0;
    let collisionSeverity: 'none' | 'minor' | 'major' = 'none';
    
    if (overlapRatio > 0) {
      collisionSeverity = overlapRatio > 0.5 ? 'major' : 'minor';
    }

    // Find recommended position if collision exists
    let recommendedPosition: {startTime: number, endTime: number} | undefined;
    if (collidingLoops.length > 0) {
      recommendedPosition = this.findNearestAvailablePosition(startTime, endTime, excludeLoopId);
    }

    return {
      hasCollision: collidingLoops.length > 0,
      collidingLoops,
      overlapDuration: totalOverlapDuration,
      recommendedPosition,
      collisionSeverity
    };
  }

  /**
   * Find the nearest available position for a loop segment with magnetic guide alignment
   */
  private findNearestAvailablePosition(preferredStart: number, preferredEnd: number, excludeLoopId: string): {startTime: number, endTime: number} | undefined {
    const duration = preferredEnd - preferredStart;
    const loopsToCheck = this.sortedLoops.filter(loop => loop.id !== excludeLoopId);

    // Try placing after the last conflicting loop with magnetic guide snapping
    const lastConflictingLoop = loopsToCheck
      .filter(loop => loop.startTime < preferredEnd)
      .pop();

    if (lastConflictingLoop) {
      let suggestedStart = lastConflictingLoop.endTime;
      // Apply magnetic guide snapping to suggested position
      suggestedStart = this.applyMagneticGuides(suggestedStart);
      const suggestedEnd = this.roundToPrecision(suggestedStart + duration, this.PRECISION_DECIMALS);
      
      // Check if this position is valid and doesn't exceed video duration
      if (suggestedEnd <= this.duration && !this.checkLoopCollision(excludeLoopId, suggestedStart, suggestedEnd)) {
        return {
          startTime: suggestedStart,
          endTime: suggestedEnd
        };
      }
    }

    // Try placing before the first conflicting loop with magnetic guide snapping
    const firstConflictingLoop = loopsToCheck
      .find(loop => loop.endTime > preferredStart);

    if (firstConflictingLoop) {
      let suggestedEnd = firstConflictingLoop.startTime;
      // Apply magnetic guide snapping to suggested position
      suggestedEnd = this.applyMagneticGuides(suggestedEnd);
      const suggestedStart = this.roundToPrecision(suggestedEnd - duration, this.PRECISION_DECIMALS);
      
      if (suggestedStart >= 0 && !this.checkLoopCollision(excludeLoopId, suggestedStart, suggestedEnd)) {
        return {
          startTime: suggestedStart,
          endTime: suggestedEnd
        };
      }
    }

    // Try finding gaps between existing loops with magnetic guide alignment
    for (let i = 0; i < loopsToCheck.length - 1; i++) {
      const currentLoop = loopsToCheck[i];
      const nextLoop = loopsToCheck[i + 1];
      const gapStart = currentLoop.endTime;
      const gapEnd = nextLoop.startTime;
      const gapDuration = gapEnd - gapStart;
      
      // Check if the segment fits in this gap
      if (gapDuration >= duration) {
        const suggestedStart = this.applyMagneticGuides(gapStart);
        const suggestedEnd = this.roundToPrecision(suggestedStart + duration, this.PRECISION_DECIMALS);
        
        // Ensure it fits within the gap boundaries
        if (suggestedEnd <= gapEnd && !this.checkLoopCollision(excludeLoopId, suggestedStart, suggestedEnd)) {
          return {
            startTime: suggestedStart,
            endTime: suggestedEnd
          };
        }
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

  // Enhanced precision and caching system for timeline calculations
  private readonly PRECISION_DECIMALS = 0.1; // 0.1 second precision
  private readonly MAGNETIC_GUIDE_INTERVAL = 0.5; // Magnetic guides every 0.5 seconds
  private readonly POSITION_CACHE_SIZE = 1000;
  private readonly POSITION_CACHE_TTL = 5000; // 5 seconds cache TTL
  
  // Visual feedback state for drag operations (signal-based)
  private readonly _dragFeedback = signal<{
    currentTime: number;
    magneticGuideTime: number | null;
    isNearGuide: boolean;
    visualElement?: HTMLElement;
  } | null>(null);
  
  // Optimized memoization cache for expensive calculations
  private readonly _memoCache = new Map<string, {result: any, timestamp: number, inputs: string}>();
  private readonly MEMO_CACHE_TTL = 3000; // 3 seconds for memoization
  
  // Position calculation cache for performance optimization
  private _positionCache = new Map<string, {position: number, timestamp: number}>();
  private _timeCache = new Map<string, {time: number, timestamp: number}>();
  
  /**
   * Get sorted loops (optimized with computed signal)
   */
  get sortedLoops(): LoopSegment[] {
    return this.sortedLoopsSignal();
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
      // Select the loop (batch optimized)
      this.updateSelectedLoopBatch(loopId);
      
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
    
    // Clear drag feedback and visual states
    this.clearDragFeedback();
    
    // Clear creation preview
    this._creationPreview = null;
  }

  /**
   * Get all magnetic guide times within the timeline duration
   */
  getMagneticGuideTimes(): number[] {
    const guides: number[] = [];
    const numGuides = Math.floor(this.duration / this.MAGNETIC_GUIDE_INTERVAL) + 1;
    
    for (let i = 0; i < numGuides; i++) {
      const guideTime = i * this.MAGNETIC_GUIDE_INTERVAL;
      if (guideTime <= this.duration) {
        guides.push(this.roundToPrecision(guideTime, this.PRECISION_DECIMALS));
      }
    }
    
    return guides;
  }

  /**
   * Get magnetic guide positions as percentages for visual rendering
   */
  getMagneticGuidePositions(): number[] {
    if (this.duration === 0) return [];
    
    const guideTimes = this.getMagneticGuideTimes();
    return this.getBatchPositionsWithPrecision(guideTimes);
  }

  /**
   * Check if magnetic guides should be visible based on zoom/duration
   */
  get shouldShowMagneticGuides(): boolean {
    // Show guides when duration is reasonable and not too crowded
    return this.duration > 0 && this.duration <= 300; // 5 minutes max for visibility
  }

  /**
   * Get currently active magnetic guide (nearest to drag position)
   */
  get activeMagneticGuide(): number | null {
    if (!this._dragFeedback || !this._dragFeedback.isNearGuide) {
      return null;
    }
    return this._dragFeedback.magneticGuideTime;
  }

  /**
   * Get mobile-optimized drag threshold based on device capabilities
   */
  private getMobileDragThreshold(): number {
    // Larger threshold for touch devices to prevent accidental drags
    if ('ontouchstart' in window) {
      return 15; // pixels
    }
    return 10; // smaller threshold for mouse/pen devices
  }

  /**
   * Initialize touch drag operation for loop segments
   */
  private initializeTouchDrag(loop: LoopSegment, touchX: number, touchTime: number): void {
    // Check if touching near loop boundaries for resize operations
    const loopPosition = this.getLoopPosition(loop);
    const track = document.querySelector('.timeline-track') as HTMLElement;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const loopStartX = (loopPosition.left / 100) * rect.width;
    const loopEndX = ((loopPosition.left + loopPosition.width) / 100) * rect.width;
    
    // Mobile-friendly resize zones (larger touch targets)
    const resizeZoneWidth = Math.max(20, rect.width * 0.05); // 5% of track width, min 20px
    
    let dragType: 'move' | 'resize-left' | 'resize-right' = 'move';
    
    if (touchX <= loopStartX + resizeZoneWidth) {
      dragType = 'resize-left';
    } else if (touchX >= loopEndX - resizeZoneWidth) {
      dragType = 'resize-right';
    }
    
    // Pre-configure drag state for potential drag operation
    this.touchState.gestureType = 'drag';
    this.touchState.isDragging = false; // Will be set to true if movement exceeds threshold
  }

  /**
   * Determine gesture type based on touch movement and timing
   */
  private determineGestureType(deltaX: number, deltaY: number, velocity: number, duration: number): void {
    // Multi-touch gestures
    if (this.touchState.initialTouchCount > 1) {
      this.touchState.gestureType = 'pinch';
      return;
    }
    
    // Quick tap detection (< 200ms and minimal movement)
    if (duration < 200 && deltaX < this.touchState.dragThreshold && deltaY < this.touchState.dragThreshold) {
      this.touchState.gestureType = 'tap';
      return;
    }
    
    // Swipe gesture (fast horizontal movement)
    if (velocity > this.touchState.swipeVelocityThreshold && deltaX > deltaY * 2 && deltaX > 30) {
      this.touchState.gestureType = 'swipe';
      return;
    }
    
    // Drag gesture (slower movement with sufficient delta)
    if (deltaX > this.touchState.dragThreshold || deltaY > this.touchState.dragThreshold) {
      this.touchState.gestureType = 'drag';
      return;
    }
    
    // Default to tap for unclear gestures
    this.touchState.gestureType = 'tap';
  }

  /**
   * Handle touch tap gesture
   */
  private handleTouchTap(touchX: number, touchY: number): void {
    const percentage = Math.min(Math.max(touchX / document.querySelector('.timeline-track')!.getBoundingClientRect().width, 0), 1);
    const targetTime = this.applyMagneticGuides(percentage * this.duration);
    
    // Check for loop segment at touch position
    const touchedLoop = this.getLoopAtTime(targetTime);
    
    if (touchedLoop) {
      // Select/deselect loop
      if (this._selectedLoopId !== touchedLoop.id) {
        this._selectedLoopId = touchedLoop.id;
        this.loopSelect.emit(touchedLoop.id);
        this.triggerHapticFeedback('selection');
      } else {
        this._selectedLoopId = null;
        this.loopDeselect.emit();
      }
    } else {
      // Navigate to position
      this.seekTo.emit(targetTime);
      this.timelineClick.emit(targetTime);
      
      // Deselect any selected loop
      if (this._selectedLoopId !== null) {
        this._selectedLoopId = null;
        this.loopDeselect.emit();
      }
    }
  }

  /**
   * Handle touch drag end with precision
   */
  private handleTouchDragEnd(): void {
    if (this.touchState.isDragging && this.dragState.isDragging) {
      // Touch drag was active, let the existing mouse up handler complete it
      this.onDocumentMouseUp();
      this.triggerHapticFeedback('drag-end');
    }
  }

  /**
   * Handle touch swipe gesture for timeline navigation
   */
  private handleTouchSwipe(deltaX: number, isRightSwipe: boolean): void {
    if (isRightSwipe) {
      // Swipe right - navigate to next loop
      this.navigateToNextLoop();
    } else {
      // Swipe left - navigate to previous loop
      this.navigateToPrevLoop();
    }
    
    this.triggerHapticFeedback('navigation');
  }

  /**
   * Handle basic touch navigation (fallback)
   */
  private handleTouchNavigation(touchX: number): void {
    const track = document.querySelector('.timeline-track') as HTMLElement;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const percentage = Math.min(Math.max(touchX / rect.width, 0), 1);
    const targetTime = this.applyMagneticGuides(percentage * this.duration);
    
    this.seekTo.emit(targetTime);
    this.timelineClick.emit(targetTime);
  }

  /**
   * Cleanup touch state after gesture completion
   */
  private cleanupTouchState(): void {
    this.touchStartTime = null;
    this.touchState.gestureType = null;
    this.touchState.isDragging = false;
    this.interactionState.isNavigating = false;
    this.interactionState.focusedElement = null;
    
    // End seeking state after a short delay
    setTimeout(() => this.endSeeking(), 200);
  }

  /**
   * Enhanced touch move handler for precise drag operations
   */
  @HostListener('document:touchmove', ['$event'])
  onDocumentTouchMove(event: TouchEvent): void {
    if (!this.isReady || this.touchStartTime === null || event.touches.length === 0) return;
    
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - this.touchState.startX);
    const deltaY = Math.abs(touch.clientY - this.touchState.startY);
    
    // Update current position
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
    
    // Check if movement exceeds drag threshold
    if (!this.touchState.isDragging && deltaX > this.touchState.dragThreshold) {
      this.touchState.isDragging = true;
      this.touchState.gestureType = 'drag';
      
      // Start drag operation if touching a loop
      const track = document.querySelector('.timeline-track') as HTMLElement;
      if (track) {
        const rect = track.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const percentage = Math.min(Math.max(touchX / rect.width, 0), 1);
        const touchTime = this.applyMagneticGuides(percentage * this.duration);
        const touchedLoop = this.getLoopAtTime(touchTime);
        
        if (touchedLoop) {
          // Initialize mouse-style drag for touch
          this.startTouchLoopDrag(touch, touchedLoop, touchTime);
          this.triggerHapticFeedback('drag-start');
        }
      }
    }
    
    // Handle ongoing drag operations
    if (this.touchState.isDragging && this.dragState.isDragging) {
      // Convert touch move to mouse move for existing drag system
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      });
      this.onDocumentMouseMove(mouseEvent);
    }
    
    // Handle multi-touch gestures
    if (event.touches.length > 1) {
      this.handleMultiTouchMove(event);
    }
  }

  /**
   * Start touch-based loop drag operation
   */
  private startTouchLoopDrag(touch: Touch, loop: LoopSegment, touchTime: number): void {
    const track = document.querySelector('.timeline-track') as HTMLElement;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const loopPosition = this.getLoopPosition(loop);
    const loopStartX = (loopPosition.left / 100) * rect.width;
    const loopEndX = ((loopPosition.left + loopPosition.width) / 100) * rect.width;
    
    // Determine drag type based on touch position with mobile-friendly zones
    const resizeZoneWidth = Math.max(20, rect.width * 0.05);
    let dragType: 'move' | 'resize-left' | 'resize-right' = 'move';
    
    if (touchX <= loopStartX + resizeZoneWidth) {
      dragType = 'resize-left';
    } else if (touchX >= loopEndX - resizeZoneWidth) {
      dragType = 'resize-right';
    }
    
    // Initialize drag state
    this.dragState = {
      isDragging: true,
      dragType,
      loopId: loop.id,
      startX: touch.clientX,
      initialStartTime: loop.startTime,
      initialEndTime: loop.endTime
    };
    
    // Select the loop (batch optimized)
    this.updateSelectedLoopBatch(loop.id);
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

  // === ENHANCED PRECISION METHODS FOR TASK 6.1 ===

  /**
   * Round time to specified precision (default: 0.1 second)
   * Key method for task 6.1 - ensures consistent temporal precision
   */
  private roundToPrecision(value: number, precision: number): number {
    const factor = 1 / precision;
    return Math.round(value * factor) / factor;
  }

  /**
   * Apply magnetic guide snapping to time values
   * Snaps to nearest 0.5-second mark if within threshold
   */
  private applyMagneticGuides(time: number, threshold: number = 0.15): number {
    const guideFactor = 1 / this.MAGNETIC_GUIDE_INTERVAL;
    const nearestGuide = Math.round(time * guideFactor) / guideFactor;
    const distance = Math.abs(time - nearestGuide);
    
    // If within threshold distance of a magnetic guide, snap to it
    if (distance <= threshold) {
      return this.roundToPrecision(nearestGuide, this.PRECISION_DECIMALS);
    }
    
    // Otherwise, just apply precision rounding
    return this.roundToPrecision(time, this.PRECISION_DECIMALS);
  }

  /**
   * Check if a time value is near a magnetic guide
   */
  private isNearMagneticGuide(time: number, threshold: number = 0.15): boolean {
    const guideFactor = 1 / this.MAGNETIC_GUIDE_INTERVAL;
    const nearestGuide = Math.round(time * guideFactor) / guideFactor;
    return Math.abs(time - nearestGuide) <= threshold;
  }

  /**
   * Get the nearest magnetic guide time for a given time
   */
  private getNearestMagneticGuide(time: number): number {
    const guideFactor = 1 / this.MAGNETIC_GUIDE_INTERVAL;
    const nearestGuide = Math.round(time * guideFactor) / guideFactor;
    return this.roundToPrecision(nearestGuide, this.PRECISION_DECIMALS);
  }

  /**
   * Update drag feedback state for real-time visual indicators
   */
  private updateDragFeedback(startTime: number, endTime: number): void {
    const currentTime = this.dragState.dragType === 'resize-right' ? endTime : startTime;
    const isNearGuide = this.isNearMagneticGuide(currentTime);
    const magneticGuideTime = isNearGuide ? this.getNearestMagneticGuide(currentTime) : null;
    
    this._dragFeedback = {
      currentTime,
      magneticGuideTime,
      isNearGuide
    };
    
    // Add CSS classes for visual feedback
    document.body.classList.toggle('dragging-near-guide', isNearGuide);
    document.body.classList.add('timeline-dragging');
  }

  /**
   * Clear drag feedback state
   */
  private clearDragFeedback(): void {
    this._dragFeedback = null;
    document.body.classList.remove('dragging-near-guide', 'timeline-dragging', 'drag-collision');
  }

  /**
   * Mark visual collision state during drag
   */
  private markDragCollision(hasCollision: boolean): void {
    document.body.classList.toggle('drag-collision', hasCollision);
  }

  /**
   * Get current drag feedback for template binding
   */
  get dragFeedback(): {
    currentTime: number;
    magneticGuideTime: number | null;
    isNearGuide: boolean;
    visualElement?: HTMLElement;
  } | null {
    return this._dragFeedback;
  }

  /**
   * Check if currently showing drag feedback (signal-based)
   */
  get isDraggingWithFeedback(): boolean {
    return this._dragFeedback() !== null && this.dragState.isDragging;
  }

  /**
   * TrackBy function for loop segments to optimize *ngFor performance
   */
  trackLoopById(index: number, loop: LoopSegment): string {
    return loop.id;
  }

  /**
   * TrackBy function for magnetic guides
   */
  trackGuideByPosition(index: number, position: number): number {
    return position;
  }

  /**
   * TrackBy function for time markers
   */
  trackMarkerByPosition(index: number, marker: {position: number, label: string, shortLabel: string}): number {
    return marker.position;
  }

  /**
   * Generic memoization helper for expensive calculations
   */
  private memoize<T>(key: string, fn: () => T, dependencies: any[]): T {
    const now = Date.now();
    const depString = dependencies.join('|');
    const cached = this._memoCache.get(key);
    
    // Check if cached result is valid and fresh
    if (cached && 
        cached.inputs === depString && 
        (now - cached.timestamp) < this.MEMO_CACHE_TTL) {
      return cached.result;
    }
    
    // Calculate new result
    const result = fn();
    
    // Cache management - clean up if cache is getting large
    if (this._memoCache.size >= 500) {
      this.cleanupMemoCache();
    }
    
    // Store result
    this._memoCache.set(key, {
      result,
      timestamp: now,
      inputs: depString
    });
    
    return result;
  }

  /**
   * Clean up expired memoization cache entries
   */
  private cleanupMemoCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, value] of this._memoCache.entries()) {
      if (now - value.timestamp > this.MEMO_CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this._memoCache.delete(key));
    
    // If still too large, remove oldest entries
    if (this._memoCache.size >= 500) {
      const sortedEntries = Array.from(this._memoCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, Math.floor(500 / 2));
      toRemove.forEach(([key]) => this._memoCache.delete(key));
    }
  }

  /**
   * Optimized method to get collision info during real-time drag operations
   */
  getRealTimeCollisionFeedback(excludeLoopId: string, startTime: number, endTime: number): {
    hasCollision: boolean;
    severity: 'none' | 'minor' | 'major';
    nearestSafePosition?: {startTime: number, endTime: number};
  } {
    // Lightweight collision check for real-time feedback
    const hasCollision = this.checkLoopCollision(excludeLoopId, startTime, endTime);
    
    if (!hasCollision) {
      return { hasCollision: false, severity: 'none' };
    }
    
    // Only calculate detailed info if there's a collision
    const collisionInfo = this.getLoopCollisionInfo(excludeLoopId, startTime, endTime);
    
    return {
      hasCollision: true,
      severity: collisionInfo.collisionSeverity,
      nearestSafePosition: collisionInfo.recommendedPosition
    };
  }

  /**
   * Handle multi-touch start for zoom/pan gestures
   */
  private handleMultiTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      // Two-finger gesture for zoom/pan
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Store initial pinch distance and center point
      const initialDistance = this.getTouchDistance(touch1, touch2);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      
      this.touchState.gestureType = 'pinch';
      // Could store additional pinch state here for zoom implementation
    }
  }

  /**
   * Handle multi-touch move for zoom/pan operations
   */
  private handleMultiTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2 && this.touchState.gestureType === 'pinch') {
      event.preventDefault();
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      // Calculate current pinch distance and scale
      const currentDistance = this.getTouchDistance(touch1, touch2);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      
      // Zoom/pan could be implemented here
      // For now, just prevent default scrolling behavior
    }
  }

  /**
   * Calculate distance between two touch points
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const deltaX = touch1.clientX - touch2.clientX;
    const deltaY = touch1.clientY - touch2.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  /**
   * Trigger haptic feedback for supported devices
   */
  private triggerHapticFeedback(type: 'selection' | 'navigation' | 'drag-start' | 'drag-end' | 'collision'): void {
    if ('vibrate' in navigator) {
      let pattern: number | number[];
      
      switch (type) {
        case 'selection':
          pattern = 50; // Short pulse for selection
          break;
        case 'navigation':
          pattern = [30, 20, 30]; // Double pulse for navigation
          break;
        case 'drag-start':
          pattern = 100; // Longer pulse for drag start
          break;
        case 'drag-end':
          pattern = [50, 30, 50]; // Success pattern
          break;
        case 'collision':
          pattern = [100, 50, 100, 50, 100]; // Warning pattern
          break;
        default:
          pattern = 50;
      }
      
      navigator.vibrate(pattern);
    }
  }

  /**
   * Handle multi-touch end gestures
   */
  private handleMultiTouchEnd(event: TouchEvent): void {
    // End multi-touch gesture
    if (event.touches.length === 0) {
      // All fingers lifted - complete gesture
      this.touchState.gestureType = null;
      this.triggerHapticFeedback('navigation');
    }
  }

  /**
   * Get mobile-adapted precision threshold for touch interactions
   */
  private getMobilePrecisionThreshold(): number {
    // Larger precision threshold for mobile devices due to finger size
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      return 0.2; // 200ms precision for mobile
    }
    return this.PRECISION_DECIMALS; // Standard 100ms precision
  }

  /**
   * Get mobile-adapted magnetic guide threshold
   */
  private getMobileMagneticThreshold(): number {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      return 0.25; // Larger snap zone for mobile (250ms)
    }
    return 0.15; // Standard snap zone (150ms)
  }

  /**
   * Apply mobile-adapted magnetic guides with larger snap zones
   */
  private applyMobileMagneticGuides(time: number): number {
    const threshold = this.getMobileMagneticThreshold();
    return this.applyMagneticGuides(time, threshold);
  }

  /**
   * Check if device supports haptic feedback
   */
  get supportsHapticFeedback(): boolean {
    return 'vibrate' in navigator;
  }

  /**
   * Resize selected loop by moving one of its edges
   */
  private resizeSelectedLoop(edge: 'left' | 'right', deltaSeconds: number): void {
    const selectedId = this._selectedLoopId();
    if (!selectedId) return;
    
    const loop = this.effectiveLoops.find(l => l.id === selectedId);
    if (!loop) return;
    
    let newStartTime = loop.startTime;
    let newEndTime = loop.endTime;
    
    if (edge === 'left') {
      newStartTime = Math.max(0, Math.min(loop.startTime + deltaSeconds, loop.endTime - 1));
    } else {
      newEndTime = Math.min(this.duration, Math.max(loop.endTime + deltaSeconds, loop.startTime + 1));
    }
    
    // Apply precision and magnetic guides
    newStartTime = this.applyMagneticGuides(newStartTime);
    newEndTime = this.applyMagneticGuides(newEndTime);
    
    // Check for collisions
    if (!this.checkLoopCollision(selectedId, newStartTime, newEndTime)) {
      this.loopResize.emit({ id: selectedId, startTime: newStartTime, endTime: newEndTime });
    }
  }

  /**
   * Move selected loop in time by a delta
   */
  private moveSelectedLoop(deltaSeconds: number): void {
    const selectedId = this._selectedLoopId();
    if (!selectedId) return;
    
    const loop = this.effectiveLoops.find(l => l.id === selectedId);
    if (!loop) return;
    
    const duration = loop.endTime - loop.startTime;
    let newStartTime = loop.startTime + deltaSeconds;
    let newEndTime = loop.endTime + deltaSeconds;
    
    // Ensure bounds
    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = duration;
    }
    if (newEndTime > this.duration) {
      newEndTime = this.duration;
      newStartTime = this.duration - duration;
    }
    
    // Apply precision and magnetic guides
    newStartTime = this.applyMagneticGuides(newStartTime);
    newEndTime = this.applyMagneticGuides(newStartTime + duration);
    
    // Check for collisions
    if (!this.checkLoopCollision(selectedId, newStartTime, newEndTime)) {
      this.loopMove.emit({ id: selectedId, startTime: newStartTime, endTime: newEndTime });
    }
  }

  // === ENHANCED VISUALIZATION METHODS FOR TASK 6.4 ===

  // Minimap state for long video navigation
  private _isMinimapExpanded = false;
  
  // Color palette for automatic segment coloring
  private readonly COLOR_PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#AED6F1'
  ];

  /**
   * Get active loop information for display
   */
  getActiveLoopInfo(): LoopSegment | null {
    if (!this.activeLoopId) return null;
    return this.effectiveLoops.find(loop => loop.id === this.activeLoopId) || null;
  }

  /**
   * Calculate total duration of all loop segments
   */
  getTotalLoopsDuration(): number {
    return this.effectiveLoops.reduce((total, loop) => {
      return total + (loop.endTime - loop.startTime);
    }, 0);
  }

  /**
   * Check if minimap should be displayed for long videos
   */
  shouldShowMinimap(): boolean {
    return this.duration > 120 && this.effectiveLoops.length > 0; // 2+ minutes with loops
  }

  /**
   * Get minimap expansion state
   */
  get isMinimapExpanded(): boolean {
    return this._isMinimapExpanded;
  }

  /**
   * Toggle minimap expansion
   */
  toggleMinimap(event: Event): void {
    event.stopPropagation();
    this._isMinimapExpanded = !this._isMinimapExpanded;
  }

  /**
   * Handle minimap click for navigation
   */
  onMinimapClick(event: MouseEvent): void {
    if (!this.isReady) return;
    
    const minimap = event.currentTarget as HTMLElement;
    const rect = minimap.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    const targetTime = this.applyMagneticGuides(percentage * this.duration);
    
    this.seekTo.emit(targetTime);
    this.timelineClick.emit(targetTime);
  }

  /**
   * Get automatic color for loop segment based on index and properties
   */
  getLoopColor(loop: LoopSegment): string {
    // Use existing color if defined
    if (loop.color) return loop.color;
    
    // Generate color based on loop index and properties for consistency
    const loops = this.effectiveLoops;
    const index = loops.findIndex(l => l.id === loop.id);
    const colorIndex = index % this.COLOR_PALETTE.length;
    
    return this.COLOR_PALETTE[colorIndex];
  }

  /**
   * Get enhanced CSS classes for loop segments with visual states
   */
  getEnhancedLoopClasses(loop: LoopSegment): string {
    const classes: string[] = ['loop-segment'];
    
    // Basic states (signal-based)
    if (this._selectedLoopId() === loop.id) {
      classes.push('selected');
    }
    
    if (this.dragState.isDragging && this.dragState.loopId === loop.id) {
      classes.push('dragging');
    }
    
    // Visual states
    if (this.isLoopPlaying(loop)) {
      classes.push('playing', 'active');
    }
    
    if (this.animationStates.hoveredLoopId === loop.id) {
      classes.push('hovered');
    }
    
    // Collision states
    if (this.hasLoopCollisionNearby(loop)) {
      classes.push('has-collision-nearby');
    }
    
    // Touch optimization
    if (this.touchState.isDragging) {
      classes.push('touch-interaction');
    }
    
    // Duration-based visual classes
    const duration = loop.endTime - loop.startTime;
    if (duration < 2) {
      classes.push('short-duration');
    } else if (duration > 10) {
      classes.push('long-duration');
    }
    
    return classes.join(' ');
  }

  /**
   * Check if tooltip should be visible for a loop
   */
  shouldShowTooltip(loop: LoopSegment): boolean {
    return this.animationStates.hoveredLoopId === loop.id || 
           this._selectedLoopId() === loop.id ||
           this.dragState.loopId === loop.id;
  }

  /**
   * Get statistics for a loop segment
   */
  getLoopStats(loop: LoopSegment): {
    playCount: number;
    hasNearbyCollisions: boolean;
    duration: number;
    position: string;
  } {
    return {
      playCount: 0, // Could be tracked in facade
      hasNearbyCollisions: this.hasLoopCollisionNearby(loop),
      duration: loop.endTime - loop.startTime,
      position: `${Math.round(loop.startTime)}s`
    };
  }

  /**
   * Check if loop has nearby collisions (within 1 second)
   */
  hasLoopCollisionNearby(loop: LoopSegment): boolean {
    const buffer = 1.0; // 1 second buffer
    return this.effectiveLoops.some(otherLoop =>
      otherLoop.id !== loop.id &&
      (
        Math.abs(otherLoop.startTime - loop.endTime) < buffer ||
        Math.abs(otherLoop.endTime - loop.startTime) < buffer
      )
    );
  }

  /**
   * Get time markers for long videos (every minute)
   */
  getTimeMarkers(): Array<{position: number, label: string, shortLabel: string}> {
    const markers: Array<{position: number, label: string, shortLabel: string}> = [];
    const intervalMinutes = Math.max(1, Math.floor(this.duration / 300)); // Dynamic interval
    
    for (let minutes = intervalMinutes; minutes * 60 < this.duration; minutes += intervalMinutes) {
      const timeInSeconds = minutes * 60;
      const position = (timeInSeconds / this.duration) * 100;
      
      markers.push({
        position,
        label: this.formatDuration(timeInSeconds),
        shortLabel: `${minutes}m`
      });
    }
    
    return markers;
  }

  /**
   * Get touch-optimized classes for timeline container
   */
  getTouchOptimizedClasses(): string {
    const classes: string[] = [];
    
    if ('ontouchstart' in window) {
      classes.push('touch-device');
    }
    
    if (this.touchState.isDragging) {
      classes.push('touch-dragging');
    }
    
    if (this.touchState.gestureType === 'swipe') {
      classes.push('touch-swiping');
    }
    
    if (this.touchState.gestureType === 'pinch') {
      classes.push('touch-pinching');
    }
    
    return classes.join(' ');
  }

  /**
   * Cache position calculation result with TTL management
   */
  private cachePositionResult(key: string, position: number, timestamp: number): void {
    // Clean old entries if cache is getting large
    if (this._positionCache.size >= this.POSITION_CACHE_SIZE) {
      this.cleanupPositionCache();
    }
    
    this._positionCache.set(key, { position, timestamp });
  }

  /**
   * Cache time calculation result with TTL management
   */
  private cacheTimeResult(key: string, time: number, timestamp: number): void {
    // Clean old entries if cache is getting large
    if (this._timeCache.size >= this.POSITION_CACHE_SIZE) {
      this.cleanupTimeCache();
    }
    
    this._timeCache.set(key, { time, timestamp });
  }

  /**
   * Clean up expired cache entries for position calculations
   */
  private cleanupPositionCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, value] of this._positionCache.entries()) {
      if (now - value.timestamp > this.POSITION_CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this._positionCache.delete(key));
    
    // If still too large, remove oldest entries
    if (this._positionCache.size >= this.POSITION_CACHE_SIZE) {
      const sortedEntries = Array.from(this._positionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, Math.floor(this.POSITION_CACHE_SIZE / 2));
      toRemove.forEach(([key]) => this._positionCache.delete(key));
    }
  }

  /**
   * Clean up expired cache entries for time calculations
   */
  private cleanupTimeCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, value] of this._timeCache.entries()) {
      if (now - value.timestamp > this.POSITION_CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this._timeCache.delete(key));
    
    // If still too large, remove oldest entries
    if (this._timeCache.size >= this.POSITION_CACHE_SIZE) {
      const sortedEntries = Array.from(this._timeCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, Math.floor(this.POSITION_CACHE_SIZE / 2));
      toRemove.forEach(([key]) => this._timeCache.delete(key));
    }
  }

  /**
   * Batch process multiple times with precision rounding
   * Enhanced version of getPositionsForTimes with precision support
   */
  getBatchTimesWithPrecision(times: number[]): number[] {
    return times.map(time => this.roundToPrecision(time, this.PRECISION_DECIMALS));
  }

  /**
   * Batch process multiple positions with precision and caching
   * Performance-optimized version for multiple position calculations
   */
  getBatchPositionsWithPrecision(times: number[]): number[] {
    if (this.duration === 0) return times.map(() => 0);
    
    const now = Date.now();
    const results: number[] = [];
    const uncachedTimes: Array<{time: number, index: number}> = [];
    
    // Check cache first for all times
    times.forEach((time, index) => {
      const preciseTime = this.roundToPrecision(time, this.PRECISION_DECIMALS);
      const cacheKey = `${preciseTime}_${this.duration}`;
      const cached = this._positionCache.get(cacheKey);
      
      if (cached && (now - cached.timestamp) < this.POSITION_CACHE_TTL) {
        results[index] = cached.position;
      } else {
        results[index] = 0; // placeholder
        uncachedTimes.push({ time: preciseTime, index });
      }
    });
    
    // Calculate uncached positions in batch
    if (uncachedTimes.length > 0) {
      const durationReciprocal = 100 / this.duration;
      
      uncachedTimes.forEach(({ time, index }) => {
        if (time < 0) {
          results[index] = 0;
        } else if (time >= this.duration) {
          results[index] = 100;
        } else {
          const rawPosition = time * durationReciprocal;
          const precisePosition = Math.round(rawPosition * 10000) / 10000; // 4 decimal precision
          const boundedPosition = Math.max(0, Math.min(precisePosition, 100));
          
          results[index] = boundedPosition;
          
          // Cache the result
          const cacheKey = `${time}_${this.duration}`;
          this.cachePositionResult(cacheKey, boundedPosition, now);
        }
      });
    }
    
    return results;
  }

  /**
   * Get enhanced precision information for debugging/testing
   */
  getPrecisionInfo(): {
    precision: number;
    cacheSize: {positions: number, times: number};
    cacheHitRatio: number;
  } {
    return {
      precision: this.PRECISION_DECIMALS,
      cacheSize: {
        positions: this._positionCache.size,
        times: this._timeCache.size
      },
      cacheHitRatio: 0 // Would need to track hits/misses for accurate calculation
    };
  }

  /**
   * Clear all precision caches (useful for testing or memory management)
   */
  clearPrecisionCaches(): void {
    this._positionCache.clear();
    this._timeCache.clear();
  }

  /**
   * Validate if a time value meets precision requirements
   */
  isTimePrecisionValid(time: number): boolean {
    const rounded = this.roundToPrecision(time, this.PRECISION_DECIMALS);
    return Math.abs(time - rounded) < 0.001; // 1ms tolerance
  }
}