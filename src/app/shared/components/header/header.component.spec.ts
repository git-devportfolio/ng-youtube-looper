import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent]
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

  it('should render input placeholder section', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const inputSection = compiled.querySelector('.header-input');
    expect(inputSection).toBeTruthy();
    
    const inputPlaceholder = compiled.querySelector('.input-placeholder');
    expect(inputPlaceholder).toBeTruthy();
    
    const inputMock = compiled.querySelector('.url-input-mock');
    expect(inputMock).toBeTruthy();
    expect(inputMock?.getAttribute('placeholder')).toContain('Collez l\'URL de la vidéo YouTube ici...');
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

  it('should have disabled mock inputs and buttons', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    const inputMock = compiled.querySelector('.url-input-mock') as HTMLInputElement;
    expect(inputMock.disabled).toBe(true);
    
    const actionButton = compiled.querySelector('.action-button-mock') as HTMLButtonElement;
    expect(actionButton.disabled).toBe(true);
  });

  it('should apply correct CSS classes', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Verify main structural classes are present
    expect(compiled.querySelector('.app-header')).toBeTruthy();
    expect(compiled.querySelector('.header-container')).toBeTruthy();
    expect(compiled.querySelector('.header-logo')).toBeTruthy();
    expect(compiled.querySelector('.header-input')).toBeTruthy();
    expect(compiled.querySelector('.header-actions')).toBeTruthy();
  });
});
