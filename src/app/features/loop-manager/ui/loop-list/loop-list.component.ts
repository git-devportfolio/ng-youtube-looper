import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
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
}
