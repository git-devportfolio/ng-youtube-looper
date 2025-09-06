import { Component, Output, EventEmitter, inject, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoopManagerFacade } from '../../services/loop-manager.facade';
import { LoopSegment } from '@shared/interfaces';

export interface LoopListAction {
  type: 'play' | 'edit' | 'delete' | 'duplicate';
  loop: LoopSegment;
}

@Component({
  selector: 'app-loop-list',
  imports: [CommonModule],
  templateUrl: './loop-list.component.html',
  styleUrl: './loop-list.component.scss'
})
export class LoopListComponent {
  private readonly facade = inject(LoopManagerFacade);

  @Output() loopAction = new EventEmitter<LoopListAction>();
  @Output() loopSelect = new EventEmitter<LoopSegment>();

  readonly vm = this.facade.vm;
  
  readonly sortedLoops = computed(() => {
    return [...this.vm().loops].sort((a, b) => a.startTime - b.startTime);
  });

  onPlayLoop(loop: LoopSegment): void {
    this.loopAction.emit({ type: 'play', loop });
  }

  onEditLoop(loop: LoopSegment): void {
    this.loopAction.emit({ type: 'edit', loop });
  }

  onDeleteLoop(loop: LoopSegment): void {
    this.loopAction.emit({ type: 'delete', loop });
  }

  onDuplicateLoop(loop: LoopSegment): void {
    this.loopAction.emit({ type: 'duplicate', loop });
  }

  onSelectLoop(loop: LoopSegment): void {
    this.loopSelect.emit(loop);
  }

  calculateDuration(loop: LoopSegment): number {
    return loop.endTime - loop.startTime;
  }

  formatDuration(duration: number): string {
    return this.facade.formatTime(duration);
  }

  formatTimeRange(loop: LoopSegment): string {
    const start = this.facade.formatTime(loop.startTime);
    const end = this.facade.formatTime(loop.endTime);
    return `${start} - ${end}`;
  }

  getSpeedLabel(speed: number): string {
    return `${speed}x`;
  }

  getRepeatLabel(repeatCount?: number): string {
    if (!repeatCount || repeatCount === 1) return '1 fois';
    return `${repeatCount} fois`;
  }

  isActiveLoop(loop: LoopSegment): boolean {
    return this.vm().activeLoop?.id === loop.id;
  }

  // Private property to track currently focused loop index
  private focusedLoopIndex = 0;

  // Keyboard navigation event handler
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const loops = this.sortedLoops();
    if (loops.length === 0) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.focusedLoopIndex = this.focusedLoopIndex > 0 ? this.focusedLoopIndex - 1 : loops.length - 1;
        this.focusLoop(this.focusedLoopIndex);
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.focusedLoopIndex = this.focusedLoopIndex < loops.length - 1 ? this.focusedLoopIndex + 1 : 0;
        this.focusLoop(this.focusedLoopIndex);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.focusedLoopIndex >= 0 && this.focusedLoopIndex < loops.length) {
          const loop = loops[this.focusedLoopIndex];
          this.onSelectLoop(loop);
        }
        break;

      case 'p':
      case 'P':
        // Play/pause focused loop
        event.preventDefault();
        if (this.focusedLoopIndex >= 0 && this.focusedLoopIndex < loops.length) {
          const loop = loops[this.focusedLoopIndex];
          this.onPlayLoop(loop);
        }
        break;

      case 'e':
      case 'E':
        // Edit focused loop
        event.preventDefault();
        if (this.focusedLoopIndex >= 0 && this.focusedLoopIndex < loops.length) {
          const loop = loops[this.focusedLoopIndex];
          this.onEditLoop(loop);
        }
        break;

      case 'd':
      case 'D':
        // Duplicate focused loop
        event.preventDefault();
        if (this.focusedLoopIndex >= 0 && this.focusedLoopIndex < loops.length) {
          const loop = loops[this.focusedLoopIndex];
          this.onDuplicateLoop(loop);
        }
        break;

      case 'Delete':
      case 'Backspace':
        // Delete focused loop
        event.preventDefault();
        if (this.focusedLoopIndex >= 0 && this.focusedLoopIndex < loops.length) {
          const loop = loops[this.focusedLoopIndex];
          this.onDeleteLoop(loop);
        }
        break;
    }
  }

  // Focus a loop by index
  private focusLoop(index: number): void {
    const loops = this.sortedLoops();
    if (index >= 0 && index < loops.length) {
      const loopElement = document.querySelector(`[data-loop-id="${loops[index].id}"]`) as HTMLElement;
      if (loopElement) {
        loopElement.focus();
        loopElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // Handle click and maintain focus tracking
  onLoopCardClick(event: Event, loop: LoopSegment, index: number): void {
    event.preventDefault();
    this.focusedLoopIndex = index;
    this.onSelectLoop(loop);
  }

  // Handle action button clicks with focus management
  onActionClick(event: MouseEvent, action: string, loop: LoopSegment, index: number): void {
    event.stopPropagation();
    this.focusedLoopIndex = index;
    
    switch (action) {
      case 'play':
        this.onPlayLoop(loop);
        break;
      case 'edit':
        this.onEditLoop(loop);
        break;
      case 'duplicate':
        this.onDuplicateLoop(loop);
        break;
      case 'delete':
        this.onDeleteLoop(loop);
        break;
    }
  }
}
