import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-speed-control',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './speed-control.component.html',
  styleUrls: ['./speed-control.component.scss']
})
export class SpeedControlComponent {
  @Input() currentRate = 1;
  @Input() disabled = false;

  @Output() rateChange = new EventEmitter<number>();
  @Output() increaseSpeed = new EventEmitter<void>();
  @Output() decreaseSpeed = new EventEmitter<void>();

  readonly speedPresets = [
    { value: 0.25, display: '0.25x', label: 'Quart de vitesse' },
    { value: 0.75, display: '0.75x', label: 'Trois quarts vitesse' },
    { value: 1, display: '1x', label: 'Vitesse normale' },
    { value: 1.25, display: '1.25x', label: 'Vitesse accélérée' },
    { value: 1.5, display: '1.5x', label: 'Une fois et demie' },
    { value: 2, display: '2x', label: 'Double vitesse' }
  ];

  readonly manualSpeedControl = new FormControl(1, [
    Validators.required,
    Validators.min(0.25),
    Validators.max(2)
  ]);

  showManualInput = false;

  get canIncrease(): boolean {
    return this.currentRate < 2;
  }

  get canDecrease(): boolean {
    return this.currentRate > 0.25;
  }

  setPresetSpeed(rate: number): void {
    if (!this.disabled) {
      this.rateChange.emit(rate);
    }
  }

  toggleManualInput(): void {
    if (!this.disabled) {
      this.showManualInput = !this.showManualInput;
      if (this.showManualInput) {
        this.manualSpeedControl.setValue(this.currentRate);
      }
    }
  }

  applyManualSpeed(): void {
    if (this.manualSpeedControl.valid && !this.disabled) {
      const value = this.manualSpeedControl.value;
      if (value !== null) {
        this.rateChange.emit(value);
        this.showManualInput = false;
      }
    }
  }
}