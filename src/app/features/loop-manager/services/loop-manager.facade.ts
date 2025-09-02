import { Injectable, computed, signal, inject } from '@angular/core';
import { LoopService } from '@core/services/loop.service';
import { 
  LoopSegment,
  CreateLoopRequest,
  UpdateLoopRequest,
  LoopOperationResult 
} from '@shared/interfaces';

export interface LoopManagerViewModel {
  loops: LoopSegment[];
  activeLoop: LoopSegment | null;
  isLooping: boolean;
  hasLoops: boolean;
  canStartLoop: boolean;
  totalLoops: number;
  activeLoopIndex: number;
  lastError: string | null;
}

export interface TimelineViewModel {
  loops: LoopSegment[];
  activeLoopId: string | null;
  canCreateLoop: boolean;
  hasOverlaps: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LoopManagerFacade {
  private readonly loopService = inject(LoopService);
  
  // Private state signals
  private readonly _isLooping = signal(false);
  private readonly _currentVideoTime = signal(0);
  
  // Public computed ViewModels
  readonly vm = computed<LoopManagerViewModel>(() => {
    const loops = this.loopService.loops();
    const activeLoop = this.loopService.activeLoop();
    const activeIndex = activeLoop ? loops.findIndex(l => l.id === activeLoop.id) : -1;
    
    return {
      loops,
      activeLoop,
      isLooping: this._isLooping(),
      hasLoops: loops.length > 0,
      canStartLoop: activeLoop !== null && !this._isLooping(),
      totalLoops: loops.length,
      activeLoopIndex: activeIndex,
      lastError: this.loopService.lastError()
    };
  });
  
  readonly timelineVm = computed<TimelineViewModel>(() => {
    const loops = this.loopService.loops();
    const activeLoopId = this.loopService.activeLoopId();
    
    // Check for any overlapping loops
    const hasOverlaps = loops.some(loop => 
      this.loopService.findOverlappingLoops(loop, loops).length > 0
    );
    
    return {
      loops,
      activeLoopId,
      canCreateLoop: true,
      hasOverlaps
    };
  });
  
  // Public command methods
  
  /**
   * Create a new loop
   */
  createLoop(request: CreateLoopRequest): LoopOperationResult {
    return this.loopService.createLoopFromRequest(request);
  }
  
  /**
   * Update an existing loop
   */
  editLoop(request: UpdateLoopRequest): LoopOperationResult {
    return this.loopService.updateLoop(request);
  }
  
  /**
   * Delete a loop
   */
  deleteLoop(id: string): LoopOperationResult {
    return this.loopService.deleteLoop(id);
  }
  
  /**
   * Select and activate a loop
   */
  selectLoop(id: string): boolean {
    return this.loopService.setActiveLoop(id);
  }
  
  /**
   * Start playing the active loop
   */
  playLoop(id?: string): boolean {
    if (id) {
      const success = this.loopService.setActiveLoop(id);
      if (!success) return false;
    }
    
    const activeLoop = this.loopService.activeLoop();
    if (!activeLoop) return false;
    
    this._isLooping.set(true);
    return true;
  }
  
  /**
   * Stop the currently playing loop
   */
  stopLoop(): void {
    this._isLooping.set(false);
  }
  
  /**
   * Set the current video context
   */
  setVideoContext(videoId: string): void {
    this.loopService.setCurrentVideoId(videoId);
  }
  
  /**
   * Update current video playback time for progress tracking
   */
  updateVideoTime(currentTime: number): void {
    this._currentVideoTime.set(currentTime);
  }
  
  /**
   * Get loop progress for current time
   */
  getLoopProgress(loopId?: string): number {
    const currentTime = this._currentVideoTime();
    const loop = loopId 
      ? this.loopService.getLoopById(loopId) 
      : this.loopService.activeLoop();
      
    if (!loop) return 0;
    
    return this.loopService.getLoopProgress(currentTime, loop);
  }
  
  /**
   * Check if we should repeat the current loop
   */
  shouldRepeatLoop(): boolean {
    const currentTime = this._currentVideoTime();
    const activeLoop = this.loopService.activeLoop();
    
    if (!activeLoop || !this._isLooping()) return false;
    
    // Check if we've reached the end of the loop
    return currentTime >= activeLoop.endTime;
  }
  
  /**
   * Clear all loops for current video
   */
  clearAllLoops(): void {
    this.loopService.clearAllLoops();
    this.stopLoop();
  }
  
  /**
   * Get formatted time for display
   */
  formatTime(seconds: number): string {
    return this.loopService.formatTime(seconds);
  }
  
  /**
   * Parse time string to seconds
   */
  parseTime(timeString: string): number {
    return this.loopService.parseTime(timeString);
  }
}