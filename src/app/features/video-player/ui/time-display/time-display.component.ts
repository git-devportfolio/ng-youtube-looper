import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-display',
  imports: [CommonModule],
  templateUrl: './time-display.component.html',
  styleUrl: './time-display.component.scss'
})
export class TimeDisplayComponent {
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() isLoading = false;
  @Input() hasError = false;
  @Input() showDuration = true;

  /**
   * Format time in MM:SS or HH:MM:SS format depending on duration
   */
  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
      return '00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0 || this.duration >= 3600) {
      // Use HH:MM:SS format if duration is 1 hour or more
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      // Use MM:SS format for shorter durations
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Get the formatted current time display
   */
  get formattedCurrentTime(): string {
    if (this.isLoading) {
      return '--:--';
    }
    if (this.hasError) {
      return 'Error';
    }
    return this.formatTime(this.currentTime);
  }

  /**
   * Get the formatted duration display
   */
  get formattedDuration(): string {
    if (this.hasError) {
      return 'Error';
    }
    if (this.isLoading || this.duration === 0) {
      return '--:--';
    }
    return this.formatTime(this.duration);
  }

  /**
   * Get the complete time display string
   */
  get timeDisplayString(): string {
    if (this.showDuration) {
      return `${this.formattedCurrentTime} / ${this.formattedDuration}`;
    }
    return this.formattedCurrentTime;
  }

  /**
   * Get the progress percentage for accessibility
   */
  get progressPercentage(): number {
    if (this.duration === 0 || this.isLoading || this.hasError) {
      return 0;
    }
    return Math.min((this.currentTime / this.duration) * 100, 100);
  }
}
