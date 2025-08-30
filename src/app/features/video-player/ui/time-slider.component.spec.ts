import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeSliderComponent } from './time-slider.component';

describe('TimeSliderComponent', () => {
  let component: TimeSliderComponent;
  let fixture: ComponentFixture<TimeSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimeSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.currentTime).toBe(0);
    expect(component.duration).toBe(0);
    expect(component.disabled).toBe(false);
    expect(component.buffered).toBe(0);
  });

  it('should calculate progress percentage correctly', () => {
    component.currentTime = 30;
    component.duration = 100;
    expect(component.progressPercentage).toBe(30);

    component.currentTime = 0;
    expect(component.progressPercentage).toBe(0);

    component.duration = 0;
    expect(component.progressPercentage).toBe(0);
  });

  it('should calculate buffered percentage correctly', () => {
    component.buffered = 45;
    component.duration = 100;
    expect(component.bufferedPercentage).toBe(45);

    component.buffered = 0;
    expect(component.bufferedPercentage).toBe(0);

    component.duration = 0;
    expect(component.bufferedPercentage).toBe(0);
  });

  it('should not exceed 100% for progress percentage', () => {
    component.currentTime = 150;
    component.duration = 100;
    expect(component.progressPercentage).toBe(100);
  });

  it('should emit seekStart when onSeekStart is called and not disabled', () => {
    spyOn(component.seekStart, 'emit');
    
    component.disabled = false;
    component.onSeekStart();
    
    expect(component.seekStart.emit).toHaveBeenCalled();
  });

  it('should not emit seekStart when disabled', () => {
    spyOn(component.seekStart, 'emit');
    
    component.disabled = true;
    component.onSeekStart();
    
    expect(component.seekStart.emit).not.toHaveBeenCalled();
  });

  it('should emit seekEnd when onSeekEnd is called and was dragging', () => {
    spyOn(component.seekEnd, 'emit');
    
    component.disabled = false;
    component.onSeekStart(); // Start dragging
    component.onSeekEnd();
    
    expect(component.seekEnd.emit).toHaveBeenCalled();
  });

  it('should not emit seekEnd when not dragging', () => {
    spyOn(component.seekEnd, 'emit');
    
    component.disabled = false;
    component.onSeekEnd(); // Not dragging
    
    expect(component.seekEnd.emit).not.toHaveBeenCalled();
  });

  it('should emit seekTo with correct time when onSeek is called', () => {
    spyOn(component.seekTo, 'emit');
    
    component.disabled = false;
    component.duration = 100;
    
    const mockEvent = {
      target: { value: '50' }
    } as any;
    
    component.onSeek(mockEvent);
    
    expect(component.seekTo.emit).toHaveBeenCalledWith(50);
  });

  it('should not emit seekTo when disabled', () => {
    spyOn(component.seekTo, 'emit');
    
    component.disabled = true;
    component.duration = 100;
    
    const mockEvent = {
      target: { value: '50' }
    } as any;
    
    component.onSeek(mockEvent);
    
    expect(component.seekTo.emit).not.toHaveBeenCalled();
  });

  it('should emit seekTo when slider is clicked', () => {
    spyOn(component.seekTo, 'emit');
    
    component.disabled = false;
    component.duration = 100;
    
    const mockEvent = {
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, width: 100 })
      },
      clientX: 50
    } as any;
    
    component.onSliderClick(mockEvent);
    
    expect(component.seekTo.emit).toHaveBeenCalledWith(50);
  });

  it('should show loading state when disabled and duration is 0', () => {
    component.disabled = true;
    component.duration = 0;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const loadingElement = compiled.querySelector('.slider-loading');
    expect(loadingElement).toBeTruthy();
  });

  it('should not show loading state when not disabled', () => {
    component.disabled = false;
    component.duration = 0;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const loadingElement = compiled.querySelector('.slider-loading');
    expect(loadingElement).toBeFalsy();
  });

  it('should apply correct progress width styles', () => {
    component.currentTime = 25;
    component.duration = 100;
    component.buffered = 60;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const progressFill = compiled.querySelector('.progress-fill') as HTMLElement;
    const bufferedProgress = compiled.querySelector('.buffered-progress') as HTMLElement;
    
    expect(progressFill.style.width).toBe('25%');
    expect(bufferedProgress.style.width).toBe('60%');
  });

  it('should show visible thumb when not disabled and has duration', () => {
    component.disabled = false;
    component.duration = 100;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const thumb = compiled.querySelector('.slider-thumb');
    expect(thumb?.classList.contains('visible')).toBe(true);
  });

  it('should not show visible thumb when disabled', () => {
    component.disabled = true;
    component.duration = 100;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const thumb = compiled.querySelector('.slider-thumb');
    expect(thumb?.classList.contains('visible')).toBe(false);
  });

  it('should set proper accessibility attributes', () => {
    component.currentTime = 30;
    component.duration = 100;
    fixture.detectChanges();
    
    const compiled = fixture.nativeElement as HTMLElement;
    const slider = compiled.querySelector('.time-slider') as HTMLInputElement;
    
    expect(slider.getAttribute('aria-label')).toBe('Progression de la vidéo');
    expect(slider.getAttribute('aria-valuenow')).toBe('30');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
    expect(slider.getAttribute('aria-valuetext')).toBe('30 secondes sur 100 secondes');
  });

  // Tests for webkit styling and cross-browser support (Task 14.2)
  describe('WebKit Slider Styling', () => {
    it('should apply webkit-specific CSS classes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const slider = compiled.querySelector('.time-slider');
      expect(slider?.classList.contains('time-slider')).toBe(true);
    });

    it('should handle dragging state correctly', () => {
      component.onSeekStart();
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const slider = compiled.querySelector('.time-slider');
      expect(slider?.classList.contains('dragging')).toBe(true);
    });

    it('should remove dragging state on seek end', () => {
      component.onSeekStart();
      component.onSeekEnd();
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const slider = compiled.querySelector('.time-slider');
      expect(slider?.classList.contains('dragging')).toBe(false);
    });

    it('should disable slider when disabled prop is true', () => {
      component.disabled = true;
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const slider = compiled.querySelector('.time-slider') as HTMLInputElement;
      expect(slider.disabled).toBe(true);
    });
  });
});
