import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { LoopFormComponent, LoopFormResult, LoopFormData as ExistingLoopFormData } from '../loop-form';
import { LoopSegment, LoopFormData } from '@core/models/loop.model';

export interface LoopCreationModalData {
  mode: 'create' | 'edit';
  loop?: LoopSegment;
  currentTime?: number;
  videoDuration?: number;
  existingLoops?: LoopSegment[];
}

@Component({
  selector: 'app-loop-creation-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoopFormComponent
  ],
  templateUrl: './loop-creation-modal.component.html',
  styleUrl: './loop-creation-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoopCreationModalComponent implements OnInit, OnDestroy {
  // Input properties
  @Input() data: LoopCreationModalData = { mode: 'create' };
  @Input() isVisible = false;
  @Input() currentVideoTime = 0;
  @Input() videoDuration = 0;
  @Input() existingLoops: LoopSegment[] = [];

  // Output events
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<LoopFormData>();
  @Output() cancel = new EventEmitter<void>();
  @Output() previewSegment = new EventEmitter<{ startTime: number; endTime: number }>();
  @Output() getCurrentTime = new EventEmitter<void>();

  // Modal state management
  readonly isAnimating = signal(false);
  readonly showModal = signal(false);
  
  // Form state
  readonly isSubmitting = signal(false);
  readonly canSubmit = signal(true);
  readonly hasValidationErrors = signal(false);

  // Internal state
  private initialFocusedElement: HTMLElement | null = null;

  ngOnInit(): void {
    // Setup visibility effect
    effect(() => {
      if (this.isVisible) {
        this.openModal();
      } else {
        this.closeModal();
      }
    });

    // Form data initialization is handled by LoopFormComponent
  }

  ngOnDestroy(): void {
    // Restore focus when component is destroyed
    this.restoreFocus();
    
    // Ensure body scroll is re-enabled
    document.body.classList.remove('modal-open');
  }

  /**
   * Handle ESC key to close modal
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isVisible && !this.isAnimating()) {
      event.preventDefault();
      this.onCancel();
    }
  }

  /**
   * Handle focus trap within modal
   */
  @HostListener('keydown.tab', ['$event'])
  onTabKey(event: KeyboardEvent): void {
    if (this.isVisible) {
      this.handleFocusTrap(event);
    }
  }

  // Form data initialization is handled by LoopFormComponent

  /**
   * Open modal with animation
   */
  private openModal(): void {
    // Store currently focused element
    this.initialFocusedElement = document.activeElement as HTMLElement;
    
    // Prevent body scroll
    document.body.classList.add('modal-open');
    
    // Show modal and start animation
    this.showModal.set(true);
    this.isAnimating.set(true);
    
    // Focus first input after animation
    setTimeout(() => {
      this.isAnimating.set(false);
      this.focusFirstInput();
    }, 300);
  }

  /**
   * Close modal with animation
   */
  private closeModal(): void {
    this.isAnimating.set(true);
    
    setTimeout(() => {
      this.showModal.set(false);
      this.isAnimating.set(false);
      this.restoreFocus();
      document.body.classList.remove('modal-open');
    }, 300);
  }

  /**
   * Focus first input in the modal
   */
  private focusFirstInput(): void {
    requestAnimationFrame(() => {
      const firstInput = document.querySelector('.loop-creation-modal input, .loop-creation-modal select, .loop-creation-modal button') as HTMLElement;
      if (firstInput) {
        firstInput.focus();
      }
    });
  }

  /**
   * Restore focus to previously focused element
   */
  private restoreFocus(): void {
    if (this.initialFocusedElement && this.initialFocusedElement.focus) {
      this.initialFocusedElement.focus();
    }
  }

  /**
   * Handle focus trap within modal
   */
  private handleFocusTrap(event: KeyboardEvent): void {
    const modal = document.querySelector('.loop-creation-modal');
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab: moving backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: moving forwards  
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  // Event handlers

  /**
   * Handle backdrop click to close modal
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isAnimating()) {
      this.onCancel();
    }
  }

  /**
   * Handle form submission from existing LoopFormComponent
   */
  onFormSubmit(formResult: LoopFormResult): void {
    if (!this.isSubmitting() && this.canSubmit()) {
      this.isSubmitting.set(true);
      const adaptedData = this.adaptExistingFormDataToNew(formResult);
      this.save.emit(adaptedData);
    }
  }

  /**
   * Handle form submission with new LoopFormData interface (for future use)
   */
  onNewFormSubmit(formData: LoopFormData): void {
    if (!this.isSubmitting() && this.canSubmit()) {
      this.isSubmitting.set(true);
      this.save.emit(formData);
    }
  }

  /**
   * Handle form cancellation
   */
  onCancel(): void {
    if (!this.isAnimating() && !this.isSubmitting()) {
      this.cancel.emit();
      this.close.emit();
    }
  }

  /**
   * Handle form validation changes
   */
  onFormValidationChange(isValid: boolean): void {
    this.canSubmit.set(isValid && !this.isSubmitting());
    this.hasValidationErrors.set(!isValid);
  }

  /**
   * Reset submission state (to be called after save completion)
   */
  resetSubmissionState(): void {
    this.isSubmitting.set(false);
    this.canSubmit.set(true);
    this.hasValidationErrors.set(false);
  }

  /**
   * Set validation error state (to be called by parent when validation fails)
   */
  setValidationErrorState(hasErrors: boolean): void {
    this.hasValidationErrors.set(hasErrors);
    this.canSubmit.set(!hasErrors && !this.isSubmitting());
  }

  /**
   * Check if modal actions should be disabled
   */
  get areActionsDisabled(): boolean {
    return this.isSubmitting() || this.isAnimating();
  }

  /**
   * Check if close button should be disabled
   */
  get isCloseDisabled(): boolean {
    return this.isSubmitting();
  }

  /**
   * Get modal container classes
   */
  getModalContainerClasses(): string {
    const classes: string[] = ['loop-creation-modal-container'];
    
    if (this.showModal()) {
      classes.push('visible');
    }
    
    if (this.isAnimating()) {
      classes.push('animating');
    }
    
    return classes.join(' ');
  }

  /**
   * Get modal classes
   */
  getModalClasses(): string {
    const classes: string[] = ['loop-creation-modal'];
    
    if (this.data.mode === 'edit') {
      classes.push('edit-mode');
    } else {
      classes.push('create-mode');
    }
    
    if (this.isSubmitting()) {
      classes.push('submitting');
    }
    
    if (this.hasValidationErrors()) {
      classes.push('has-validation-errors');
    }
    
    return classes.join(' ');
  }

  /**
   * Get modal title based on mode
   */
  get modalTitle(): string {
    return this.data.mode === 'edit' ? 'Modifier la boucle' : 'Créer une nouvelle boucle';
  }

  // Form button states are handled internally by LoopFormComponent

  // Adapter methods between existing and new form interfaces

  /**
   * Convert existing form result to new LoopFormData interface
   */
  private adaptExistingFormDataToNew(formResult: LoopFormResult): LoopFormData {
    const existingData = formResult.data;
    
    // Convert time strings to seconds
    const startTime = this.parseTimeString(existingData.startTimeText || '0:00');
    const endTime = this.parseTimeString(existingData.endTimeText || '0:30');
    
    return {
      name: existingData.name,
      startTime: startTime,
      endTime: endTime,
      color: existingData.color,
      repetitions: existingData.repeatCount
    };
  }

  /**
   * Convert time string (MM:SS format) to seconds
   */
  private parseTimeString(timeText: string): number {
    if (!timeText) return 0;
    
    const timePattern = /^(\d{1,2}):([0-5]?\d)(\.\d{1,3})?$/;
    const match = timeText.match(timePattern);
    
    if (!match) return 0;
    
    const [, minutes, seconds, decimals] = match;
    return parseInt(minutes) * 60 + parseFloat(seconds + (decimals || ''));
  }

  /**
   * Convert seconds to time string (MM:SS format)
   */
  private formatTimeToString(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const wholeSeconds = Math.floor(remainingSeconds);
    const decimals = remainingSeconds - wholeSeconds;
    
    let result = `${minutes}:${wholeSeconds.toString().padStart(2, '0')}`;
    if (decimals > 0) {
      result += decimals.toFixed(3).substring(1); // Remove the "0." prefix
    }
    
    return result;
  }

  /**
   * Format time in MM:SS format for display
   */
  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
