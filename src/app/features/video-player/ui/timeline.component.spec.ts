import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineComponent } from './timeline.component';

describe('TimelineComponent', () => {
  let component: TimelineComponent;
  let fixture: ComponentFixture<TimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineComponent);
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
    expect(component.isLoading).toBe(false);
    expect(component.isPlaying).toBe(false);
    expect(component.loops).toEqual([]);
  });

  describe('currentTimePercentage', () => {
    it('should return 0 when duration is 0', () => {
      component.currentTime = 30;
      component.duration = 0;
      expect(component.currentTimePercentage).toBe(0);
    });

    it('should calculate correct percentage', () => {
      component.currentTime = 50;
      component.duration = 200;
      expect(component.currentTimePercentage).toBe(25);
    });

    it('should not exceed 100%', () => {
      component.currentTime = 150;
      component.duration = 100;
      expect(component.currentTimePercentage).toBe(100);
    });

    it('should handle edge cases', () => {
      component.currentTime = 100;
      component.duration = 100;
      expect(component.currentTimePercentage).toBe(100);

      component.currentTime = 0;
      component.duration = 100;
      expect(component.currentTimePercentage).toBe(0);
    });
  });

  describe('isReady', () => {
    it('should return false when loading', () => {
      component.isLoading = true;
      component.disabled = false;
      component.duration = 100;
      expect(component.isReady).toBe(false);
    });

    it('should return false when disabled', () => {
      component.isLoading = false;
      component.disabled = true;
      component.duration = 100;
      expect(component.isReady).toBe(false);
    });

    it('should return false when duration is 0', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 0;
      expect(component.isReady).toBe(false);
    });

    it('should return true when all conditions are met', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;
      expect(component.isReady).toBe(true);
    });
  });

  describe('indicatorClasses', () => {
    it('should return empty string for default state', () => {
      component.isPlaying = true;
      component.duration = 100;
      expect(component.indicatorClasses).toBe('');
    });

    it('should return "paused" when not playing and ready', () => {
      component.isPlaying = false;
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;
      expect(component.indicatorClasses).toBe('paused');
    });

    it('should not return "paused" when not ready', () => {
      component.isPlaying = false;
      component.duration = 0; // Not ready
      expect(component.indicatorClasses).toBe('');
    });
  });

  describe('getTimeAtPosition', () => {
    it('should calculate correct time for position percentage', () => {
      component.duration = 200;
      expect(component.getTimeAtPosition(0)).toBe(0);
      expect(component.getTimeAtPosition(50)).toBe(100);
      expect(component.getTimeAtPosition(100)).toBe(200);
    });

    it('should handle edge cases', () => {
      component.duration = 150;
      expect(component.getTimeAtPosition(33.33)).toBeCloseTo(50, 1);
    });
  });

  describe('getPositionForTime', () => {
    it('should calculate correct position percentage for time', () => {
      component.duration = 200;
      expect(component.getPositionForTime(0)).toBe(0);
      expect(component.getPositionForTime(100)).toBe(50);
      expect(component.getPositionForTime(200)).toBe(100);
    });

    it('should return 0 when duration is 0', () => {
      component.duration = 0;
      expect(component.getPositionForTime(50)).toBe(0);
    });

    it('should not exceed 100%', () => {
      component.duration = 100;
      expect(component.getPositionForTime(150)).toBe(100);
    });
  });

  describe('onTrackClick', () => {
    let mockEvent: jasmine.SpyObj<MouseEvent>;
    let mockElement: jasmine.SpyObj<HTMLElement>;

    beforeEach(() => {
      mockElement = jasmine.createSpyObj('HTMLElement', ['getBoundingClientRect']);
      mockElement.getBoundingClientRect.and.returnValue({
        left: 0,
        width: 200,
        top: 0,
        right: 200,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect);

      mockEvent = jasmine.createSpyObj('MouseEvent', [], {
        clientX: 100,
        currentTarget: mockElement
      });

      spyOn(component.seekTo, 'emit');
      spyOn(component.timelineClick, 'emit');
      spyOn(component.seekStart, 'emit');
      spyOn(component.seekEnd, 'emit');
    });

    it('should not emit when not ready', () => {
      component.isLoading = true;
      component.duration = 200;

      component.onTrackClick(mockEvent);

      expect(component.seekTo.emit).not.toHaveBeenCalled();
      expect(component.timelineClick.emit).not.toHaveBeenCalled();
      expect(component.seekStart.emit).not.toHaveBeenCalled();
    });

    it('should calculate correct time and emit events when ready', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 200;

      component.onTrackClick(mockEvent);

      // Click at x=100 on width=200 should be 50% = 100 seconds
      expect(component.seekTo.emit).toHaveBeenCalledWith(100);
      expect(component.timelineClick.emit).toHaveBeenCalledWith(100);
      expect(component.seekStart.emit).toHaveBeenCalled();
    });

    it('should handle click at start of timeline', () => {
      mockEvent = jasmine.createSpyObj('MouseEvent', [], {
        clientX: 0,
        currentTarget: mockElement
      });

      component.isLoading = false;
      component.disabled = false;
      component.duration = 200;

      component.onTrackClick(mockEvent);

      expect(component.seekTo.emit).toHaveBeenCalledWith(0);
      expect(component.timelineClick.emit).toHaveBeenCalledWith(0);
    });

    it('should handle click at end of timeline', () => {
      mockEvent = jasmine.createSpyObj('MouseEvent', [], {
        clientX: 200,
        currentTarget: mockElement
      });

      component.isLoading = false;
      component.disabled = false;
      component.duration = 200;

      component.onTrackClick(mockEvent);

      expect(component.seekTo.emit).toHaveBeenCalledWith(200);
      expect(component.timelineClick.emit).toHaveBeenCalledWith(200);
    });

    it('should constrain clicks outside timeline bounds', () => {
      // Test click beyond right edge
      mockEvent = jasmine.createSpyObj('MouseEvent', [], {
        clientX: 300, // Beyond width of 200
        currentTarget: mockElement
      });

      component.isLoading = false;
      component.disabled = false;
      component.duration = 200;

      component.onTrackClick(mockEvent);

      expect(component.seekTo.emit).toHaveBeenCalledWith(200); // Max value
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(component.formatDuration(0)).toBe('0:00');
      expect(component.formatDuration(30)).toBe('0:30');
      expect(component.formatDuration(60)).toBe('1:00');
      expect(component.formatDuration(90)).toBe('1:30');
      expect(component.formatDuration(3661)).toBe('61:01');
    });

    it('should handle invalid values', () => {
      expect(component.formatDuration(-5)).toBe('0:00');
      expect(component.formatDuration(NaN)).toBe('0:00');
    });

    it('should pad seconds correctly', () => {
      expect(component.formatDuration(65)).toBe('1:05');
      expect(component.formatDuration(125)).toBe('2:05');
    });
  });

  describe('Current Time Indicator Enhancement (Task 15.2)', () => {
    it('should apply indicator classes correctly', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      
      // Playing state - no special classes
      component.isPlaying = true;
      component.duration = 100;
      fixture.detectChanges();
      
      const indicator = compiled.querySelector('.current-time-indicator');
      expect(indicator?.classList.contains('paused')).toBe(false);
      expect(indicator?.classList.contains('seeking')).toBe(false);
    });

    it('should apply paused class when not playing and ready', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      
      component.isPlaying = false;
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;
      fixture.detectChanges();
      
      const indicator = compiled.querySelector('.current-time-indicator');
      expect(indicator?.classList.contains('paused')).toBe(true);
    });

    it('should set correct aria-label for accessibility', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      
      component.currentTime = 65; // 1:05
      fixture.detectChanges();
      
      const indicator = compiled.querySelector('.current-time-indicator');
      expect(indicator?.getAttribute('aria-label')).toBe('Position: 1:05');
    });

    it('should position indicator correctly with enhanced precision', () => {
      component.currentTime = 37.5;
      component.duration = 150;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.current-time-indicator') as HTMLElement;
      
      expect(indicator.style.left).toBe('25%'); // 37.5/150 = 0.25 = 25%
    });

    it('should emit seeking events when track is clicked', (done) => {
      spyOn(component.seekStart, 'emit');
      spyOn(component.seekEnd, 'emit');
      
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      const mockTrack = {
        getBoundingClientRect: () => ({
          left: 0,
          width: 200,
          top: 0,
          right: 200,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({})
        } as DOMRect)
      };

      const mockEvent = {
        clientX: 100,
        currentTarget: mockTrack
      } as any;

      component.onTrackClick(mockEvent);

      expect(component.seekStart.emit).toHaveBeenCalled();
      
      // Check seekEnd is called after timeout
      setTimeout(() => {
        expect(component.seekEnd.emit).toHaveBeenCalled();
        done();
      }, 250);
    });
  });

  describe('Template Integration', () => {
    it('should render timeline container with correct classes', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.timeline-container');
      
      expect(container).toBeTruthy();
      expect(container?.classList.contains('ready')).toBe(false); // duration is 0 by default
    });

    it('should apply loading class when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.timeline-container');
      
      expect(container?.classList.contains('loading')).toBe(true);
    });

    it('should apply disabled class when disabled', () => {
      component.disabled = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.timeline-container');
      
      expect(container?.classList.contains('disabled')).toBe(true);
    });

    it('should apply ready class when ready', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const container = compiled.querySelector('.timeline-container');
      
      expect(container?.classList.contains('ready')).toBe(true);
    });

    it('should render timeline track', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const track = compiled.querySelector('.timeline-track');
      const background = compiled.querySelector('.track-background');
      
      expect(track).toBeTruthy();
      expect(background).toBeTruthy();
    });

    it('should render current time indicator', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.current-time-indicator');
      const circle = compiled.querySelector('.indicator-circle');
      const line = compiled.querySelector('.indicator-line');
      
      expect(indicator).toBeTruthy();
      expect(circle).toBeTruthy();
      expect(line).toBeTruthy();
    });

    it('should position current time indicator correctly', () => {
      component.currentTime = 25;
      component.duration = 100;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const indicator = compiled.querySelector('.current-time-indicator') as HTMLElement;
      
      expect(indicator.style.left).toBe('25%');
    });

    it('should render timeline labels when ready', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 120; // 2 minutes
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const labels = compiled.querySelector('.timeline-labels');
      const startLabel = compiled.querySelector('.time-label.start');
      const endLabel = compiled.querySelector('.time-label.end');
      
      expect(labels).toBeTruthy();
      expect(startLabel?.textContent).toBe('0:00');
      expect(endLabel?.textContent).toBe('2:00');
    });

    it('should not render timeline labels when not ready', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const labels = compiled.querySelector('.timeline-labels');
      
      expect(labels).toBeFalsy();
    });

    it('should render loading state when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const loading = compiled.querySelector('.timeline-loading');
      const shimmer = compiled.querySelector('.loading-shimmer');
      
      expect(loading).toBeTruthy();
      expect(shimmer).toBeTruthy();
    });

    it('should render loop segments', () => {
      component.loops = [
        { id: 1, startTime: 10, endTime: 30 },
        { id: 2, startTime: 50, endTime: 80 }
      ];
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const segments = compiled.querySelectorAll('.loop-segment');
      
      expect(segments.length).toBe(2);
      expect(segments[0].getAttribute('data-loop-id')).toBe('1');
      expect(segments[1].getAttribute('data-loop-id')).toBe('2');
    });

    it('should set correct cursor style based on ready state', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const track = compiled.querySelector('.timeline-track') as HTMLElement;
      
      // Not ready by default (duration = 0)
      fixture.detectChanges();
      expect(track.style.cursor).toBe('default');

      // Ready state
      component.duration = 100;
      fixture.detectChanges();
      expect(track.style.cursor).toBe('pointer');
    });
  });

  describe('Event Handling', () => {
    it('should emit seekTo and timelineClick when track is clicked', () => {
      spyOn(component.seekTo, 'emit');
      spyOn(component.timelineClick, 'emit');
      
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const track = compiled.querySelector('.timeline-track') as HTMLElement;
      
      // Mock getBoundingClientRect
      spyOn(track, 'getBoundingClientRect').and.returnValue({
        left: 0,
        width: 200,
        top: 0,
        right: 200,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect);

      const clickEvent = new MouseEvent('click', { 
        clientX: 50, // 25% of width 200
        bubbles: true 
      });
      Object.defineProperty(clickEvent, 'currentTarget', {
        value: track,
        enumerable: true
      });

      track.dispatchEvent(clickEvent);

      expect(component.seekTo.emit).toHaveBeenCalledWith(25); // 25% of 100 duration
      expect(component.timelineClick.emit).toHaveBeenCalledWith(25);
    });
  });
});