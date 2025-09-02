import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoopManagerFacade } from '../../services/loop-manager.facade';
import { LoopSegment, CreateLoopRequest, UpdateLoopRequest } from '@shared/interfaces';

export interface LoopFormData {
  name: string;
  startTimeText: string;
  endTimeText: string;
  playbackSpeed: number;
  repeatCount: number;
  color: string;
}

export interface LoopFormResult {
  type: 'create' | 'update';
  data: CreateLoopRequest | UpdateLoopRequest;
}

@Component({
  selector: 'app-loop-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loop-form.component.html',
  styleUrl: './loop-form.component.scss'
})
export class LoopFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(LoopManagerFacade);

  @Input() editingLoop: LoopSegment | null = null;
  @Input() videoDuration?: number;
  @Output() formSubmit = new EventEmitter<LoopFormResult>();
  @Output() formCancel = new EventEmitter<void>();

  loopForm!: FormGroup;
  
  readonly speedOptions = [
    { value: 0.25, label: '0.25x' },
    { value: 0.5, label: '0.5x' },
    { value: 0.75, label: '0.75x' },
    { value: 1.0, label: '1x' },
    { value: 1.25, label: '1.25x' },
    { value: 1.5, label: '1.5x' },
    { value: 2.0, label: '2x' }
  ];

  readonly colorOptions = [
    { value: '#3B82F6', label: 'Bleu' },
    { value: '#EF4444', label: 'Rouge' },
    { value: '#10B981', label: 'Vert' },
    { value: '#F59E0B', label: 'Orange' },
    { value: '#8B5CF6', label: 'Violet' },
    { value: '#EC4899', label: 'Rose' }
  ];

  get isEditMode(): boolean {
    return this.editingLoop !== null;
  }

  get formTitle(): string {
    return this.isEditMode ? 'Modifier la boucle' : 'Créer une nouvelle boucle';
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editingLoop'] && this.loopForm) {
      this.populateFormFromLoop();
    }
  }

  private initializeForm(): void {
    this.loopForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]],
      startTimeText: ['0:00', [Validators.required, this.timeFormatValidator]],
      endTimeText: ['0:30', [Validators.required, this.timeFormatValidator]],
      playbackSpeed: [1.0, [Validators.required, Validators.min(0.25), Validators.max(2.0)]],
      repeatCount: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
      color: ['#3B82F6', [Validators.required]]
    }, { 
      validators: [this.timeRangeValidator, this.videoDurationValidator]
    });

    this.populateFormFromLoop();
  }

  private populateFormFromLoop(): void {
    if (this.editingLoop) {
      this.loopForm.patchValue({
        name: this.editingLoop.name,
        startTimeText: this.facade.formatTime(this.editingLoop.startTime),
        endTimeText: this.facade.formatTime(this.editingLoop.endTime),
        playbackSpeed: this.editingLoop.playbackSpeed,
        repeatCount: this.editingLoop.repeatCount || 1,
        color: this.editingLoop.color || '#3B82F6'
      });
    }
  }

  private timeFormatValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    
    const timePattern = /^(\d{1,2}):([0-5]?\d)(\.\d{1,3})?$/;
    
    if (!timePattern.test(control.value)) {
      return { invalidTimeFormat: { value: control.value } };
    }

    const [, minutes, seconds] = control.value.match(timePattern);
    const totalSeconds = parseInt(minutes) * 60 + parseFloat(seconds);
    
    if (totalSeconds < 0) {
      return { negativeTime: { value: control.value } };
    }

    return null;
  }

  private timeRangeValidator = (form: AbstractControl): ValidationErrors | null => {
    const startTimeText = form.get('startTimeText')?.value;
    const endTimeText = form.get('endTimeText')?.value;
    
    if (!startTimeText || !endTimeText) return null;
    
    const startSeconds = this.facade.parseTime(startTimeText);
    const endSeconds = this.facade.parseTime(endTimeText);
    
    if (startSeconds >= endSeconds) {
      return { invalidTimeRange: { start: startTimeText, end: endTimeText } };
    }
    
    const duration = endSeconds - startSeconds;
    if (duration < 0.1) { // Minimum 100ms
      return { tooShort: { duration } };
    }
    
    return null;
  };

  private videoDurationValidator = (form: AbstractControl): ValidationErrors | null => {
    if (!this.videoDuration) return null;
    
    const endTimeText = form.get('endTimeText')?.value;
    if (!endTimeText) return null;
    
    const endSeconds = this.facade.parseTime(endTimeText);
    if (endSeconds > this.videoDuration) {
      return { exceedsVideoDuration: { 
        endTime: endSeconds, 
        videoDuration: this.videoDuration 
      }};
    }
    
    return null;
  };

  onSubmit(): void {
    if (this.loopForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValue = this.loopForm.value;
    const startTime = this.facade.parseTime(formValue.startTimeText);
    const endTime = this.facade.parseTime(formValue.endTimeText);

    if (this.isEditMode && this.editingLoop) {
      const updateRequest: UpdateLoopRequest = {
        id: this.editingLoop.id,
        name: formValue.name,
        startTime,
        endTime,
        playbackSpeed: formValue.playbackSpeed,
        repeatCount: formValue.repeatCount,
        color: formValue.color
      };

      this.formSubmit.emit({
        type: 'update',
        data: updateRequest
      });
    } else {
      const createRequest: CreateLoopRequest = {
        name: formValue.name,
        startTime,
        endTime,
        playbackSpeed: formValue.playbackSpeed,
        repeatCount: formValue.repeatCount,
        color: formValue.color
      };

      this.formSubmit.emit({
        type: 'create',
        data: createRequest
      });
    }
  }

  onCancel(): void {
    this.formCancel.emit();
    this.resetForm();
  }

  resetForm(): void {
    this.loopForm.reset({
      name: '',
      startTimeText: '0:00',
      endTimeText: '0:30',
      playbackSpeed: 1.0,
      repeatCount: 1,
      color: '#3B82F6'
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loopForm.controls).forEach(key => {
      this.loopForm.get(key)?.markAsTouched();
    });
  }

  // Utility getters for template
  get nameControl() { return this.loopForm.get('name'); }
  get startTimeControl() { return this.loopForm.get('startTimeText'); }
  get endTimeControl() { return this.loopForm.get('endTimeText'); }
  get playbackSpeedControl() { return this.loopForm.get('playbackSpeed'); }
  get repeatCountControl() { return this.loopForm.get('repeatCount'); }
  get colorControl() { return this.loopForm.get('color'); }

  // Error message getters
  getNameErrorMessage(): string {
    const control = this.nameControl;
    if (control?.hasError('required')) return 'Le nom est requis';
    if (control?.hasError('minlength')) return 'Le nom doit avoir au moins 1 caractère';
    if (control?.hasError('maxlength')) return 'Le nom ne peut pas dépasser 100 caractères';
    return '';
  }

  getStartTimeErrorMessage(): string {
    const control = this.startTimeControl;
    if (control?.hasError('required')) return 'L\'heure de début est requise';
    if (control?.hasError('invalidTimeFormat')) return 'Format invalide (utilisez MM:SS ou MM:SS.sss)';
    if (control?.hasError('negativeTime')) return 'L\'heure ne peut pas être négative';
    return '';
  }

  getEndTimeErrorMessage(): string {
    const control = this.endTimeControl;
    if (control?.hasError('required')) return 'L\'heure de fin est requise';
    if (control?.hasError('invalidTimeFormat')) return 'Format invalide (utilisez MM:SS ou MM:SS.sss)';
    if (control?.hasError('negativeTime')) return 'L\'heure ne peut pas être négative';
    return '';
  }

  getFormErrorMessage(): string {
    if (this.loopForm.hasError('invalidTimeRange')) {
      return 'L\'heure de fin doit être supérieure à l\'heure de début';
    }
    if (this.loopForm.hasError('tooShort')) {
      return 'La durée minimale est de 0.1 seconde';
    }
    if (this.loopForm.hasError('exceedsVideoDuration')) {
      const error = this.loopForm.getError('exceedsVideoDuration');
      return `L'heure de fin (${error.endTime}s) dépasse la durée de la vidéo (${error.videoDuration}s)`;
    }
    return '';
  }
}
