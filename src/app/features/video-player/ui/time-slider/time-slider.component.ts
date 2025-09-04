import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-slider',
  imports: [CommonModule],
  templateUrl: './time-slider.component.html',
  styleUrl: './time-slider.component.scss'
})
export class TimeSliderComponent {
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() disabled = false;
  @Input() buffered = 0;

  @Output() seekTo = new EventEmitter<number>();
  @Output() seekStart = new EventEmitter<void>();
  @Output() seekEnd = new EventEmitter<void>();

  isDragging = false;

  get progressPercentage(): number {
    if (this.duration === 0) return 0;
    return Math.min((this.currentTime / this.duration) * 100, 100);
  }

  get bufferedPercentage(): number {
    if (this.duration === 0) return 0;
    return Math.min((this.buffered / this.duration) * 100, 100);
  }

  onSeekStart(): void {
    if (this.disabled) return;
    this.isDragging = true;
    this.seekStart.emit();
  }

  onSeekEnd(): void {
    if (this.disabled || !this.isDragging) return;
    this.isDragging = false;
    this.seekEnd.emit();
  }

  onSeek(event: Event): void {
    if (this.disabled || this.duration === 0) return;
    
    const target = event.target as HTMLInputElement;
    const seekTime = (parseFloat(target.value) / 100) * this.duration;
    this.seekTo.emit(seekTime);
  }

  onSliderClick(event: MouseEvent): void {
    if (this.disabled || this.duration === 0) return;
    
    const slider = event.currentTarget as HTMLElement;
    const rect = slider.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const percentage = Math.min(Math.max(clickPosition / rect.width, 0), 1);
    const seekTime = percentage * this.duration;
    
    this.seekTo.emit(seekTime);
  }
}
