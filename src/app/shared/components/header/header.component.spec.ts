import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HeaderComponent } from './header.component';
import { ValidationService } from '../../../core/services/validation.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, ReactiveFormsModule],
      providers: [ValidationService]
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

  it('should render actions section with placeholder button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const actionsSection = compiled.querySelector('.header-actions');
    expect(actionsSection).toBeTruthy();
    
    const actionsPlaceholder = compiled.querySelector('.actions-placeholder');
    expect(actionsPlaceholder).toBeTruthy();
    
    const actionButton = compiled.querySelector('.action-button-mock');
    expect(actionButton).toBeTruthy();
    expect(actionButton?.textContent?.trim()).toBe('⚙️');
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
});
