import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-controls',
  imports: [CommonModule],
  template: `
    <div class="player-controls">
      <!-- Seek Backward -->
      <button 
        type="button"
        class="control-button seek-button"
        (click)="seekBack.emit()"
        [disabled]="!canSeek"
        title="Reculer de 10 secondes"
      >
        <span class="control-icon">⏪</span>
        <span class="seek-label">-10s</span>
      </button>

      <!-- Play/Pause Toggle -->
      <button 
        type="button"
        class="control-button play-pause-button"
        (click)="togglePlayPause()"
        [disabled]="!canPlay && !canPause"
        [title]="isPlaying ? 'Mettre en pause' : 'Lire'"
      >
        @if (isPlaying) {
          <span class="control-icon">⏸️</span>
        } @else {
          <span class="control-icon">▶️</span>
        }
      </button>

      <!-- Stop -->
      <button 
        type="button"
        class="control-button stop-button"
        (click)="stop.emit()"
        [disabled]="!canSeek"
        title="Arrêter"
      >
        <span class="control-icon">⏹️</span>
      </button>

      <!-- Seek Forward -->
      <button 
        type="button"
        class="control-button seek-button"
        (click)="seekForward.emit()"
        [disabled]="!canSeek"
        title="Avancer de 10 secondes"
      >
        <span class="control-icon">⏩</span>
        <span class="seek-label">+10s</span>
      </button>
    </div>
  `,
  styleUrls: ['./player-controls.component.scss']
})
export class PlayerControlsComponent {
  @Input() canPlay = false;
  @Input() canPause = false;
  @Input() isPlaying = false;

  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
  @Output() seekBack = new EventEmitter<void>();
  @Output() seekForward = new EventEmitter<void>();

  get canSeek(): boolean {
    return this.canPlay || this.canPause;
  }

  togglePlayPause(): void {
    if (this.isPlaying && this.canPause) {
      this.pause.emit();
    } else if (!this.isPlaying && this.canPlay) {
      this.play.emit();
    }
  }
}