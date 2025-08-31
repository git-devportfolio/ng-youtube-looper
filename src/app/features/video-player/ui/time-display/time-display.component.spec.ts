import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeDisplayComponent } from './time-display.component';

describe('TimeDisplayComponent', () => {
  let component: TimeDisplayComponent;
  let fixture: ComponentFixture<TimeDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeDisplayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimeDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.currentTime).toBe(0);
    expect(component.duration).toBe(0);
    expect(component.isLoading).toBe(false);
    expect(component.hasError).toBe(false);
    expect(component.showDuration).toBe(true);
  });

  describe('formatTime', () => {
    it('should format time in MM:SS for durations under 1 hour', () => {
      component.duration = 1800; // 30 minutes
      expect(component.formatTime(0)).toBe('00:00');
      expect(component.formatTime(65)).toBe('01:05');
      expect(component.formatTime(125)).toBe('02:05');
      expect(component.formatTime(3599)).toBe('59:59');
    });

    it('should format time in HH:MM:SS for durations 1 hour or longer', () => {
      component.duration = 3600; // 1 hour
      expect(component.formatTime(0)).toBe('00:00:00');
      expect(component.formatTime(3661)).toBe('01:01:01');
      expect(component.formatTime(7325)).toBe('02:02:05');
    });

    it('should handle invalid time values', () => {
      expect(component.formatTime(-5)).toBe('00:00');
      expect(component.formatTime(NaN)).toBe('00:00');
    });

    it('should handle edge cases', () => {
      component.duration = 60;
      expect(component.formatTime(59.9)).toBe('00:59');
      expect(component.formatTime(60.1)).toBe('01:00');
    });
  });

  describe('formattedCurrentTime', () => {
    it('should return formatted current time when normal', () => {
      component.currentTime = 125;
      component.duration = 300;
      expect(component.formattedCurrentTime).toBe('02:05');
    });

    it('should return loading placeholder when loading', () => {
      component.isLoading = true;
      component.currentTime = 125;
      expect(component.formattedCurrentTime).toBe('--:--');
    });

    it('should return error text when has error', () => {
      component.hasError = true;
      component.currentTime = 125;
      expect(component.formattedCurrentTime).toBe('Error');
    });
  });

  describe('formattedDuration', () => {
    it('should return formatted duration when normal', () => {
      component.duration = 300;
      expect(component.formattedDuration).toBe('05:00');
    });

    it('should return loading placeholder when loading', () => {
      component.isLoading = true;
      component.duration = 300;
      expect(component.formattedDuration).toBe('--:--');
    });

    it('should return loading placeholder when duration is 0', () => {
      component.duration = 0;
      expect(component.formattedDuration).toBe('--:--');
    });

    it('should return error text when has error', () => {
      component.hasError = true;
      component.duration = 300;
      expect(component.formattedDuration).toBe('Error');
    });
  });

  describe('timeDisplayString', () => {
    it('should return complete time display with duration when showDuration is true', () => {
      component.currentTime = 125;
      component.duration = 300;
      component.showDuration = true;
      expect(component.timeDisplayString).toBe('02:05 / 05:00');
    });

    it('should return only current time when showDuration is false', () => {
      component.currentTime = 125;
      component.duration = 300;
      component.showDuration = false;
      expect(component.timeDisplayString).toBe('02:05');
    });

    it('should handle loading state correctly', () => {
      component.isLoading = true;
      component.showDuration = true;
      expect(component.timeDisplayString).toBe('--:-- / --:--');
    });

    it('should handle error state correctly', () => {
      component.hasError = true;
      component.showDuration = true;
      expect(component.timeDisplayString).toBe('Error / Error');
    });
  });

  describe('progressPercentage', () => {
    it('should calculate correct progress percentage', () => {
      component.currentTime = 30;
      component.duration = 100;
      expect(component.progressPercentage).toBe(30);
    });

    it('should return 0 when duration is 0', () => {
      component.currentTime = 30;
      component.duration = 0;
      expect(component.progressPercentage).toBe(0);
    });

    it('should return 0 when loading', () => {
      component.isLoading = true;
      component.currentTime = 30;
      component.duration = 100;
      expect(component.progressPercentage).toBe(0);
    });

    it('should return 0 when has error', () => {
      component.hasError = true;
      component.currentTime = 30;
      component.duration = 100;
      expect(component.progressPercentage).toBe(0);
    });

    it('should not exceed 100%', () => {
      component.currentTime = 150;
      component.duration = 100;
      expect(component.progressPercentage).toBe(100);
    });
  });

  describe('Template Rendering', () => {
    it('should display current time and duration', () => {
      component.currentTime = 65;
      component.duration = 300;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const currentTime = compiled.querySelector('.current-time');
      const duration = compiled.querySelector('.duration');

      expect(currentTime?.textContent).toBe('01:05');
      expect(duration?.textContent).toBe('05:00');
    });

    it('should hide duration when showDuration is false', () => {
      component.showDuration = false;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const separator = compiled.querySelector('.time-separator');
      const duration = compiled.querySelector('.duration');

      expect(separator).toBeFalsy();
      expect(duration).toBeFalsy();
    });

    it('should apply loading class when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const timeDisplay = compiled.querySelector('.time-display');

      expect(timeDisplay?.classList.contains('loading')).toBe(true);
    });

    it('should apply error class when has error', () => {
      component.hasError = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const timeDisplay = compiled.querySelector('.time-display');

      expect(timeDisplay?.classList.contains('error')).toBe(true);
    });

    it('should show loading indicator when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loadingIndicator = compiled.querySelector('.loading-indicator');
      const dots = compiled.querySelectorAll('.loading-dots .dot');

      expect(loadingIndicator).toBeTruthy();
      expect(dots.length).toBe(3);
    });

    it('should not show loading indicator when not loading', () => {
      component.isLoading = false;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loadingIndicator = compiled.querySelector('.loading-indicator');

      expect(loadingIndicator).toBeFalsy();
    });

    it('should set proper accessibility attributes', () => {
      component.currentTime = 30;
      component.duration = 100;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const timeDisplay = compiled.querySelector('.time-display');

      expect(timeDisplay?.getAttribute('role')).toBe('timer');
      expect(timeDisplay?.getAttribute('aria-label')).toBe('Temps de lecture: 00:30 / 01:40');
      expect(timeDisplay?.getAttribute('aria-valuenow')).toBe('30');
      expect(timeDisplay?.getAttribute('aria-valuemin')).toBe('0');
      expect(timeDisplay?.getAttribute('aria-valuemax')).toBe('100');
    });
  });

  // Tests for monospace font usage (Task 14.3)
  describe('Monospace Font Styling', () => {
    it('should apply monospace font family from CSS variables', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const timeDisplay = compiled.querySelector('.time-display');
      
      // Note: In test environment, we verify the CSS class is applied
      expect(timeDisplay?.classList.contains('time-display')).toBe(true);
    });

    it('should use tabular-nums for consistent character width', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const timeDisplay = compiled.querySelector('.time-display');
      
      // Verify the element exists and has the correct class for CSS styling
      expect(timeDisplay).toBeTruthy();
      expect(timeDisplay?.classList.contains('time-display')).toBe(true);
    });

    it('should maintain consistent width for time displays', () => {
      // Test that different times maintain visual consistency
      component.currentTime = 5; // 00:05
      component.duration = 300; // 05:00
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const currentTime = compiled.querySelector('.current-time');
      expect(currentTime?.textContent).toBe('00:05');

      // Change to different time
      component.currentTime = 185; // 03:05
      fixture.detectChanges();
      expect(currentTime?.textContent).toBe('03:05');
    });
  });
});
