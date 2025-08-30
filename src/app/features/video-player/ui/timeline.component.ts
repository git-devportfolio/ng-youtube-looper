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
  @Input() isPlaying = false; // New input for animation states
  @Input() loops: any[] = []; // TODO: Define proper Loop interface

  // Output events for navigation
  @Output() seekTo = new EventEmitter<number>();
  @Output() timelineClick = new EventEmitter<number>();
  @Output() seekStart = new EventEmitter<void>();
  @Output() seekEnd = new EventEmitter<void>();

  // Internal state for seeking animation
  private isSeeking = false;

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
   * Handle click on timeline track for navigation
   */
  onTrackClick(event: MouseEvent): void {
    if (!this.isReady) return;
    
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
   * Format duration in MM:SS format
   */
  formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}