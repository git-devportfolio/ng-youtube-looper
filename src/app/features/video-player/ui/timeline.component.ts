import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  @Input() loops: any[] = []; // TODO: Define proper Loop interface

  // Output events for navigation
  @Output() seekTo = new EventEmitter<number>();
  @Output() timelineClick = new EventEmitter<number>();

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
   * Handle click on timeline track for navigation
   */
  onTrackClick(event: MouseEvent): void {
    if (!this.isReady) return;
    
    const track = event.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    const targetTime = percentage * this.duration;
    
    this.seekTo.emit(targetTime);
    this.timelineClick.emit(targetTime);
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