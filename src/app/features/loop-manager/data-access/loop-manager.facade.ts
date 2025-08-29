import { Injectable, computed, signal, inject } from '@angular/core';
import { ValidationService } from '@core/services/validation.service';

export interface LoopSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  playbackSpeed: number;
  repeatCount?: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LoopManagerFacade {
  private readonly validationService = inject(ValidationService);

  // État privé
  private readonly _loops = signal<LoopSegment[]>([]);
  private readonly _activeLoop = signal<LoopSegment | null>(null);
  private readonly _isLooping = signal(false);
  private readonly _repeatCount = signal(0);
  private readonly _editingLoop = signal<LoopSegment | null>(null);

  // Signals publics
  readonly loops = this._loops.asReadonly();
  readonly activeLoop = this._activeLoop.asReadonly();
  readonly isLooping = this._isLooping.asReadonly();
  readonly repeatCount = this._repeatCount.asReadonly();

  // ViewModels computed
  readonly vm = computed(() => ({
    loops: this._loops(),
    activeLoop: this._activeLoop(),
    isLooping: this._isLooping(),
    repeatCount: this._repeatCount(),
    hasLoops: this._loops().length > 0,
    canStartLoop: this._activeLoop() !== null && !this._isLooping()
  }));

  readonly timelineVm = computed(() => ({
    loops: this._loops(),
    editingLoop: this._editingLoop(),
    activeLoopId: this._activeLoop()?.id || null
  }));

  // Commandes
  createLoop(start: number, end: number, name: string = 'Nouvelle boucle', speed: number = 1): void {
    if (!this.validationService.isValidTimeRange(start, end, 300)) { // 300s max for demo
      console.warn('Plage temporelle invalide');
      return;
    }

    if (!this.validationService.isValidLoopName(name)) {
      console.warn('Nom de boucle invalide');
      return;
    }

    const newLoop: LoopSegment = {
      id: this.generateId(),
      name: name.trim(),
      startTime: start,
      endTime: end,
      playbackSpeed: this.validationService.isValidPlaybackSpeed(speed) ? speed : 1,
      isActive: false
    };

    this._loops.update(loops => [...loops, newLoop]);
  }

  updateLoop(loopId: string, updates: Partial<LoopSegment>): void {
    this._loops.update(loops => 
      loops.map(loop => 
        loop.id === loopId ? { ...loop, ...updates } : loop
      )
    );
  }

  deleteLoop(loopId: string): void {
    this._loops.update(loops => loops.filter(loop => loop.id !== loopId));
    
    // Si c'était la boucle active, la désactiver
    if (this._activeLoop()?.id === loopId) {
      this._activeLoop.set(null);
      this.stopLoop();
    }
  }

  selectLoop(loopId: string): void {
    const loop = this._loops().find(l => l.id === loopId);
    if (loop) {
      this._activeLoop.set(loop);
    }
  }

  startLoop(loopId?: string): void {
    const targetLoop = loopId ? this._loops().find(l => l.id === loopId) : this._activeLoop();
    
    if (targetLoop) {
      this._activeLoop.set(targetLoop);
      this._isLooping.set(true);
      this._repeatCount.set(0);
    }
  }

  stopLoop(): void {
    this._isLooping.set(false);
    this._repeatCount.set(0);
  }

  nextLoop(): void {
    const currentIndex = this._loops().findIndex(l => l.id === this._activeLoop()?.id);
    if (currentIndex !== -1 && currentIndex < this._loops().length - 1) {
      this.selectLoop(this._loops()[currentIndex + 1].id);
    }
  }

  previousLoop(): void {
    const currentIndex = this._loops().findIndex(l => l.id === this._activeLoop()?.id);
    if (currentIndex > 0) {
      this.selectLoop(this._loops()[currentIndex - 1].id);
    }
  }

  incrementRepeatCount(): void {
    this._repeatCount.update(count => count + 1);
  }

  clearAllLoops(): void {
    this._loops.set([]);
    this._activeLoop.set(null);
    this.stopLoop();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}