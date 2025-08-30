import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-speed-control',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="speed-control">
      <div class="speed-label">
        <span class="label-text">Vitesse</span>
        <span class="current-speed">{{ currentRate }}x</span>
      </div>

      <!-- Preset Speed Buttons -->
      <div class="speed-presets">
        @for (preset of speedPresets; track preset.value) {
          <button
            type="button"
            class="speed-preset"
            [class.active]="currentRate === preset.value"
            [disabled]="disabled"
            (click)="setPresetSpeed(preset.value)"
            [title]="preset.label"
          >
            {{ preset.display }}
          </button>
        }
      </div>

      <!-- Speed Control Buttons -->
      <div class="speed-buttons">
        <button
          type="button"
          class="speed-button decrease"
          [disabled]="disabled || !canDecrease"
          (click)="decreaseSpeed.emit()"
          title="Diminuer la vitesse"
        >
          <span class="speed-icon">🐌</span>
          <span class="speed-text">-</span>
        </button>

        <button
          type="button"
          class="speed-button increase"
          [disabled]="disabled || !canIncrease"
          (click)="increaseSpeed.emit()"
          title="Augmenter la vitesse"
        >
          <span class="speed-icon">🐰</span>
          <span class="speed-text">+</span>
        </button>
      </div>

      <!-- Manual Input -->
      <div class="manual-input" *ngIf="showManualInput">
        <input
          type="number"
          [formControl]="manualSpeedControl"
          class="speed-input"
          placeholder="1.0"
          min="0.25"
          max="2"
          step="0.1"
          [disabled]="disabled"
        >
        <button
          type="button"
          class="apply-button"
          [disabled]="!manualSpeedControl.valid || disabled"
          (click)="applyManualSpeed()"
          title="Appliquer la vitesse personnalisée"
        >
          ✓
        </button>
      </div>

      <!-- Toggle Manual Input -->
      <button
        type="button"
        class="toggle-manual"
        (click)="toggleManualInput()"
        [disabled]="disabled"
        title="Saisie manuelle de vitesse"
      >
        {{ showManualInput ? '⌨️' : '⚙️' }}
      </button>
    </div>
  `,
  styleUrls: ['./speed-control.component.scss']
})
export class SpeedControlComponent {
  @Input() currentRate = 1;
  @Input() disabled = false;

  @Output() rateChange = new EventEmitter<number>();
  @Output() increaseSpeed = new EventEmitter<void>();
  @Output() decreaseSpeed = new EventEmitter<void>();

  readonly speedPresets = [
    { value: 0.5, display: '0.5x', label: 'Moitié vitesse' },
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