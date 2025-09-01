import { Component, Input, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Loop } from '@core/services/loop.service';
import { TimelineViewModel, LoopSegment } from '../../loop-manager/data-access/loop-manager.facade';

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
   * Get position percentage for a given time
   */
  getPositionForTime(time: number): number {
    if (this.duration === 0) return 0;
    return Math.min((time / this.duration) * 100, 100);
  }

  /**
   * Handle touch start for mobile navigation
   */
  onTouchStart(event: TouchEvent): void {
    if (!this.isReady) return;
    
    event.preventDefault();
    this.touchStartTime = Date.now();
    this.startSeeking();
  }

  /**
   * Handle touch end for mobile navigation
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
      
      this.seekTo.emit(targetTime);
      this.timelineClick.emit(targetTime);
    }
    
    this.touchStartTime = null;
    
    // End seeking state after a short delay
    setTimeout(() => this.endSeeking(), 200);
  }

  /**
   * Enhanced click handler with touch prevention
   */
  onTrackClick(event: MouseEvent): void {
    if (!this.isReady) return;
    
    // Prevent double events from touch devices
    if (this.touchStartTime !== null) return;
    
    this.startSeeking();
    
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    const targetTime = percentage * this.duration;
    
    this.seekTo.emit(targetTime);
    this.timelineClick.emit(targetTime);
    
    // End seeking state after a short delay
    setTimeout(() => this.endSeeking(), 200);
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
   * Get loop segment position and width as percentages
   */
  getLoopPosition(loop: LoopSegment): {left: number, width: number} {
    if (this.duration === 0) return {left: 0, width: 0};
    
    const left = (loop.startTime / this.duration) * 100;
    const width = ((loop.endTime - loop.startTime) / this.duration) * 100;
    
    return {
      left: Math.max(0, Math.min(left, 100)),
      width: Math.max(0, Math.min(width, 100 - left))
    };
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
   * Check for collisions between loops
   */
  private checkLoopCollision(excludeLoopId: string, startTime: number, endTime: number): boolean {
    return this.effectiveLoops.some(loop => 
      loop.id !== excludeLoopId &&
      !(endTime <= loop.startTime || startTime >= loop.endTime)
    );
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