import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HeaderComponent } from './header.component';
import { ValidationService } from '../../../core/services/validation.service';
import { ThemeService } from '../../../core/services/theme.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, ReactiveFormsModule],
      providers: [ValidationService, ThemeService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render header with correct structure', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Check main header element
    const header = compiled.querySelector('.app-header');
    expect(header).toBeTruthy();
    
    // Check header container
    const container = compiled.querySelector('.header-container');
    expect(container).toBeTruthy();
  });

  it('should render logo section with correct content', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const logoSection = compiled.querySelector('.header-logo');
    expect(logoSection).toBeTruthy();
    
    const logoText = compiled.querySelector('.logo-text');
    expect(logoText?.textContent?.trim()).toContain('YouTube Looper');
    
    const logoIcon = compiled.querySelector('.logo-icon');
    expect(logoIcon?.textContent?.trim()).toBe('🎸');
  });

  it('should render URL input form with all elements', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const inputSection = compiled.querySelector('.header-input');
    expect(inputSection).toBeTruthy();
    
    const urlForm = compiled.querySelector('.url-form');
    expect(urlForm).toBeTruthy();
    
    const inputContainer = compiled.querySelector('.input-container');
    expect(inputContainer).toBeTruthy();
    
    const urlInput = compiled.querySelector('.url-input') as HTMLInputElement;
    expect(urlInput).toBeTruthy();
    expect(urlInput.placeholder).toContain('Collez l\'URL de la vidéo YouTube ici...');
    
    const submitButton = compiled.querySelector('.submit-button');
    expect(submitButton).toBeTruthy();
  });

  it('should render actions section with theme toggle', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const actionsSection = compiled.querySelector('.header-actions');
    expect(actionsSection).toBeTruthy();
    
    const actionsContainer = compiled.querySelector('.actions-container');
    expect(actionsContainer).toBeTruthy();
    
    const themeToggle = compiled.querySelector('app-theme-toggle');
    expect(themeToggle).toBeTruthy();
  });

  it('should initialize with empty URL control', () => {
    expect(component.urlControl.value).toBe('');
    expect(component.urlControl.valid).toBe(false); // Required validator
  });

  it('should validate YouTube URLs correctly', () => {
    // Valid URLs
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'http://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ'
    ];

    validUrls.forEach(url => {
      component.urlControl.setValue(url);
      expect(component.urlControl.valid).toBe(true, `${url} should be valid`);
      expect(component.isUrlValid).toBe(true);
      expect(component.isUrlInvalid).toBe(false);
    });

    // Invalid URLs
    const invalidUrls = [
      'https://www.google.com',
      'not-a-url',
      'https://youtube.com/watch?v=invalid',
      'https://vimeo.com/123456789'
    ];

    invalidUrls.forEach(url => {
      component.urlControl.setValue(url);
      component.urlControl.markAsTouched(); // Trigger validation display
      expect(component.urlControl.valid).toBe(false, `${url} should be invalid`);
      expect(component.isUrlValid).toBe(false);
      expect(component.isUrlInvalid).toBe(true);
    });
  });

  it('should emit urlChange events with debounce', fakeAsync(() => {
    spyOn(component.urlChange, 'emit');

    // Set a valid URL
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Should not emit immediately due to debounce
    expect(component.urlChange.emit).not.toHaveBeenCalled();
    
    // After debounce time
    tick(300);
    expect(component.urlChange.emit).toHaveBeenCalledWith({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isValid: true,
      videoId: 'dQw4w9WgXcQ'
    });
  }));

  it('should emit urlSubmit events when form is submitted', () => {
    spyOn(component.urlSubmit, 'emit');
    
    // Set valid URL
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // Submit form
    component.onUrlSubmit();
    
    expect(component.urlSubmit.emit).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('should not submit invalid URLs', () => {
    spyOn(component.urlSubmit, 'emit');
    
    // Set invalid URL
    component.urlControl.setValue('invalid-url');
    
    // Try to submit
    component.onUrlSubmit();
    
    expect(component.urlSubmit.emit).not.toHaveBeenCalled();
  });

  it('should clear URL when clearUrl is called', () => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(component.urlControl.value).toBeTruthy();
    
    component.clearUrl();
    expect(component.urlControl.value).toBe('');
  });

  it('should show valid icon for valid URLs', () => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fixture.detectChanges();
    
    expect(component.showValidIcon).toBe(true);
    
    const compiled = fixture.nativeElement as HTMLElement;
    const validIcon = compiled.querySelector('.valid-icon');
    expect(validIcon).toBeTruthy();
    expect(validIcon?.textContent?.trim()).toBe('✓');
  });

  it('should show invalid icon and error message for invalid URLs', () => {
    component.urlControl.setValue('invalid-url');
    component.urlControl.markAsTouched();
    fixture.detectChanges();
    
    expect(component.isUrlInvalid).toBe(true);
    
    const compiled = fixture.nativeElement as HTMLElement;
    const invalidIcon = compiled.querySelector('.invalid-icon');
    expect(invalidIcon).toBeTruthy();
    
    const errorMessage = compiled.querySelector('.error-message');
    expect(errorMessage).toBeTruthy();
    expect(errorMessage?.textContent?.trim()).toContain('URL YouTube invalide');
  });

  it('should show clear button when URL has value', () => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const clearButton = compiled.querySelector('.clear-button');
    expect(clearButton).toBeTruthy();
  });

  it('should disable submit button for invalid URLs', () => {
    component.urlControl.setValue('invalid-url');
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('.submit-button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('should enable submit button for valid URLs', () => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('.submit-button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('should apply correct CSS classes based on validation state', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const urlInput = compiled.querySelector('.url-input') as HTMLInputElement;
    
    // Valid URL
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fixture.detectChanges();
    expect(urlInput.classList.contains('valid')).toBe(true);
    expect(urlInput.classList.contains('invalid')).toBe(false);
    
    // Invalid URL
    component.urlControl.setValue('invalid-url');
    component.urlControl.markAsTouched();
    fixture.detectChanges();
    expect(urlInput.classList.contains('valid')).toBe(false);
    expect(urlInput.classList.contains('invalid')).toBe(true);
  });

  it('should clean up subscriptions on destroy', () => {
    const destroySpy = spyOn(component['destroy$'], 'next');
    const completeSpy = spyOn(component['destroy$'], 'complete');
    
    component.ngOnDestroy();
    
    expect(destroySpy).toHaveBeenCalled();
    expect(completeSpy).toHaveBeenCalled();
  });

  it('should integrate theme toggle in actions section', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Verify theme toggle is positioned in actions
    const actionsSection = compiled.querySelector('.header-actions');
    const themeToggle = actionsSection?.querySelector('app-theme-toggle');
    expect(themeToggle).toBeTruthy();
  });

  it('should apply correct structural classes with theme integration', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Verify updated class structure
    expect(compiled.querySelector('.header-actions')).toBeTruthy();
    expect(compiled.querySelector('.actions-container')).toBeTruthy();
    expect(compiled.querySelector('app-theme-toggle')).toBeTruthy();
  });

  // Loading state tests
  it('should initialize with loading state false', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should show loading state during URL validation', fakeAsync(() => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    
    // After debounce but before delay completion
    tick(300);
    expect(component.isLoading()).toBe(true);
    
    // After validation delay
    tick(500);
    expect(component.isLoading()).toBe(false);
  }));

  it('should disable input during loading state', fakeAsync(() => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tick(300);
    
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const urlInput = compiled.querySelector('.url-input') as HTMLInputElement;
    
    expect(urlInput.disabled).toBe(true);
    expect(urlInput.classList.contains('loading')).toBe(true);
    
    tick(500);
    fixture.detectChanges();
    expect(urlInput.disabled).toBe(false);
    expect(urlInput.classList.contains('loading')).toBe(false);
  }));

  it('should show loading spinner during validation', fakeAsync(() => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tick(300);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const loadingSpinner = compiled.querySelector('.loading-spinner');
    const spinner = compiled.querySelector('.spinner');
    
    expect(loadingSpinner).toBeTruthy();
    expect(spinner).toBeTruthy();
    
    tick(500);
    fixture.detectChanges();
    expect(compiled.querySelector('.loading-spinner')).toBeFalsy();
  }));

  it('should disable submit button during loading', fakeAsync(() => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tick(300);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('.submit-button') as HTMLButtonElement;
    
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.classList.contains('loading')).toBe(true);
    
    tick(500);
    fixture.detectChanges();
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.classList.contains('loading')).toBe(false);
  }));

  it('should not submit during loading state', fakeAsync(() => {
    spyOn(component.urlSubmit, 'emit');
    
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tick(300); // Trigger loading state
    
    component.onUrlSubmit();
    expect(component.urlSubmit.emit).not.toHaveBeenCalled();
    
    tick(500); // Complete loading
    component.onUrlSubmit();
    expect(component.urlSubmit.emit).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }));

  // Error state tests
  it('should initialize with no error message', () => {
    expect(component.errorMessage()).toBeNull();
  });

  it('should display custom error message for invalid URLs', fakeAsync(() => {
    component.urlControl.setValue('invalid-url');
    tick(800); // debounce + delay
    fixture.detectChanges();
    
    expect(component.errorMessage()).toBe('URL YouTube invalide. Veuillez vérifier le format.');
    
    const compiled = fixture.nativeElement as HTMLElement;
    const errorMessage = compiled.querySelector('.error-message');
    expect(errorMessage?.textContent?.trim()).toBe('URL YouTube invalide. Veuillez vérifier le format.');
  }));

  it('should clear error message when clearing input', fakeAsync(() => {
    component.urlControl.setValue('invalid-url');
    tick(800);
    expect(component.errorMessage()).toBeTruthy();
    
    component.clearUrl();
    expect(component.errorMessage()).toBeNull();
  }));

  it('should clear error message when entering valid URL', fakeAsync(() => {
    component.urlControl.setValue('invalid-url');
    tick(800);
    expect(component.errorMessage()).toBeTruthy();
    
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    tick(800);
    expect(component.errorMessage()).toBeNull();
  }));

  it('should apply invalid class when error message is present', fakeAsync(() => {
    component.urlControl.setValue('invalid-url');
    tick(800);
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const urlInput = compiled.querySelector('.url-input') as HTMLInputElement;
    expect(urlInput.classList.contains('invalid')).toBe(true);
  }));

  it('should hide clear button during loading state', fakeAsync(() => {
    component.urlControl.setValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    fixture.detectChanges();
    
    // Initially clear button should be visible
    let compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.clear-button')).toBeTruthy();
    
    // During loading, clear button should be hidden
    tick(300);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.clear-button')).toBeFalsy();
    
    // After loading, clear button should be visible again
    tick(500);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.clear-button')).toBeTruthy();
  }));

  it('should clear loading and error states when clearing input', () => {
    component.isLoading.set(true);
    component.errorMessage.set('Some error');
    
    component.clearUrl();
    
    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });
});
