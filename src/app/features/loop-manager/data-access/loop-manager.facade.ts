import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { LoopService } from '@core/services/loop.service';
import { LoopSegment } from '@shared/interfaces/loop.types';

// State interface for the LoopManagerFacade
export interface LoopManagerState {
  loops: LoopSegment[];
  activeLoop: LoopSegment | null;
  isLooping: boolean;
  repeatCount: number;
  editingLoop: LoopSegment | null;
  hasLoops: boolean;
  canStartLoop: boolean;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}

// Main ViewModel for loop management UI
export interface LoopManagerViewModel {
  loops: LoopSegment[];
  activeLoop: LoopSegment | null;
  isLooping: boolean;
  repeatCount: number;
  hasLoops: boolean;
  canStartLoop: boolean;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
  totalLoops: number;
  activeLoopIndex: number;
  loopProgress?: number;
}

// Specialized ViewModel for timeline components
export interface TimelineViewModel {
  loops: LoopSegment[];
  editingLoop: LoopSegment | null;
  activeLoopId: string | null;
  selectedLoopId?: string | null;
  canCreateLoop: boolean;
  overlappingLoops?: LoopSegment[];
}

// Command results for better error handling
export interface LoopCommandResult {
  success: boolean;
  error?: string;
  loop?: LoopSegment;
}

// Loop navigation direction
export type LoopNavigationDirection = 'next' | 'previous' | 'first' | 'last';

