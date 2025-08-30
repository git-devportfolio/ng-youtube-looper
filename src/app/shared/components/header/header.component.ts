import { Component, inject, OnInit, OnDestroy, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, delay, of } from 'rxjs';
import { takeUntil, switchMap, catchError } from 'rxjs/operators';
import { ValidationService } from '../../../core/services/validation.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ReactiveFormsModule, ThemeToggleComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly validationService = inject(ValidationService);
  private readonly destroy$ = new Subject<void>();

  // Form control for URL input with custom validator
  readonly urlControl = new FormControl('', [
    Validators.required,
    this.youTubeUrlValidator.bind(this)
  ]);

  // State signals
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Output events
  @Output() urlSubmit = new EventEmitter<string>();
  @Output() urlChange = new EventEmitter<{url: string, isValid: boolean, videoId: string | null}>();

  ngOnInit() {
    // Set up debounced validation and emit changes
    this.urlControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap(url => {
        const trimmedUrl = url?.trim() || '';
        
        // Clear previous error and set loading if URL is not empty
        if (trimmedUrl) {
          this.errorMessage.set(null);
          this.isLoading.set(true);
          
          // Simulate validation delay to show loading state
          return of(trimmedUrl).pipe(
            delay(500), // Simulate network delay
            catchError(() => {
              this.errorMessage.set('Erreur lors de la validation de l\'URL');
              this.isLoading.set(false);
              return of(trimmedUrl);
            })
          );
        } else {
          this.isLoading.set(false);
          this.errorMessage.set(null);
          return of(trimmedUrl);
        }
      })
    ).subscribe(url => {
      this.isLoading.set(false);
      
      const trimmedUrl = url?.trim() || '';
      const videoId = this.validationService.validateYouTubeUrl(trimmedUrl);
      const isValid = !!videoId;
      
      // Set error message if URL is invalid and not empty
      if (trimmedUrl && !isValid) {
        this.errorMessage.set('URL YouTube invalide. Veuillez vérifier le format.');
      } else {
        this.errorMessage.set(null);
      }
      
      this.urlChange.emit({
        url: trimmedUrl,
        isValid,
        videoId
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Custom validator for YouTube URLs
  private youTubeUrlValidator(control: any): {[key: string]: any} | null {
    if (!control.value) {
      return null; // Let required validator handle empty values
    }

    const videoId = this.validationService.validateYouTubeUrl(control.value.trim());
    return videoId ? null : { invalidYouTubeUrl: true };
  }

  // Handle URL submission
  onUrlSubmit(): void {
    if (this.urlControl.valid && this.urlControl.value?.trim() && !this.isLoading()) {
      this.urlSubmit.emit(this.urlControl.value.trim());
    }
  }

  // Clear the input
  clearUrl(): void {
    this.urlControl.setValue('');
    this.isLoading.set(false);
    this.errorMessage.set(null);
  }

  // Getters for template
  get isUrlValid(): boolean {
    return this.urlControl.valid;
  }

  get isUrlInvalid(): boolean {
    return this.urlControl.invalid && this.urlControl.touched;
  }

  get showValidIcon(): boolean {
    return this.urlControl.valid && !!this.urlControl.value?.trim();
  }
}
