import { Component, inject, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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

  // Output events
  @Output() urlSubmit = new EventEmitter<string>();
  @Output() urlChange = new EventEmitter<{url: string, isValid: boolean, videoId: string | null}>();

  ngOnInit() {
    // Set up debounced validation and emit changes
    this.urlControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(url => {
      const trimmedUrl = url?.trim() || '';
      const videoId = this.validationService.validateYouTubeUrl(trimmedUrl);
      const isValid = !!videoId;
      
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
    if (this.urlControl.valid && this.urlControl.value?.trim()) {
      this.urlSubmit.emit(this.urlControl.value.trim());
    }
  }

  // Clear the input
  clearUrl(): void {
    this.urlControl.setValue('');
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