// Loop creation options
export interface LoopCreationOptions {
  name?: string;
  playbackSpeed?: number;
  color?: string;
  autoStart?: boolean;
  repeatCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LoopManagerFacade {
  private readonly loopService = inject(LoopService);

  // Private signals for internal state management
  private readonly _loops = signal<LoopSegment[]>([]);
  private readonly _activeLoop = signal<LoopSegment | null>(null);
  private readonly _isLooping = signal(false);
  private readonly _repeatCount = signal(0);
  private readonly _editingLoop = signal<LoopSegment | null>(null);
  private readonly _selectedLoopId = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  // Public readonly signals
  readonly loops = this._loops.asReadonly();
  readonly activeLoop = this._activeLoop.asReadonly();
  readonly isLooping = this._isLooping.asReadonly();
  readonly repeatCount = this._repeatCount.asReadonly();
  readonly editingLoop = this._editingLoop.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  
  // Alias for compatibility with component
  readonly currentLoop = this.activeLoop;

  // Enhanced computed ViewModels
  readonly vm = computed<LoopManagerViewModel>(() => {
    const loops = this._loops();
    const activeLoop = this._activeLoop();
    const activeIndex = activeLoop ? loops.findIndex(l => l.id === activeLoop.id) : -1;
    
    return {
      loops,
      activeLoop,
      isLooping: this._isLooping(),
      repeatCount: this._repeatCount(),
      hasLoops: loops.length > 0,
      canStartLoop: activeLoop !== null && !this._isLooping(),
      canNavigateNext: activeIndex !== -1 && activeIndex < loops.length - 1,
      canNavigatePrevious: activeIndex > 0,
      totalLoops: loops.length,
      activeLoopIndex: activeIndex,
      loopProgress: this.calculateCurrentLoopProgress()
    };
  });

  readonly timelineVm = computed<TimelineViewModel>(() => {
    const loops = this._loops();
    const editingLoop = this._editingLoop();
    const activeLoopId = this._activeLoop()?.id || null;
    
    return {
      loops,
      editingLoop,
      activeLoopId,
      selectedLoopId: this._selectedLoopId(),
      canCreateLoop: editingLoop !== null,
      overlappingLoops: editingLoop ? this.loopService.findOverlappingLoops(editingLoop, loops) : []
    };
  });

  // State ViewModel for compatibility
  readonly state = computed<LoopManagerState>(() => {
    const vm = this.vm();
    return {
      loops: vm.loops,
      activeLoop: vm.activeLoop,
      isLooping: vm.isLooping,
      repeatCount: vm.repeatCount,
      editingLoop: this._editingLoop(),
      hasLoops: vm.hasLoops,
      canStartLoop: vm.canStartLoop,
      canNavigateNext: vm.canNavigateNext,
      canNavigatePrevious: vm.canNavigatePrevious
    };
  });

  constructor() {
    // Effect for automatic loop repetition
    effect(() => {
      // This effect will be triggered when loop reaches end
      // Actual repeat logic will be implemented in integration with VideoPlayerFacade
      // Access signals to track dependencies without storing in variables
      this._activeLoop();
      this._isLooping();
      this._repeatCount();
    });

    // Effect for loop validation
    effect(() => {
      const editingLoop = this._editingLoop();
      const existingLoops = this._loops();
      
      if (editingLoop) {
        const validation = this.loopService.validateLoop(editingLoop, undefined, existingLoops);
        if (!validation.isValid) {
          this._error.set(`Boucle invalide: ${validation.errors.join(', ')}`);
        } else {
          this._error.set(null);
        }
      }
    });
  }

  // Enhanced Commands with LoopService integration
  createLoop(start: number, end: number, name?: string, options?: LoopCreationOptions): LoopCommandResult;
  createLoop(loopData: Omit<LoopSegment, 'id'>): LoopCommandResult;
  createLoop(startOrLoopData: number | Omit<LoopSegment, 'id'>, end?: number, name?: string, options?: LoopCreationOptions): LoopCommandResult {
    // Handle object-based call (new signature)
    if (typeof startOrLoopData === 'object') {
      const loopData = startOrLoopData;
      return this.createLoopFromObject(loopData);
    }
    
    // Handle parameter-based call (original signature)
    return this.createLoopFromParams(startOrLoopData, end!, name || 'Nouvelle boucle', options || {});
  }

  private createLoopFromObject(loopData: Omit<LoopSegment, 'id'>): LoopCommandResult {
    return this.createLoopFromParams(
      loopData.startTime,
      loopData.endTime,
      loopData.name,
      {
        playbackSpeed: loopData.playbackSpeed || 1,
        color: loopData.color || '#3B82F6',
        repeatCount: loopData.repeatCount || 1
      }
    );
  }

  private createLoopFromParams(start: number, end: number, name: string = 'Nouvelle boucle', options: LoopCreationOptions = {}): LoopCommandResult {
    try {
      this._isLoading.set(true);
      const existingLoops = this._loops();
      const { loop, validation } = this.loopService.createValidatedLoop(
        name,
        start,
        end,
        {
          playbackSpeed: options.playbackSpeed || 1,
          color: options.color || '#3B82F6',
          repeatCount: options.repeatCount || 1
        },
        undefined, // videoDuration will be provided by VideoPlayerFacade integration
        existingLoops
      );

      if (!validation.isValid) {
        const errorMsg = `Impossible de créer la boucle: ${validation.errors.join(', ')}`;
        this._error.set(errorMsg);
        this._isLoading.set(false);
        return { success: false, error: errorMsg };
      }

      // Convert Loop to LoopSegment with proper mapping
      const loopSegment: LoopSegment = {
        ...loop,
        playbackSpeed: loop.playbackSpeed || 1,
        playCount: 0,
        isActive: loop.isActive || false
      };
      this._loops.update(loops => [...loops, loopSegment]);
      
      // Auto-start if requested
      if (options.autoStart) {
        this.startLoop(loopSegment.id);
      }
      
      this._error.set(null);
      this._isLoading.set(false);
      return { success: true, loop: loopSegment };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la création de la boucle';
      this._error.set(errorMsg);
      this._isLoading.set(false);
      return { success: false, error: errorMsg };
    }
  }

  updateLoop(loopId: string, updates: Partial<LoopSegment>): LoopCommandResult {
    try {
      const loops = this._loops();
      const loopIndex = loops.findIndex(l => l.id === loopId);
      
      if (loopIndex === -1) {
        const errorMsg = 'Boucle non trouvée';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const currentLoop = loops[loopIndex];
      const updatedLoop = { ...currentLoop, ...updates };
      
      // Validate the updated loop
      const otherLoops = loops.filter(l => l.id !== loopId);
      const validation = this.loopService.validateLoop(updatedLoop, undefined, otherLoops);
      
      if (!validation.isValid) {
        const errorMsg = `Mise à jour invalide: ${validation.errors.join(', ')}`;
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      this._loops.update(loops => 
        loops.map(loop => 
          loop.id === loopId ? updatedLoop : loop
        )
      );
      
      // Update active loop if it's the one being modified
      if (this._activeLoop()?.id === loopId) {
        this._activeLoop.set(updatedLoop);
      }
      
      this._error.set(null);
      return { success: true, loop: updatedLoop };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la mise à jour';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  deleteLoop(loopId: string): LoopCommandResult {
    try {
      const loops = this._loops();
      const loopToDelete = loops.find(l => l.id === loopId);
      
      if (!loopToDelete) {
        const errorMsg = 'Boucle non trouvée';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      this._loops.update(loops => loops.filter(loop => loop.id !== loopId));
      
      // Clean up related state
      if (this._activeLoop()?.id === loopId) {
        this._activeLoop.set(null);
        this.stopLoop();
      }
      
      if (this._editingLoop()?.id === loopId) {
        this._editingLoop.set(null);
      }
      
      if (this._selectedLoopId() === loopId) {
        this._selectedLoopId.set(null);
      }
      
      this._error.set(null);
      return { success: true, loop: loopToDelete };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  selectLoop(loopId: string): LoopCommandResult {
    try {
      const loop = this._loops().find(l => l.id === loopId);
      if (!loop) {
        const errorMsg = 'Boucle non trouvée';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      this._activeLoop.set(loop);
      this._selectedLoopId.set(loopId);
      this._error.set(null);
      return { success: true, loop };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la sélection';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  startLoop(loopId?: string): LoopCommandResult {
    try {
      this._isLoading.set(true);
      const targetLoop = loopId ? this._loops().find(l => l.id === loopId) : this._activeLoop();
      
      if (!targetLoop) {
        const errorMsg = loopId ? 'Boucle non trouvée' : 'Aucune boucle sélectionnée';
        this._error.set(errorMsg);
        this._isLoading.set(false);
        return { success: false, error: errorMsg };
      }

      this._activeLoop.set(targetLoop);
      this._isLooping.set(true);
      this._repeatCount.set(0);
      this._selectedLoopId.set(targetLoop.id);
      this._error.set(null);
      this._isLoading.set(false);
      
      return { success: true, loop: targetLoop };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors du démarrage';
      this._error.set(errorMsg);
      this._isLoading.set(false);
      return { success: false, error: errorMsg };
    }
  }

  // Alias for compatibility with component
  playLoop(loopId: string): LoopCommandResult {
    return this.startLoop(loopId);
  }

  stopLoop(): LoopCommandResult {
    try {
      const activeLoop = this._activeLoop();
      this._isLooping.set(false);
      this._repeatCount.set(0);
      this._error.set(null);
      
      return activeLoop ? { success: true, loop: activeLoop } : { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de l\'arrêt';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  nextLoop(): LoopCommandResult {
    return this.navigateLoop('next');
  }

  previousLoop(): LoopCommandResult {
    return this.navigateLoop('previous');
  }

  // Enhanced navigation with direction support
  navigateLoop(direction: LoopNavigationDirection): LoopCommandResult {
    try {
      const loops = this._loops();
      if (loops.length === 0) {
        const errorMsg = 'Aucune boucle disponible';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const currentIndex = this._activeLoop() ? loops.findIndex(l => l.id === this._activeLoop()?.id) : -1;
      let targetIndex: number;

      switch (direction) {
        case 'next':
          targetIndex = currentIndex !== -1 && currentIndex < loops.length - 1 ? currentIndex + 1 : currentIndex;
          break;
        case 'previous':
          targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
          break;
        case 'first':
          targetIndex = 0;
          break;
        case 'last':
          targetIndex = loops.length - 1;
          break;
        default:
          throw new Error('Direction de navigation invalide');
      }

      if (targetIndex === currentIndex && currentIndex !== -1) {
        const errorMsg = `Impossible de naviguer vers ${direction} - déjà à la limite`;
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const targetLoop = loops[targetIndex];
      return this.selectLoop(targetLoop.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la navigation';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  incrementRepeatCount(): void {
    this._repeatCount.update(count => count + 1);
  }

  // Enhanced repeat and loop completion logic
  handleLoopCompletion(): LoopCommandResult {
    try {
      const activeLoop = this._activeLoop();
      if (!activeLoop || !this._isLooping()) {
        return { success: false, error: 'Aucune boucle active en cours' };
      }

      this.incrementRepeatCount();
      const currentRepeatCount = this._repeatCount();
      const maxRepeats = activeLoop.repeatCount || 1;

      if (currentRepeatCount >= maxRepeats) {
        // Loop completed, move to next or stop
        const canNavigateNext = this.vm().canNavigateNext;
        if (canNavigateNext) {
          return this.nextLoop();
        } else {
          return this.stopLoop();
        }
      }

      // Continue current loop
      return { success: true, loop: activeLoop };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la gestion de fin de boucle';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // Loop editing support
  startEditingLoop(loopId: string): LoopCommandResult {
    try {
      const loop = this._loops().find(l => l.id === loopId);
      if (!loop) {
        const errorMsg = 'Boucle non trouvée';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      this._editingLoop.set({ ...loop }); // Create a copy for editing
      this._error.set(null);
      return { success: true, loop };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors du démarrage de l\'édition';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  cancelEditingLoop(): LoopCommandResult {
    try {
      const editingLoop = this._editingLoop();
      this._editingLoop.set(null);
      this._error.set(null);
      return editingLoop ? { success: true, loop: editingLoop } : { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de l\'annulation';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  saveEditingLoop(): LoopCommandResult {
    try {
      const editingLoop = this._editingLoop();
      if (!editingLoop) {
        const errorMsg = 'Aucune boucle en cours d\'édition';
        this._error.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const updateResult = this.updateLoop(editingLoop.id, editingLoop);
      if (updateResult.success) {
        this._editingLoop.set(null);
      }
      return updateResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // Batch operations
  clearAllLoops(): LoopCommandResult {
    try {
      this._loops.set([]);
      this._activeLoop.set(null);
      this._editingLoop.set(null);
      this._selectedLoopId.set(null);
      this.stopLoop();
      this._error.set(null);
      
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur lors du nettoyage';
      this._error.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  // Utility methods
  private calculateCurrentLoopProgress(): number {
    const activeLoop = this._activeLoop();
    if (!activeLoop) return 0;
    
    // This would need integration with VideoPlayerFacade to get current time
    // For now, return 0 as placeholder
    return 0;
  }

  getLoopStatistics(): {
    totalCount: number;
    activeCount: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const loops = this._loops();
    return this.loopService.getLoopStatistics(loops);
  }

  validateAllLoops(videoDuration?: number): {
    isValid: boolean;
    criticalIssues: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const loops = this._loops();
    return this.loopService.validateLoopCollection(loops, videoDuration);
  }

  // Integration methods for VideoPlayerFacade
  getCurrentLoopAtTime(currentTime: number): LoopSegment | null {
    const loops = this._loops();
    return this.loopService.getCurrentLoop(currentTime, loops) as LoopSegment | null;
  }

  getLoopProgress(currentTime: number, loop?: LoopSegment): number {
    const targetLoop = loop || this._activeLoop();
    if (!targetLoop) return 0;
    return this.loopService.getLoopProgress(currentTime, targetLoop);
  }

  // Auto-repeat and navigation logic
  shouldRepeatLoop(currentTime: number): boolean {
    const activeLoop = this._activeLoop();
    if (!activeLoop || !this._isLooping()) return false;
    
    const maxRepeats = activeLoop.repeatCount || 1;
    const currentRepeats = this._repeatCount();
    
    return currentTime >= activeLoop.endTime && currentRepeats < maxRepeats;
  }

  shouldNavigateToNext(): boolean {
    const activeLoop = this._activeLoop();
    if (!activeLoop || !this._isLooping()) return false;
    
    const maxRepeats = activeLoop.repeatCount || 1;
    const currentRepeats = this._repeatCount();
    
    return currentRepeats >= maxRepeats && this.vm().canNavigateNext;
  }

}