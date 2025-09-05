import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy,
  inject,
  signal,
  computed,
  effect 
} from '@angular/core';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  ReactiveFormsModule 
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SessionFacade } from '../../data-access';
import { LooperSession } from '@core/services/looper-storage.types';

export interface SessionFormData {
  name: string;
  description?: string;
  tags: string[];
}

export interface SessionFormEvents {
  save: SessionFormData;
  cancel: void;
}

@Component({
  selector: 'app-session-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './session-form.component.html',
  styleUrls: ['./session-form.component.scss']
})
export class SessionFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sessionFacade = inject(SessionFacade);
  private readonly destroy$ = new Subject<void>();

  @Input() session: LooperSession | null = null;
  @Input() videoId: string | null = null;
  @Input() videoTitle: string | null = null;
  @Input() videoUrl: string | null = null;
  @Input() videoDuration: number | null = null;

  @Output() save = new EventEmitter<SessionFormData>();
  @Output() cancel = new EventEmitter<void>();

  // Form management
  sessionForm!: FormGroup;

  // Component state signals
  private readonly _isSubmitting = signal<boolean>(false);
  private readonly _formErrors = signal<Record<string, string>>({});
  private readonly _isEditMode = signal<boolean>(false);

  // Public readonly signals
  readonly isSubmitting = this._isSubmitting.asReadonly();
  readonly formErrors = this._formErrors.asReadonly();
  readonly isEditMode = this._isEditMode.asReadonly();
  
  // Computed validation states
  readonly canSubmit = computed(() => 
    this.sessionForm?.valid && !this._isSubmitting() && this.hasRequiredData()
  );

  readonly submitButtonText = computed(() => 
    this._isEditMode() ? 'Mettre à jour' : 'Créer la session'
  );

  readonly formTitle = computed(() => 
    this._isEditMode() ? 'Modifier la session' : 'Nouvelle session'
  );

  // Expose facade loading state
  readonly isLoading = this.sessionFacade.isLoading;
  readonly lastError = this.sessionFacade.lastError;

  constructor() {
    // Update edit mode when session input changes
    effect(() => {
      this._isEditMode.set(!!this.session);
      if (this.session && this.sessionForm) {
        this.loadSessionData();
      }
    });

    // Watch for facade errors
    effect(() => {
      const error = this.sessionFacade.lastError();
      if (error) {
        this._formErrors.set({ submit: error });
      }
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === FORM INITIALIZATION ===

  private initializeForm(): void {
    this.sessionForm = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      description: ['', [
        Validators.maxLength(200)
      ]],
      tags: ['']
    });

    // Load existing session data if provided
    if (this.session) {
      this.loadSessionData();
    }
  }

  private loadSessionData(): void {
    if (!this.session || !this.sessionForm) return;

    this.sessionForm.patchValue({
      name: this.session.name,
      description: this.session.description || '',
      tags: this.session.tags?.join(', ') || ''
    });
  }

  private setupFormValidation(): void {
    // Real-time validation feedback
    this.sessionForm.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateFormErrors();
      });

    // Custom async validator for unique session names
    this.sessionForm.get('name')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value && this.isNameTaken(value)) {
          this.sessionForm.get('name')?.setErrors({ 
            ...this.sessionForm.get('name')?.errors,
            nameTaken: true 
          });
        }
      });
  }

  private updateFormErrors(): void {
    const errors: Record<string, string> = {};

    Object.keys(this.sessionForm.controls).forEach(key => {
      const control = this.sessionForm.get(key);
      if (control?.invalid && control?.touched) {
        if (control.errors?.['required']) {
          errors[key] = `Le champ ${key} est obligatoire`;
        } else if (control.errors?.['minlength']) {
          const minLength = control.errors['minlength'].requiredLength;
          errors[key] = `Le ${key} doit contenir au moins ${minLength} caractères`;
        } else if (control.errors?.['maxlength']) {
          const maxLength = control.errors['maxlength'].requiredLength;
          errors[key] = `Le ${key} ne peut pas dépasser ${maxLength} caractères`;
        } else if (control.errors?.['nameTaken']) {
          errors[key] = 'Ce nom de session est déjà utilisé';
        }
      }
    });

    this._formErrors.set(errors);
  }

  // === VALIDATION HELPERS ===

  private isNameTaken(name: string): boolean {
    if (!name || (this._isEditMode() && this.session?.name === name)) {
      return false;
    }
    
    return this.sessionFacade.sessionExistsByName(name.trim());
  }

  private hasRequiredData(): boolean {
    if (this._isEditMode()) {
      return true; // Edit mode only needs form data
    }
    
    // Create mode needs video information
    return !!(
      this.videoId &&
      this.videoTitle &&
      this.videoUrl &&
      typeof this.videoDuration === 'number' &&
      this.videoDuration > 0
    );
  }

  // === FORM ACTIONS ===

  async onSubmit(): Promise<void> {
    if (!this.sessionForm.valid || this._isSubmitting()) {
      this.markFormGroupTouched();
      return;
    }

    this._isSubmitting.set(true);
    this._formErrors.set({});

    try {
      const formData = this.getFormData();

      if (this._isEditMode()) {
        await this.updateExistingSession(formData);
      } else {
        await this.createNewSession(formData);
      }
    } catch (error) {
      this._formErrors.set({ 
        submit: `Erreur: ${(error as Error).message}` 
      });
    } finally {
      this._isSubmitting.set(false);
    }
  }

  private async createNewSession(formData: SessionFormData): Promise<void> {
    if (!this.hasRequiredData()) {
      throw new Error('Données vidéo manquantes pour créer la session');
    }

    const result = await this.sessionFacade.createSession(
      formData.name,
      this.videoId!,
      this.videoTitle!,
      this.videoUrl!,
      this.videoDuration!
    );

    if (result.success) {
      // Update session with additional form data
      await this.sessionFacade.updateSession({
        description: formData.description || '',
        tags: formData.tags || []
      });
      
      this.save.emit(formData);
      this.resetForm();
    } else {
      throw new Error(result.error || 'Échec de la création de session');
    }
  }

  private async updateExistingSession(formData: SessionFormData): Promise<void> {
    if (!this.session) {
      throw new Error('Aucune session à modifier');
    }

    const result = await this.sessionFacade.updateSession({
      name: formData.name,
      description: formData.description || '',
      tags: formData.tags || []
    });

    if (result.success) {
      this.save.emit(formData);
    } else {
      throw new Error(result.error || 'Échec de la mise à jour');
    }
  }

  onCancel(): void {
    this.cancel.emit();
    this.resetForm();
  }

  // === FORM UTILITIES ===

  private getFormData(): SessionFormData {
    const formValue = this.sessionForm.value;
    
    return {
      name: formValue.name?.trim() || '',
      description: formValue.description?.trim() || undefined,
      tags: this.parseTags(formValue.tags || '')
    };
  }

  private parseTags(tagsString: string): string[] {
    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  private resetForm(): void {
    this.sessionForm.reset();
    this._formErrors.set({});
    this._isSubmitting.set(false);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.sessionForm.controls).forEach(key => {
      this.sessionForm.get(key)?.markAsTouched();
    });
    this.updateFormErrors();
  }

  // === TEMPLATE HELPERS ===

  getFieldError(fieldName: string): string | null {
    const errors = this._formErrors();
    return errors[fieldName] || null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.sessionForm.get(fieldName);
    return !!(control?.invalid && control?.touched);
  }

  getSubmitError(): string | null {
    const errors = this._formErrors();
    return errors['submit'] || null;
  }

  /**
   * Format duration in seconds to MM:SS or HH:MM:SS format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}