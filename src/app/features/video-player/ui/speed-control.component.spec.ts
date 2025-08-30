import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { SpeedControlComponent } from './speed-control.component';

describe('SpeedControlComponent', () => {
  let component: SpeedControlComponent;
  let fixture: ComponentFixture<SpeedControlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeedControlComponent, ReactiveFormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(SpeedControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.currentRate).toBe(1);
    expect(component.disabled).toBe(false);
  });

  it('should initialize manual speed control with correct validators', () => {
    expect(component.manualSpeedControl.value).toBe(1);
    expect(component.manualSpeedControl.hasError('required')).toBe(false);
    expect(component.manualSpeedControl.hasError('min')).toBe(false);
    expect(component.manualSpeedControl.hasError('max')).toBe(false);
  });

  it('should validate manual speed control correctly', () => {
    // Test minimum value
    component.manualSpeedControl.setValue(0.1);
    expect(component.manualSpeedControl.hasError('min')).toBe(true);

    // Test maximum value
    component.manualSpeedControl.setValue(3);
    expect(component.manualSpeedControl.hasError('max')).toBe(true);

    // Test valid value
    component.manualSpeedControl.setValue(1.5);
    expect(component.manualSpeedControl.valid).toBe(true);
  });

  it('should calculate canIncrease correctly', () => {
    component.currentRate = 1;
    expect(component.canIncrease).toBe(true);

    component.currentRate = 2;
    expect(component.canIncrease).toBe(false);

    component.currentRate = 1.5;
    expect(component.canIncrease).toBe(true);
  });

  it('should calculate canDecrease correctly', () => {
    component.currentRate = 1;
    expect(component.canDecrease).toBe(true);

    component.currentRate = 0.25;
    expect(component.canDecrease).toBe(false);

    component.currentRate = 0.5;
    expect(component.canDecrease).toBe(true);
  });

  it('should emit rateChange when preset speed is set', () => {
    spyOn(component.rateChange, 'emit');
    
    component.setPresetSpeed(1.5);
    
    expect(component.rateChange.emit).toHaveBeenCalledWith(1.5);
  });

  it('should not emit rateChange when disabled', () => {
    spyOn(component.rateChange, 'emit');
    
    component.disabled = true;
    component.setPresetSpeed(1.5);
    
    expect(component.rateChange.emit).not.toHaveBeenCalled();
  });

  it('should toggle manual input visibility', () => {
    expect(component.showManualInput).toBe(false);
    
    component.toggleManualInput();
    expect(component.showManualInput).toBe(true);
    expect(component.manualSpeedControl.value).toBe(component.currentRate);
    
    component.toggleManualInput();
    expect(component.showManualInput).toBe(false);
  });

  it('should apply manual speed when valid', () => {
    spyOn(component.rateChange, 'emit');
    
    component.showManualInput = true;
    component.manualSpeedControl.setValue(1.75);
    
    component.applyManualSpeed();
    
    expect(component.rateChange.emit).toHaveBeenCalledWith(1.75);
    expect(component.showManualInput).toBe(false);
  });

  it('should not apply manual speed when invalid', () => {
    spyOn(component.rateChange, 'emit');
    
    component.showManualInput = true;
    component.manualSpeedControl.setValue(0.1); // Invalid value
    
    component.applyManualSpeed();
    
    expect(component.rateChange.emit).not.toHaveBeenCalled();
    expect(component.showManualInput).toBe(true);
  });

  it('should display current speed correctly', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    component.currentRate = 1.5;
    fixture.detectChanges();
    
    const currentSpeed = compiled.querySelector('.current-speed');
    expect(currentSpeed?.textContent).toBe('1.5x');
  });

  it('should highlight active preset', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    component.currentRate = 1.25;
    fixture.detectChanges();
    
    const activePreset = compiled.querySelector('.speed-preset.active');
    
    expect(activePreset?.textContent?.trim()).toBe('1.25x');
  });

  it('should disable all controls when disabled', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    component.disabled = true;
    fixture.detectChanges();
    
    const presets = compiled.querySelectorAll('.speed-preset') as NodeListOf<HTMLButtonElement>;
    const speedButtons = compiled.querySelectorAll('.speed-button') as NodeListOf<HTMLButtonElement>;
    const toggleButton = compiled.querySelector('.toggle-manual') as HTMLButtonElement;
    
    presets.forEach(button => expect(button.disabled).toBe(true));
    speedButtons.forEach(button => expect(button.disabled).toBe(true));
    expect(toggleButton.disabled).toBe(true);
  });

  it('should disable increase/decrease buttons when at limits', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Test at maximum speed
    component.currentRate = 2;
    fixture.detectChanges();
    
    const increaseButton = compiled.querySelector('.speed-button.increase') as HTMLButtonElement;
    expect(increaseButton.disabled).toBe(true);
    
    // Test at minimum speed
    component.currentRate = 0.25;
    fixture.detectChanges();
    
    const decreaseButton = compiled.querySelector('.speed-button.decrease') as HTMLButtonElement;
    expect(decreaseButton.disabled).toBe(true);
  });

  it('should emit increaseSpeed and decreaseSpeed events', () => {
    spyOn(component.increaseSpeed, 'emit');
    spyOn(component.decreaseSpeed, 'emit');
    
    const compiled = fixture.nativeElement as HTMLElement;
    
    const increaseButton = compiled.querySelector('.speed-button.increase') as HTMLButtonElement;
    const decreaseButton = compiled.querySelector('.speed-button.decrease') as HTMLButtonElement;
    
    increaseButton.click();
    decreaseButton.click();
    
    expect(component.increaseSpeed.emit).toHaveBeenCalled();
    expect(component.decreaseSpeed.emit).toHaveBeenCalled();
  });

  it('should show/hide manual input based on showManualInput', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Initially hidden
    expect(compiled.querySelector('.manual-input')).toBeNull();
    
    // Show manual input
    component.showManualInput = true;
    fixture.detectChanges();
    
    expect(compiled.querySelector('.manual-input')).toBeTruthy();
    expect(compiled.querySelector('.speed-input')).toBeTruthy();
  });
});