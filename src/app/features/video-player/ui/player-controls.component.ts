import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-controls',
  imports: [CommonModule],
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss']
})
export class PlayerControlsComponent {
  @Input() canPlay = false;
  @Input() canPause = false;
  @Input() isPlaying = false;
  @Input() circular = false;

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