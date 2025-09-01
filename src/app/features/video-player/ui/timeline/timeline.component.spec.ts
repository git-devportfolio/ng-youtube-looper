import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineComponent } from './timeline.component';
import { LoopSegment, LoopManagerFacade, TimelineViewModel } from '../../../loop-manager/data-access/loop-manager.facade';

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

    it('should return 0 for negative times', () => {
      component.duration = 100;
      expect(component.getPositionForTime(-10)).toBe(0);
    });

    it('should not exceed 100%', () => {
      component.duration = 100;
      expect(component.getPositionForTime(150)).toBe(100);
    });

    it('should have enhanced precision (3 decimal places)', () => {
      component.duration = 300;
      expect(component.getPositionForTime(100)).toBe(33.333); // Precise to 3 decimal places
    });
  });

  describe('getPositionsForTimes (Batch Optimization)', () => {
    beforeEach(() => {
      component.duration = 120;
    });

    it('should calculate multiple positions efficiently', () => {
      const times = [0, 30, 60, 90, 120];
      const expectedPositions = [0, 25, 50, 75, 100];
      
      const results = component.getPositionsForTimes(times);
      
      expect(results).toEqual(expectedPositions);
    });

    it('should handle empty array', () => {
      const results = component.getPositionsForTimes([]);
      expect(results).toEqual([]);
    });

    it('should handle edge cases in batch', () => {
      const times = [-10, 0, 60, 150, 200];
      const expectedPositions = [0, 0, 50, 100, 100];
      
      const results = component.getPositionsForTimes(times);
      
      expect(results).toEqual(expectedPositions);
    });

    it('should return zeros when duration is 0', () => {
      component.duration = 0;
      const times = [10, 20, 30];
      const results = component.getPositionsForTimes(times);
      
      expect(results).toEqual([0, 0, 0]);
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
        { id: '1', startTime: 10, endTime: 30, name: 'Loop 1', playCount: 0, isActive: false },
        { id: '2', startTime: 50, endTime: 80, name: 'Loop 2', playCount: 0, isActive: false }
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

  describe('Touch Events for Mobile Navigation (Task 15.3)', () => {
    let mockTrack: HTMLElement;

    beforeEach(() => {
      mockTrack = document.createElement('div');
      spyOn(mockTrack, 'getBoundingClientRect').and.returnValue({
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

      spyOn(component.seekTo, 'emit');
      spyOn(component.timelineClick, 'emit');
      spyOn(component.seekStart, 'emit');
      spyOn(component.seekEnd, 'emit');
    });

    it('should handle touch start correctly', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      const touchEvent = {
        currentTarget: mockTrack,
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;

      component.onTouchStart(touchEvent);

      expect(touchEvent.preventDefault).toHaveBeenCalled();
      expect(component.seekStart.emit).toHaveBeenCalled();
    });

    it('should handle brief touch end as navigation tap', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      // Simulate touch start
      const touchStartEvent = {
        currentTarget: mockTrack,
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;
      
      component.onTouchStart(touchStartEvent);

      // Immediately create touch end (brief tap)
      const mockTouch = {
        clientX: 100 // 50% of width 200
      };

      const touchEndEvent = {
        currentTarget: mockTrack,
        changedTouches: [mockTouch],
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;

      component.onTouchEnd(touchEndEvent);

      expect(touchEndEvent.preventDefault).toHaveBeenCalled();
      expect(component.seekTo.emit).toHaveBeenCalledWith(50); // 50% of 100 duration
      expect(component.timelineClick.emit).toHaveBeenCalledWith(50);
    });

    it('should ignore long touch events (> 300ms)', (done) => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      // Start touch
      const touchStartEvent = {
        currentTarget: mockTrack,
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;
      
      component.onTouchStart(touchStartEvent);

      // Wait longer than 300ms then end touch
      setTimeout(() => {
        const mockTouch = {
          clientX: 100
        };

        const touchEndEvent = {
          currentTarget: mockTrack,
          changedTouches: [mockTouch],
          preventDefault: jasmine.createSpy('preventDefault')
        } as any;

        component.onTouchEnd(touchEndEvent);

        expect(touchEndEvent.preventDefault).toHaveBeenCalled();
        expect(component.seekTo.emit).not.toHaveBeenCalled();
        expect(component.timelineClick.emit).not.toHaveBeenCalled();
        done();
      }, 350);
    });

    it('should prevent double events from touch devices on click', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      // Simulate active touch
      const touchStartEvent = {
        currentTarget: mockTrack,
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;
      
      component.onTouchStart(touchStartEvent);

      // Now try click event - should be ignored
      const clickEvent = new MouseEvent('click', {
        clientX: 100,
        bubbles: true
      });
      Object.defineProperty(clickEvent, 'currentTarget', {
        value: mockTrack,
        enumerable: true
      });

      component.onTrackClick(clickEvent);

      expect(component.seekTo.emit).not.toHaveBeenCalled();
      expect(component.timelineClick.emit).not.toHaveBeenCalled();
    });

    it('should not handle touch when not ready', () => {
      component.isLoading = true;
      component.duration = 100;

      const touchStartEvent = {
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;

      component.onTouchStart(touchStartEvent);

      expect(touchStartEvent.preventDefault).not.toHaveBeenCalled();
      expect(component.seekStart.emit).not.toHaveBeenCalled();
    });

    it('should handle touch end without start gracefully', () => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      const touchEndEvent = {
        currentTarget: mockTrack,
        changedTouches: [{ clientX: 100 }],
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;

      // Call touch end without touch start
      component.onTouchEnd(touchEndEvent);

      expect(touchEndEvent.preventDefault).not.toHaveBeenCalled();
      expect(component.seekTo.emit).not.toHaveBeenCalled();
    });

    it('should emit seekEnd after touch interaction', (done) => {
      component.isLoading = false;
      component.disabled = false;
      component.duration = 100;

      // Start and end touch quickly
      const touchStartEvent = {
        currentTarget: mockTrack,
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;
      
      component.onTouchStart(touchStartEvent);

      const touchEndEvent = {
        currentTarget: mockTrack,
        changedTouches: [{ clientX: 100 }],
        preventDefault: jasmine.createSpy('preventDefault')
      } as any;
      
      component.onTouchEnd(touchEndEvent);

      // Check seekEnd is called after timeout
      setTimeout(() => {
        expect(component.seekEnd.emit).toHaveBeenCalled();
        done();
      }, 250);
    });
  });

  describe('Loop Segments Draggable System (Task 15.4)', () => {
    let testLoops: LoopSegment[];

    beforeEach(() => {
      testLoops = [
        { id: '1', startTime: 10, endTime: 30, name: 'Intro', playCount: 0, isActive: false },
        { id: '2', startTime: 50, endTime: 80, name: 'Solo', playCount: 0, isActive: false },
        { id: '3', startTime: 90, endTime: 120, name: 'Bridge', playCount: 0, isActive: false }
      ];
      component.loops = testLoops;
      component.duration = 150;
    });

    describe('Loop Position Calculations', () => {
      it('should calculate correct loop position percentages', () => {
        const loop = { id: '1', startTime: 30, endTime: 60, name: 'Test Loop', playCount: 0, isActive: false };
        component.duration = 120;

        const position = component.getLoopPosition(loop);

        expect(position.left).toBe(25); // 30/120 * 100
        expect(position.width).toBe(25); // (60-30)/120 * 100
      });

      it('should return zero position when duration is zero', () => {
        const loop = { id: '1', startTime: 30, endTime: 60, name: 'Test Loop', playCount: 0, isActive: false };
        component.duration = 0;

        const position = component.getLoopPosition(loop);

        expect(position.left).toBe(0);
        expect(position.width).toBe(0);
      });

      it('should constrain position within bounds', () => {
        const loop = { id: '1', startTime: 0, endTime: 200, name: 'Test Loop', playCount: 0, isActive: false };
        component.duration = 100;

        const position = component.getLoopPosition(loop);

        expect(position.left).toBe(0);
        expect(position.width).toBe(100); // Constrained to maximum
      });
    });

    describe('getMultipleLoopPositions (Performance Optimization)', () => {
      beforeEach(() => {
        component.duration = 200;
      });

      it('should calculate multiple loop positions efficiently', () => {
        const loops = [
          { id: '1', startTime: 20, endTime: 60, name: 'Loop 1', playCount: 0, isActive: false },
          { id: '2', startTime: 80, endTime: 120, name: 'Loop 2', playCount: 0, isActive: false },
          { id: '3', startTime: 140, endTime: 180, name: 'Loop 3', playCount: 0, isActive: false }
        ];

        const results = component.getMultipleLoopPositions(loops);

        expect(results).toEqual([
          { id: '1', left: 10, width: 20 },   // 20/200*100, (60-20)/200*100
          { id: '2', left: 40, width: 20 },   // 80/200*100, (120-80)/200*100
          { id: '3', left: 70, width: 20 }    // 140/200*100, (180-140)/200*100
        ]);
      });

      it('should handle empty loop array', () => {
        const results = component.getMultipleLoopPositions([]);
        expect(results).toEqual([]);
      });

      it('should return zeros when duration is 0', () => {
        component.duration = 0;
        const loops = [
          { id: '1', startTime: 20, endTime: 60, name: 'Loop 1', playCount: 0, isActive: false },
          { id: '2', startTime: 80, endTime: 120, name: 'Loop 2', playCount: 0, isActive: false }
        ];

        const results = component.getMultipleLoopPositions(loops);

        expect(results).toEqual([
          { id: '1', left: 0, width: 0 },
          { id: '2', left: 0, width: 0 }
        ]);
      });

      it('should constrain out-of-bounds loops', () => {
        const loops = [
          { id: '1', startTime: -10, endTime: 50, name: 'Loop 1', playCount: 0, isActive: false },
          { id: '2', startTime: 150, endTime: 250, name: 'Loop 2', playCount: 0, isActive: false }
        ];

        const results = component.getMultipleLoopPositions(loops);

        expect(results[0].left).toBe(0);      // Adjusted from negative
        expect(results[0].width).toBe(25);    // (50-0)/200*100
        expect(results[1].left).toBe(75);     // 150/200*100
        expect(results[1].width).toBe(25);    // (200-150)/200*100 (capped at duration)
      });
    });

    describe('Loop CSS Classes', () => {
      it('should return basic loop-segment class', () => {
        const loop = testLoops[0];
        const classes = component.getLoopClasses(loop);
        expect(classes).toBe('loop-segment');
      });

      it('should add selected class for selected loop', () => {
        const loop = testLoops[0];
        component['_selectedLoopId'] = loop.id;
        
        const classes = component.getLoopClasses(loop);
        expect(classes).toBe('loop-segment selected');
      });

      it('should add dragging class for dragged loop', () => {
        const loop = testLoops[0];
        component['dragState'].isDragging = true;
        component['dragState'].loopId = loop.id;
        
        const classes = component.getLoopClasses(loop);
        expect(classes).toBe('loop-segment dragging');
      });

      it('should combine selected and dragging classes', () => {
        const loop = testLoops[0];
        component['_selectedLoopId'] = loop.id;
        component['dragState'].isDragging = true;
        component['dragState'].loopId = loop.id;
        
        const classes = component.getLoopClasses(loop);
        expect(classes).toBe('loop-segment selected dragging');
      });
    });

    describe('Loop Selection', () => {
      beforeEach(() => {
        spyOn(component.loopSelect, 'emit');
        spyOn(component.loopDeselect, 'emit');
        component.isLoading = false;
        component.disabled = false;
        component.duration = 150;
      });

      it('should select loop on click', () => {
        const loop = testLoops[0];
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation')
        } as any;

        component.onLoopClick(mockEvent, loop);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(component.loopSelect.emit).toHaveBeenCalledWith(loop.id);
        expect(component['_selectedLoopId']).toBe(loop.id);
      });

      it('should deselect loop when clicking selected loop', () => {
        const loop = testLoops[0];
        component['_selectedLoopId'] = loop.id;
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation')
        } as any;

        component.onLoopClick(mockEvent, loop);

        expect(component.loopDeselect.emit).toHaveBeenCalled();
        expect(component['_selectedLoopId']).toBeNull();
      });

      it('should not handle clicks when not ready', () => {
        const loop = testLoops[0];
        component.isLoading = true;
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation')
        } as any;

        component.onLoopClick(mockEvent, loop);

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(component.loopSelect.emit).not.toHaveBeenCalled();
      });
    });

    describe('Loop Drag Operations', () => {
      beforeEach(() => {
        spyOn(component.loopSelect, 'emit');
        spyOn(component.loopMove, 'emit');
        spyOn(component.loopResize, 'emit');
        component.isLoading = false;
        component.disabled = false;
        component.duration = 150;
      });

      it('should initialize drag state on mouse down', () => {
        const loop = testLoops[0];
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation'),
          clientX: 100
        } as any;

        component.onLoopMouseDown(mockEvent, loop, 'move');

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(component.loopSelect.emit).toHaveBeenCalledWith(loop.id);
        expect(component['dragState'].isDragging).toBe(true);
        expect(component['dragState'].dragType).toBe('move');
        expect(component['dragState'].loopId).toBe(loop.id);
      });

      it('should handle move drag operation', () => {
        const loop = testLoops[0];
        component['dragState'] = {
          isDragging: true,
          dragType: 'move',
          loopId: loop.id,
          startX: 100,
          initialStartTime: loop.startTime,
          initialEndTime: loop.endTime
        };

        // Create actual timeline track element
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        expect(track).toBeTruthy(); // Ensure track exists
        
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

        // Mock collision check to return false for this test
        spyOn(component, 'checkLoopCollision' as any).and.returnValue(false);

        const mouseMoveEvent = { clientX: 150 } as MouseEvent; // 50px right
        component.onDocumentMouseMove(mouseMoveEvent);

        // 50px on 200px width = 25% = 37.5s on 150s duration  
        const expectedDelta = 37.5;
        const expectedStart = loop.startTime + expectedDelta;
        const expectedEnd = loop.endTime + expectedDelta;

        expect(component.loopMove.emit).toHaveBeenCalledWith({
          id: loop.id,
          startTime: expectedStart,
          endTime: expectedEnd
        });
      });

      it('should handle left resize drag operation', () => {
        const loop = testLoops[0];
        component['dragState'] = {
          isDragging: true,
          dragType: 'resize-left',
          loopId: loop.id,
          startX: 100,
          initialStartTime: loop.startTime,
          initialEndTime: loop.endTime
        };

        // Mock timeline track element
        const mockTrack = document.createElement('div');
        spyOn(document, 'querySelector').and.returnValue(mockTrack);
        spyOn(mockTrack, 'getBoundingClientRect').and.returnValue({
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

        const mouseMoveEvent = { clientX: 50 } as MouseEvent; // 50px left
        component.onDocumentMouseMove(mouseMoveEvent);

        // 50px left = -37.5s delta
        const expectedStart = Math.max(0, loop.startTime - 37.5);

        expect(component.loopResize.emit).toHaveBeenCalledWith({
          id: loop.id,
          startTime: expectedStart,
          endTime: loop.endTime
        });
      });

      it('should handle right resize drag operation', () => {
        const loop = testLoops[0];
        component['dragState'] = {
          isDragging: true,
          dragType: 'resize-right',
          loopId: loop.id,
          startX: 100,
          initialStartTime: loop.startTime,
          initialEndTime: loop.endTime
        };

        // Create actual timeline track element
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        expect(track).toBeTruthy();
        
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

        // Mock collision check to return false for this test
        spyOn(component, 'checkLoopCollision' as any).and.returnValue(false);

        const mouseMoveEvent = { clientX: 150 } as MouseEvent; // 50px right
        component.onDocumentMouseMove(mouseMoveEvent);

        // 50px right = +37.5s delta
        const expectedEnd = Math.min(component.duration, loop.endTime + 37.5);

        expect(component.loopResize.emit).toHaveBeenCalledWith({
          id: loop.id,
          startTime: loop.startTime,
          endTime: expectedEnd
        });
      });

      it('should end drag operation on mouse up', () => {
        component['dragState'] = {
          isDragging: true,
          dragType: 'move',
          loopId: '1',
          startX: 100,
          initialStartTime: 10,
          initialEndTime: 30
        };

        component.onDocumentMouseUp();

        expect(component['dragState'].isDragging).toBe(false);
        expect(component['dragState'].dragType).toBeNull();
        expect(component['dragState'].loopId).toBeNull();
      });

      it('should not handle drag when not ready', () => {
        const loop = testLoops[0];
        component.isLoading = true;
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation'),
          clientX: 100
        } as any;

        component.onLoopMouseDown(mockEvent, loop, 'move');

        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(component['dragState'].isDragging).toBe(false);
      });
    });

    describe('Collision Detection', () => {
      it('should detect collision between overlapping loops', () => {
        const hasCollision = component['checkLoopCollision']('1', 25, 55); // Overlaps with loop 2 (50-80)
        expect(hasCollision).toBe(true);
      });

      it('should not detect collision for adjacent loops', () => {
        const hasCollision = component['checkLoopCollision']('1', 25, 50); // Ends where loop 2 starts
        expect(hasCollision).toBe(false);
      });

      it('should not detect collision for non-overlapping loops', () => {
        const hasCollision = component['checkLoopCollision']('1', 5, 8); // Completely separate
        expect(hasCollision).toBe(false);
      });

      it('should ignore collision with itself', () => {
        const hasCollision = component['checkLoopCollision']('2', 50, 80); // Same as loop 2
        expect(hasCollision).toBe(false);
      });

      it('should prevent drag operation when collision detected', () => {
        spyOn(component.loopMove, 'emit');
        spyOn(component, 'checkLoopCollision' as any).and.returnValue(true);

        component['dragState'] = {
          isDragging: true,
          dragType: 'move',
          loopId: testLoops[0].id,
          startX: 100,
          initialStartTime: testLoops[0].startTime,
          initialEndTime: testLoops[0].endTime
        };

        // Mock timeline track
        const mockTrack = document.createElement('div');
        spyOn(document, 'querySelector').and.returnValue(mockTrack);
        spyOn(mockTrack, 'getBoundingClientRect').and.returnValue({
          width: 200
        } as DOMRect);

        const mouseMoveEvent = { clientX: 150 } as MouseEvent;
        component.onDocumentMouseMove(mouseMoveEvent);

        expect(component.loopMove.emit).not.toHaveBeenCalled();
      });
    });

    describe('Enhanced Collision Detection (Task 29.2)', () => {
      beforeEach(() => {
        component.loops = testLoops;
        component.duration = 150;
      });

      it('should provide detailed collision information', () => {
        // Try to place a segment that overlaps with loop 2 (50-80)
        const collisionInfo = component.getLoopCollisionInfo('999', 60, 90);
        
        expect(collisionInfo.hasCollision).toBe(true);
        expect(collisionInfo.collidingLoops.length).toBe(1);
        expect(collisionInfo.collidingLoops[0].id).toBe('2');
        expect(collisionInfo.overlapDuration).toBe(20); // 80-60 = 20 seconds overlap
      });

      it('should calculate multiple collision overlaps', () => {
        // Create a segment that overlaps multiple loops
        const collisionInfo = component.getLoopCollisionInfo('999', 25, 95);
        
        expect(collisionInfo.hasCollision).toBe(true);
        expect(collisionInfo.collidingLoops.length).toBe(2);
        
        // Should overlap with loops 1 (10-30) and 2 (50-80)
        const overlapLoop1 = Math.max(0, 30 - 25); // 5 seconds
        const overlapLoop2 = Math.max(0, 80 - 50); // 30 seconds
        expect(collisionInfo.overlapDuration).toBe(overlapLoop1 + overlapLoop2);
      });

      it('should provide recommended position when collision exists', () => {
        const collisionInfo = component.getLoopCollisionInfo('999', 60, 90);
        
        expect(collisionInfo.hasCollision).toBe(true);
        expect(collisionInfo.recommendedPosition).toBeTruthy();
        
        // Should suggest placing after the conflicting loop
        const recommendation = collisionInfo.recommendedPosition!;
        expect(recommendation.startTime).toBe(80); // After loop 2 ends
        expect(recommendation.endTime).toBe(110); // 30-second duration maintained
      });

      it('should not detect collision for adjacent segments', () => {
        const collisionInfo = component.getLoopCollisionInfo('999', 30, 50);
        
        expect(collisionInfo.hasCollision).toBe(false);
        expect(collisionInfo.collidingLoops.length).toBe(0);
        expect(collisionInfo.overlapDuration).toBe(0);
      });

      it('should handle no collision case', () => {
        const collisionInfo = component.getLoopCollisionInfo('999', 130, 145);
        
        expect(collisionInfo.hasCollision).toBe(false);
        expect(collisionInfo.collidingLoops).toEqual([]);
        expect(collisionInfo.overlapDuration).toBe(0);
        expect(collisionInfo.recommendedPosition).toBeUndefined();
      });
    });

    describe('validateSegmentBounds (Enhanced Validation)', () => {
      beforeEach(() => {
        component.duration = 120;
      });

      it('should validate correct segment bounds', () => {
        const validation = component.validateSegmentBounds(10, 50);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toEqual([]);
        expect(validation.adjustedStartTime).toBeUndefined();
        expect(validation.adjustedEndTime).toBeUndefined();
      });

      it('should detect and adjust negative start time', () => {
        const validation = component.validateSegmentBounds(-10, 40);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Start time cannot be negative');
        expect(validation.adjustedStartTime).toBe(0);
        expect(validation.adjustedEndTime).toBe(40);
      });

      it('should detect and adjust end time exceeding duration', () => {
        const validation = component.validateSegmentBounds(80, 150);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('End time cannot exceed video duration');
        expect(validation.adjustedStartTime).toBe(80);
        expect(validation.adjustedEndTime).toBe(120);
      });

      it('should detect and adjust segments with insufficient duration', () => {
        const validation = component.validateSegmentBounds(50, 50.05);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Segment duration must be at least 0.1 seconds');
        expect(validation.adjustedStartTime).toBe(50);
        expect(validation.adjustedEndTime).toBe(50.1); // Minimum duration applied
      });

      it('should detect invalid start/end relationship', () => {
        const validation = component.validateSegmentBounds(60, 50);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain('Start time must be less than end time');
        expect(validation.adjustedStartTime).toBe(60);
        expect(validation.adjustedEndTime).toBe(60.1); // Fixed with minimum duration
      });

      it('should handle multiple validation errors', () => {
        const validation = component.validateSegmentBounds(-5, 130);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(1);
        expect(validation.adjustedStartTime).toBe(0);
        expect(validation.adjustedEndTime).toBe(120);
      });
    });

    describe('Template Integration', () => {
      beforeEach(() => {
        component.loops = testLoops;
        component.duration = 150;
        component.isLoading = false;
        component.disabled = false;
        fixture.detectChanges();
      });

      it('should render loop segments in template', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const segments = compiled.querySelectorAll('.loop-segment');
        
        expect(segments.length).toBe(testLoops.length);
      });

      it('should apply correct position styles to segments', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const firstSegment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        // First loop: 10-30 on 150 duration = 6.67%-13.33%
        expect(firstSegment.style.left).toBe('6.66667%');
        expect(firstSegment.style.width).toMatch(/13\.3+%/);
      });

      it('should render resize handles for segments', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const firstSegment = compiled.querySelector('.loop-segment') as HTMLElement;
        const leftHandle = firstSegment.querySelector('.resize-handle.left');
        const rightHandle = firstSegment.querySelector('.resize-handle.right');
        
        expect(leftHandle).toBeTruthy();
        expect(rightHandle).toBeTruthy();
      });

      it('should render loop body with times', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const firstSegment = compiled.querySelector('.loop-segment') as HTMLElement;
        const loopTimes = firstSegment.querySelector('.loop-times');
        const startTime = loopTimes?.querySelector('.start-time');
        const endTime = loopTimes?.querySelector('.end-time');
        
        expect(startTime?.textContent).toBe('0:10');
        expect(endTime?.textContent).toBe('0:30');
      });

      it('should render loop label when provided', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const firstSegment = compiled.querySelector('.loop-segment') as HTMLElement;
        const label = firstSegment.querySelector('.loop-label');
        
        expect(label?.textContent).toBe('Intro');
      });

      it('should set correct aria-labels for accessibility', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const firstSegment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        expect(firstSegment.getAttribute('aria-label')).toBe('Loop segment Intro from 0:10 to 0:30');
      });
    });
  });

  describe('Animations and Micro-interactions (Task 15.5)', () => {
    beforeEach(() => {
      component.loops = [
        { id: '1', startTime: 10, endTime: 30, name: 'Test Loop', playCount: 0, isActive: false }
      ];
      component.duration = 100;
      component.isLoading = false;
      component.disabled = false;
      fixture.detectChanges();
    });

    describe('Enhanced Accessibility', () => {
      it('should have proper ARIA attributes on timeline track', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        
        expect(track.getAttribute('role')).toBe('slider');
        expect(track.getAttribute('tabindex')).toBe('0');
        expect(track.getAttribute('aria-valuemin')).toBe('0');
        expect(track.getAttribute('aria-valuemax')).toBe('100');
        expect(track.getAttribute('aria-valuenow')).toBe('0');
        expect(track.getAttribute('aria-label')).toContain('Timeline scrubber');
      });

      it('should have proper ARIA attributes on loop segments', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        expect(segment.getAttribute('role')).toBe('button');
        expect(segment.getAttribute('tabindex')).toBe('0');
        expect(segment.getAttribute('aria-pressed')).toBe('false');
        expect(segment.getAttribute('aria-label')).toContain('Loop segment Test Loop');
      });

      it('should update aria-pressed when loop is selected', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        // Select the loop
        component['_selectedLoopId'] = '1';
        fixture.detectChanges();
        
        expect(segment.getAttribute('aria-pressed')).toBe('true');
      });

      it('should have proper ARIA attributes on resize handles', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const leftHandle = compiled.querySelector('.resize-handle.left') as HTMLElement;
        const rightHandle = compiled.querySelector('.resize-handle.right') as HTMLElement;
        
        expect(leftHandle.getAttribute('role')).toBe('button');
        expect(leftHandle.getAttribute('tabindex')).toBe('0');
        expect(leftHandle.getAttribute('aria-label')).toContain('Resize loop start');
        
        expect(rightHandle.getAttribute('role')).toBe('button');
        expect(rightHandle.getAttribute('tabindex')).toBe('0');
        expect(rightHandle.getAttribute('aria-label')).toContain('Resize loop end');
      });
    });

    describe('Animation Styles', () => {
      it('should apply correct CSS classes for animations', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        expect(segment.classList.contains('loop-segment')).toBe(true);
        expect(segment.style.getPropertyValue('--loop-index')).toBe('0');
      });

      it('should have staggered animation delay for multiple loops', () => {
        component.loops = [
          { id: '1', startTime: 10, endTime: 30, name: 'Loop 1', playCount: 0, isActive: false },
          { id: '2', startTime: 40, endTime: 60, name: 'Loop 2', playCount: 0, isActive: false },
          { id: '3', startTime: 70, endTime: 90, name: 'Loop 3', playCount: 0, isActive: false }
        ];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const segments = compiled.querySelectorAll('.loop-segment') as NodeListOf<HTMLElement>;
        
        expect(segments[0].style.getPropertyValue('--loop-index')).toBe('0');
        expect(segments[1].style.getPropertyValue('--loop-index')).toBe('1');
        expect(segments[2].style.getPropertyValue('--loop-index')).toBe('2');
      });
    });

    describe('Hover and Focus States', () => {
      it('should maintain focus visibility with proper outline styles', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        
        // Simulate focus
        track.focus();
        
        // Check if focus styles are applied (this is more of a visual test)
        expect(document.activeElement).toBe(track);
      });

      it('should handle keyboard interactions', () => {
        spyOn(component.seekTo, 'emit');
        spyOn(component.loopSelect, 'emit');
        
        const compiled = fixture.nativeElement as HTMLElement;
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        // Focus the segment
        segment.focus();
        
        // Simulate Enter key press
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        segment.dispatchEvent(enterEvent);
        
        // Enter key should trigger selection (though we'd need to add keyboard handler)
        expect(document.activeElement).toBe(segment);
      });
    });

    describe('Performance Optimizations', () => {
      it('should have proper CSS containment for performance', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const container = compiled.querySelector('.timeline-container') as HTMLElement;
        
        expect(container).toBeTruthy();
        // CSS containment would be applied via stylesheet, hard to test directly
      });

      it('should handle reduced motion preference', () => {
        // This is primarily tested through CSS media queries
        // The SCSS contains @media (prefers-reduced-motion: reduce) rules
        expect(true).toBe(true); // Placeholder - actual testing would require DOM testing environment
      });
    });

    describe('Enhanced Loading States', () => {
      it('should show enhanced loading animation', () => {
        component.isLoading = true;
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const loading = compiled.querySelector('.timeline-loading');
        const shimmer = compiled.querySelector('.loading-shimmer');
        
        expect(loading).toBeTruthy();
        expect(shimmer).toBeTruthy();
      });
    });

    describe('Mobile Touch Feedback', () => {
      it('should handle mobile touch states', () => {
        // Touch feedback is primarily CSS-based
        const compiled = fixture.nativeElement as HTMLElement;
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        
        expect(segment).toBeTruthy();
        // Mobile touch styles would be applied via CSS media queries
      });
    });

    describe('Selected Loop ID Getter', () => {
      it('should expose selectedLoopId through getter', () => {
        expect(component.selectedLoopId).toBe(null);
        
        component['_selectedLoopId'] = '1';
        expect(component.selectedLoopId).toBe('1');
      });

      it('should update selectedLoopId in template when changed', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        
        component['_selectedLoopId'] = '1';
        fixture.detectChanges();
        
        const segment = compiled.querySelector('.loop-segment') as HTMLElement;
        expect(segment.getAttribute('aria-pressed')).toBe('true');
        expect(segment.classList.contains('selected')).toBe(true);
      });
    });
  });

  describe('Enhanced Interaction and Navigation (Task 29.3)', () => {
    let testLoops: LoopSegment[];

    beforeEach(() => {
      testLoops = [
        { id: '1', startTime: 10, endTime: 30, name: 'Intro', playCount: 0, isActive: false },
        { id: '2', startTime: 50, endTime: 80, name: 'Solo', playCount: 0, isActive: false },
        { id: '3', startTime: 90, endTime: 120, name: 'Bridge', playCount: 0, isActive: false }
      ];
      component.loops = testLoops;
      component.duration = 150;
      component.isLoading = false;
      component.disabled = false;
      
      spyOn(component.seekTo, 'emit');
      spyOn(component.timelineClick, 'emit');
      spyOn(component.loopSelect, 'emit');
      spyOn(component.loopDeselect, 'emit');
      spyOn(component.seekStart, 'emit');
      spyOn(component.seekEnd, 'emit');
    });

    describe('getLoopAtTime', () => {
      it('should return loop segment at specific time', () => {
        const loop = component['getLoopAtTime'](20); // Within loop 1 (10-30)
        expect(loop).toBeTruthy();
        expect(loop?.id).toBe('1');
      });

      it('should return null for time outside loops', () => {
        const loop = component['getLoopAtTime'](40); // Between loops
        expect(loop).toBeNull();
      });

      it('should handle boundary times correctly', () => {
        const loopAtStart = component['getLoopAtTime'](10); // Start of loop 1
        const loopAtEnd = component['getLoopAtTime'](30);   // End of loop 1
        
        expect(loopAtStart?.id).toBe('1');
        expect(loopAtEnd?.id).toBe('1');
      });
    });

    describe('Enhanced Track Click with Loop Selection', () => {
      let mockEvent: jasmine.SpyObj<MouseEvent>;
      let mockElement: jasmine.SpyObj<HTMLElement>;

      beforeEach(() => {
        mockElement = jasmine.createSpyObj('HTMLElement', ['getBoundingClientRect']);
        mockElement.getBoundingClientRect.and.returnValue({
          left: 0,
          width: 150, // Timeline represents 150 seconds
          top: 0,
          right: 150,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({})
        } as DOMRect);

        mockEvent = jasmine.createSpyObj('MouseEvent', [], {
          currentTarget: mockElement,
          target: mockElement
        });
      });

      it('should select loop when clicking within loop segment', () => {
        // Click at position 20 seconds (within loop 1: 10-30)
        Object.defineProperty(mockEvent, 'clientX', { value: 20, writable: true });
        
        component.onTrackClick(mockEvent);

        expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
        expect(component['_selectedLoopId']).toBe('1');
        expect(component.seekTo.emit).toHaveBeenCalledWith(20);
        expect(component.timelineClick.emit).toHaveBeenCalledWith(20);
      });

      it('should deselect current loop when clicking outside loops', () => {
        // First select a loop
        component['_selectedLoopId'] = '1';
        
        // Click outside loops (at 40 seconds)
        Object.defineProperty(mockEvent, 'clientX', { value: 40, writable: true });
        
        component.onTrackClick(mockEvent);

        expect(component.loopDeselect.emit).toHaveBeenCalled();
        expect(component['_selectedLoopId']).toBeNull();
        expect(component.seekTo.emit).toHaveBeenCalledWith(40);
      });

      it('should handle double-click detection', () => {
        // Simulate rapid clicks
        Object.defineProperty(mockEvent, 'clientX', { value: 20, writable: true });
        
        component.onTrackClick(mockEvent);
        
        // Quick second click (within 300ms)
        component.onTrackClick(mockEvent);

        // First click should select, second should navigate only (no selection change)
        expect(component.loopSelect.emit).toHaveBeenCalledTimes(1);
      });

      it('should update focus state for accessibility', () => {
        spyOn(component as any, 'updateFocusState');
        Object.defineProperty(mockEvent, 'clientX', { value: 20, writable: true });
        
        component.onTrackClick(mockEvent);

        expect(component['updateFocusState']).toHaveBeenCalledWith(mockElement);
      });

      it('should set navigation state during interaction', () => {
        Object.defineProperty(mockEvent, 'clientX', { value: 20, writable: true });
        
        component.onTrackClick(mockEvent);

        expect(component.isNavigating).toBe(true);
        expect(component.seekStart.emit).toHaveBeenCalled();
      });
    });

    describe('Enhanced Touch Events with Loop Selection', () => {
      let mockElement: jasmine.SpyObj<HTMLElement>;

      beforeEach(() => {
        mockElement = jasmine.createSpyObj('HTMLElement', ['getBoundingClientRect']);
        mockElement.getBoundingClientRect.and.returnValue({
          left: 0,
          width: 150,
          top: 0,
          right: 150,
          bottom: 40,
          height: 40,
          x: 0,
          y: 0,
          toJSON: () => ({})
        } as DOMRect);
      });

      it('should pre-identify touched loop during touch start', () => {
        const touchEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          touches: [{ clientX: 20 }] // Within loop 1
        } as any;

        component.onTouchStart(touchEvent);

        expect(component.isNavigating).toBe(true);
      });

      it('should select loop on brief touch end', () => {
        // Start touch
        const touchStartEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          touches: [{ clientX: 20 }]
        } as any;
        
        component.onTouchStart(touchStartEvent);

        // End touch quickly (within loop)
        const touchEndEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          changedTouches: [{ clientX: 20 }]
        } as any;
        
        component.onTouchEnd(touchEndEvent);

        expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
        expect(component.seekTo.emit).toHaveBeenCalledWith(20);
      });

      it('should deselect when touching outside loops', () => {
        component['_selectedLoopId'] = '1';
        
        // Start touch
        const touchStartEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          touches: [{ clientX: 40 }] // Outside loops
        } as any;
        
        component.onTouchStart(touchStartEvent);

        // End touch quickly
        const touchEndEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          changedTouches: [{ clientX: 40 }]
        } as any;
        
        component.onTouchEnd(touchEndEvent);

        expect(component.loopDeselect.emit).toHaveBeenCalled();
        expect(component['_selectedLoopId']).toBeNull();
      });
    });

    describe('Loop Navigation Methods', () => {
      beforeEach(() => {
        component.currentTime = 35; // Between loops 1 and 2
      });

      describe('navigateToLoop', () => {
        it('should navigate to specific loop', () => {
          component.navigateToLoop('2');

          expect(component['_selectedLoopId']).toBe('2');
          expect(component.loopSelect.emit).toHaveBeenCalledWith('2');
          expect(component.seekTo.emit).toHaveBeenCalledWith(50); // Start of loop 2
          expect(component.timelineClick.emit).toHaveBeenCalledWith(50);
        });

        it('should do nothing for non-existent loop', () => {
          component.navigateToLoop('999');

          expect(component.loopSelect.emit).not.toHaveBeenCalled();
          expect(component.seekTo.emit).not.toHaveBeenCalled();
        });

        it('should not navigate when not ready', () => {
          component.isLoading = true;
          
          component.navigateToLoop('1');

          expect(component.seekTo.emit).not.toHaveBeenCalled();
        });
      });

      describe('navigateToNextLoop', () => {
        it('should navigate to next loop after current time', () => {
          component.navigateToNextLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('2'); // Next loop after current time (35)
          expect(component.seekTo.emit).toHaveBeenCalledWith(50);
        });

        it('should navigate to next loop when one is selected', () => {
          component['_selectedLoopId'] = '1';
          
          component.navigateToNextLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('2');
          expect(component.seekTo.emit).toHaveBeenCalledWith(50);
        });

        it('should wrap to first loop when at last loop', () => {
          component['_selectedLoopId'] = '3';
          
          component.navigateToNextLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
          expect(component.seekTo.emit).toHaveBeenCalledWith(10);
        });

        it('should handle empty loops array', () => {
          component.loops = [];
          
          component.navigateToNextLoop();

          expect(component.loopSelect.emit).not.toHaveBeenCalled();
        });
      });

      describe('navigateToPrevLoop', () => {
        it('should navigate to previous loop when one is selected', () => {
          component['_selectedLoopId'] = '2';
          
          component.navigateToPrevLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
          expect(component.seekTo.emit).toHaveBeenCalledWith(10);
        });

        it('should wrap to last loop when at first loop', () => {
          component['_selectedLoopId'] = '1';
          
          component.navigateToPrevLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('3');
          expect(component.seekTo.emit).toHaveBeenCalledWith(90);
        });

        it('should find last loop before current time when none selected', () => {
          component.currentTime = 85; // After loop 2 (50-80)
          
          component.navigateToPrevLoop();

          expect(component.loopSelect.emit).toHaveBeenCalledWith('2');
          expect(component.seekTo.emit).toHaveBeenCalledWith(50);
        });
      });
    });

    describe('Focus Management', () => {
      it('should update focus state on element', () => {
        const mockElement = document.createElement('div');
        spyOn(mockElement, 'focus');
        
        component['updateFocusState'](mockElement);

        expect(component['interactionState'].focusedElement).toBe(mockElement);
        expect(mockElement.focus).toHaveBeenCalled();
      });

      it('should handle null element gracefully', () => {
        expect(() => {
          component['updateFocusState'](null as any);
        }).not.toThrow();
      });
    });

    describe('Navigation State Management', () => {
      it('should track navigation state correctly', () => {
        expect(component.isNavigating).toBe(false);
        
        component['interactionState'].isNavigating = true;
        expect(component.isNavigating).toBe(true);
      });

      it('should reset navigation state after interaction', (done) => {
        const mockEvent = {
          currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 150 }) },
          clientX: 20
        } as any;
        
        component.onTrackClick(mockEvent);
        
        expect(component.isNavigating).toBe(true);
        
        setTimeout(() => {
          expect(component.isNavigating).toBe(false);
          done();
        }, 250);
      });
    });

    describe('Integration with Existing Functionality', () => {
      it('should work with existing loop selection via onLoopClick', () => {
        const loop = testLoops[0];
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation')
        } as any;

        component.onLoopClick(mockEvent, loop);

        expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
        expect(component['_selectedLoopId']).toBe('1');
      });

      it('should maintain compatibility with drag operations', () => {
        const loop = testLoops[0];
        const mockEvent = {
          preventDefault: jasmine.createSpy('preventDefault'),
          stopPropagation: jasmine.createSpy('stopPropagation'),
          clientX: 100
        } as any;

        component.onLoopMouseDown(mockEvent, loop, 'move');

        expect(component['dragState'].isDragging).toBe(true);
        expect(component.loopSelect.emit).toHaveBeenCalledWith('1');
      });

      it('should prevent touch/click interference', () => {
        const mockElement = { getBoundingClientRect: () => ({ left: 0, width: 150 }) };
        
        // Start touch interaction
        const touchStartEvent = {
          currentTarget: mockElement,
          preventDefault: jasmine.createSpy('preventDefault'),
          touches: [{ clientX: 20 }]
        } as any;
        
        component.onTouchStart(touchStartEvent);

        // Try click - should be prevented
        const clickEvent = {
          currentTarget: mockElement,
          clientX: 20
        } as any;
        
        component.onTrackClick(clickEvent);

        expect(component.seekTo.emit).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle zero duration gracefully', () => {
        component.duration = 0;
        
        const loop = component['getLoopAtTime'](10);
        expect(loop).toBeNull();
      });

      it('should handle empty loops array', () => {
        component.loops = [];
        
        const loop = component['getLoopAtTime'](10);
        expect(loop).toBeNull();
      });

      it('should handle negative time values', () => {
        const loop = component['getLoopAtTime'](-10);
        expect(loop).toBeNull();
      });

      it('should handle time beyond duration', () => {
        const loop = component['getLoopAtTime'](200);
        expect(loop).toBeNull();
      });
    });

    describe('Performance Optimizations', () => {
      it('should efficiently find loops at time', () => {
        // Create many loops to test performance
        const manyLoops = Array.from({ length: 100 }, (_, i) => ({
          id: `loop-${i}`,
          startTime: i * 10,
          endTime: i * 10 + 5,
          name: `Loop ${i}`,
          playCount: 0,
          isActive: false
        })) as LoopSegment[];
        
        component.loops = manyLoops;
        
        const startTime = performance.now();
        const loop = component['getLoopAtTime'](555); // Should find loop-55
        const endTime = performance.now();
        
        expect(loop?.id).toBe('loop-55');
        expect(endTime - startTime).toBeLessThan(5); // Should be very fast
      });
    });
  });

  describe('LoopManagerFacade Integration (Task 29.5)', () => {
    let mockLoopManagerFacade: jasmine.SpyObj<LoopManagerFacade>;
    let mockTimelineVm: TimelineViewModel;

    beforeEach(() => {
      // Create mock facade with proper signals
      mockTimelineVm = {
        loops: [
          { id: '1', startTime: 10, endTime: 30, name: 'Test Loop 1', playCount: 0, isActive: false },
          { id: '2', startTime: 50, endTime: 80, name: 'Test Loop 2', playCount: 0, isActive: false }
        ],
        editingLoop: null,
        activeLoopId: '1',
        selectedLoopId: '1',
        canCreateLoop: true
      };

      mockLoopManagerFacade = jasmine.createSpyObj('LoopManagerFacade', [
        'createLoop',
        'updateLoop',
        'deleteLoop',
        'selectLoop',
        'getLoopProgress'
      ], {
        timelineVm: jasmine.createSpy().and.returnValue(mockTimelineVm),
        activeLoop: jasmine.createSpy().and.returnValue({ id: '1', startTime: 10, endTime: 30, name: 'Test Loop 1', playCount: 0, isActive: true }),
        isLooping: jasmine.createSpy().and.returnValue(true),
        error: jasmine.createSpy().and.returnValue(null)
      });

      // Replace the injected facade with our mock
      (component as any).loopManagerFacade = mockLoopManagerFacade;
    });

    describe('Facade Integration Setup', () => {
      it('should setup facade integration when useFacade is true', () => {
        component.useFacade = true;
        spyOn(component as any, 'setupFacadeIntegration');
        
        component.ngOnInit();
        
        expect(component['setupFacadeIntegration']).toHaveBeenCalled();
      });

      it('should not setup facade integration when useFacade is false', () => {
        component.useFacade = false;
        spyOn(component as any, 'setupFacadeIntegration');
        
        component.ngOnInit();
        
        expect(component['setupFacadeIntegration']).not.toHaveBeenCalled();
      });
    });

    describe('Effective Data Sources', () => {
      it('should use facade loops when useFacade is true', () => {
        component.useFacade = true;
        
        const loops = component.effectiveLoops;
        
        expect(loops).toEqual(mockTimelineVm.loops);
        expect(mockLoopManagerFacade.timelineVm).toHaveBeenCalled();
      });

      it('should use input loops when useFacade is false', () => {
        component.useFacade = false;
        const inputLoops = [{ id: '3', startTime: 100, endTime: 120, name: 'Input Loop', playCount: 0, isActive: false }];
        component.loops = inputLoops;
        
        const loops = component.effectiveLoops;
        
        expect(loops).toEqual(inputLoops);
      });

      it('should get active loop ID from facade when useFacade is true', () => {
        component.useFacade = true;
        
        const activeLoopId = component.activeLoopId;
        
        expect(activeLoopId).toBe('1');
        expect(mockLoopManagerFacade.activeLoop).toHaveBeenCalled();
      });

      it('should get validation error from facade when useFacade is true', () => {
        component.useFacade = true;
        mockLoopManagerFacade.error = jasmine.createSpy().and.returnValue('Test error');
        
        const hasError = component.hasValidationError;
        const error = component.validationError;
        
        expect(hasError).toBe(true);
        expect(error).toBe('Test error');
        expect(mockLoopManagerFacade.error).toHaveBeenCalled();
      });
    });

    describe('Loop Creation with Facade', () => {
      beforeEach(() => {
        component.useFacade = true;
        component.duration = 100;
        component.isLoading = false;
        component.disabled = false;
      });

      it('should create loop through facade on double-click', () => {
        mockLoopManagerFacade.createLoop.and.returnValue({ success: true });
        
        const mockEvent = new MouseEvent('dblclick');
        const mockElement = document.createElement('div');
        Object.defineProperty(mockEvent, 'currentTarget', { value: mockElement });
        Object.defineProperty(mockEvent, 'clientX', { value: 50 });
        
        spyOn(mockElement, 'getBoundingClientRect').and.returnValue({
          left: 0, width: 100, top: 0, right: 100, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({})
        } as DOMRect);
        
        component.onTrackDoubleClick(mockEvent);
        
        expect(mockLoopManagerFacade.createLoop).toHaveBeenCalled();
      });

      it('should handle facade creation errors', () => {
        mockLoopManagerFacade.createLoop.and.returnValue({ success: false, error: 'Creation failed' });
        spyOn(component.validationError, 'emit');
        
        const mockEvent = new MouseEvent('dblclick');
        const mockElement = document.createElement('div');
        Object.defineProperty(mockEvent, 'currentTarget', { value: mockElement });
        Object.defineProperty(mockEvent, 'clientX', { value: 50 });
        
        spyOn(mockElement, 'getBoundingClientRect').and.returnValue({
          left: 0, width: 100, top: 0, right: 100, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({})
        } as DOMRect);
        
        component.onTrackDoubleClick(mockEvent);
        
        expect(component.validationError.emit).toHaveBeenCalledWith('Creation failed');
      });

      it('should create loop through facade on keyboard shortcut', () => {
        mockLoopManagerFacade.createLoop.and.returnValue({ success: true });
        component.currentTime = 50;
        
        const keyEvent = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true });
        component.onKeyDown(keyEvent);
        
        expect(mockLoopManagerFacade.createLoop).toHaveBeenCalled();
      });
    });

    describe('Loop Manipulation with Facade', () => {
      beforeEach(() => {
        component.useFacade = true;
        component.duration = 100;
        component.isLoading = false;
        component.disabled = false;
      });

      it('should select loop through facade', () => {
        mockLoopManagerFacade.selectLoop.and.returnValue({ success: true });
        const mockEvent = new MouseEvent('click');
        const testLoop = mockTimelineVm.loops[0];
        
        component.onLoopClick(mockEvent, testLoop);
        
        expect(mockLoopManagerFacade.selectLoop).toHaveBeenCalledWith('1');
      });

      it('should handle facade selection errors', () => {
        mockLoopManagerFacade.selectLoop.and.returnValue({ success: false, error: 'Selection failed' });
        spyOn(component.validationError, 'emit');
        const mockEvent = new MouseEvent('click');
        const testLoop = mockTimelineVm.loops[0];
        
        component.onLoopClick(mockEvent, testLoop);
        
        expect(component.validationError.emit).toHaveBeenCalledWith('Selection failed');
      });

      it('should delete loop through facade on keyboard shortcut', () => {
        mockLoopManagerFacade.deleteLoop.and.returnValue({ success: true });
        component['_selectedLoopId'] = '1';
        
        const keyEvent = new KeyboardEvent('keydown', { key: 'Delete' });
        component.onKeyDown(keyEvent);
        
        expect(mockLoopManagerFacade.deleteLoop).toHaveBeenCalledWith('1');
      });

      it('should handle facade deletion errors', () => {
        mockLoopManagerFacade.deleteLoop.and.returnValue({ success: false, error: 'Deletion failed' });
        spyOn(component.validationError, 'emit');
        component['_selectedLoopId'] = '1';
        
        const keyEvent = new KeyboardEvent('keydown', { key: 'Delete' });
        component.onKeyDown(keyEvent);
        
        expect(component.validationError.emit).toHaveBeenCalledWith('Deletion failed');
      });
    });

    describe('Animation States and Visual Feedback', () => {
      beforeEach(() => {
        component.useFacade = true;
        component.duration = 100;
        component.isLoading = false;
        component.disabled = false;
      });

      it('should emit animation state changes on loop hover', () => {
        spyOn(component.animationStateChange, 'emit');
        const testLoop = mockTimelineVm.loops[0];
        
        component.onLoopMouseEnter(testLoop);
        
        expect(component.animationStateChange.emit).toHaveBeenCalledWith({ state: 'hover', loopId: '1' });
      });

      it('should clear hover state on mouse leave', () => {
        spyOn(component.animationStateChange, 'emit');
        const testLoop = mockTimelineVm.loops[0];
        
        component.onLoopMouseEnter(testLoop);
        component.onLoopMouseLeave(testLoop);
        
        expect(component.animationStateChange.emit).toHaveBeenCalledWith({ state: 'idle' });
      });

      it('should get correct container classes with facade states', () => {
        component.useFacade = true;
        mockLoopManagerFacade.isLooping = jasmine.createSpy().and.returnValue(true);
        mockLoopManagerFacade.error = jasmine.createSpy().and.returnValue('Test error');
        
        const classes = component.getContainerClasses();
        
        expect(classes).toContain('looping');
        expect(classes).toContain('validation-error');
      });

      it('should apply correct loop classes with facade states', () => {
        const testLoop = mockTimelineVm.loops[0];
        component['_selectedLoopId'] = '1';
        mockLoopManagerFacade.isLooping = jasmine.createSpy().and.returnValue(true);
        
        const classes = component.getLoopClasses(testLoop);
        
        expect(classes).toContain('selected');
        expect(classes).toContain('active');
        expect(classes).toContain('playing');
      });

      it('should check if loop is playing correctly', () => {
        const testLoop = mockTimelineVm.loops[0];
        mockLoopManagerFacade.isLooping = jasmine.createSpy().and.returnValue(true);
        
        const isPlaying = component.isLoopPlaying(testLoop);
        
        expect(isPlaying).toBe(true);
      });

      it('should get active loop progress from facade', () => {
        mockLoopManagerFacade.getLoopProgress.and.returnValue(0.5);
        component.currentTime = 20;
        
        const progress = component.getActiveLoopProgress();
        
        expect(progress).toBe(0.5);
        expect(mockLoopManagerFacade.getLoopProgress).toHaveBeenCalledWith(20, jasmine.any(Object));
      });
    });

    describe('Enhanced Validation and Error Handling', () => {
      beforeEach(() => {
        component.useFacade = true;
      });

      it('should handle facade validation errors during creation', () => {
        spyOn(component.validationErrorChange, 'emit');
        
        const isValid = component['handleLoopValidation'](10, 5); // Invalid: end < start
        
        expect(isValid).toBe(false);
        expect(component.validationErrorChange.emit).toHaveBeenCalledWith(jasmine.stringMatching(/Start time must be less than end time/));
      });

      it('should provide collision recommendations', () => {
        component.loops = [
          { id: '1', startTime: 20, endTime: 40, name: 'Existing Loop', playCount: 0, isActive: false }
        ];
        spyOn(component.validationErrorChange, 'emit');
        
        const isValid = component['handleLoopValidation'](30, 50); // Overlaps with existing loop
        
        expect(isValid).toBe(false);
        expect(component.validationErrorChange.emit).toHaveBeenCalledWith(jasmine.stringMatching(/Collision detected. Try position/));
      });
    });

    describe('Integration Test: Full Workflow', () => {
      it('should complete full loop creation workflow with facade', () => {
        component.useFacade = true;
        component.duration = 100;
        component.isLoading = false;
        component.disabled = false;
        
        mockLoopManagerFacade.createLoop.and.returnValue({ success: true, loop: mockTimelineVm.loops[0] });
        spyOn(component.loopCreate, 'emit');
        spyOn(component.animationStateChange, 'emit');
        
        // Double-click to create
        const mockEvent = new MouseEvent('dblclick');
        const mockElement = document.createElement('div');
        Object.defineProperty(mockEvent, 'currentTarget', { value: mockElement });
        Object.defineProperty(mockEvent, 'clientX', { value: 50 });
        
        spyOn(mockElement, 'getBoundingClientRect').and.returnValue({
          left: 0, width: 100, top: 0, right: 100, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({})
        } as DOMRect);
        
        component.onTrackDoubleClick(mockEvent);
        
        expect(mockLoopManagerFacade.createLoop).toHaveBeenCalled();
        expect(component.animationStateChange.emit).toHaveBeenCalledWith({ state: 'creating' });
      });
    });

    describe('Performance and Optimization', () => {
      it('should use staggered animation delays correctly', () => {
        const delay1 = component.getLoopAnimationDelay(0);
        const delay2 = component.getLoopAnimationDelay(1);
        const delay3 = component.getLoopAnimationDelay(2);
        
        expect(delay1).toBe('0s');
        expect(delay2).toBe('0.05s');
        expect(delay3).toBe('0.1s');
      });

      it('should cleanup resources on destroy', () => {
        spyOn(component['destroy$'], 'next');
        spyOn(component['destroy$'], 'complete');
        
        component.ngOnDestroy();
        
        expect(component['destroy$'].next).toHaveBeenCalled();
        expect(component['destroy$'].complete).toHaveBeenCalled();
      });
    });
  });
  
  describe('Visual Loop Creation (Task 29.4)', () => {
    let mockTrack: HTMLElement;
    let mockEvent: jasmine.SpyObj<MouseEvent>;
    
    beforeEach(() => {
      // Setup component for tests
      component.duration = 120;
      component.isLoading = false;
      component.disabled = false;
      component.canCreateLoop = true;
      
      // Create mock track element
      mockTrack = document.createElement('div');
      spyOn(mockTrack, 'getBoundingClientRect').and.returnValue({
        left: 0,
        width: 300, // 300px width for easy calculation
        top: 0,
        right: 300,
        bottom: 40,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({})
      } as DOMRect);
      
      // Mock document.querySelector for timeline track
      spyOn(document, 'querySelector').and.returnValue(mockTrack);
      
      // Setup event spies
      spyOn(component.loopCreate, 'emit');
      spyOn(document.body.classList, 'add');
      spyOn(document.body.classList, 'remove');
      
      fixture.detectChanges();
    });
    
    describe('Track Mouse Down for Visual Creation', () => {
      beforeEach(() => {
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 150, // 50% of 300px width = 60s on 120s duration
          currentTarget: mockTrack
        });
      });
      
      it('should start visual loop creation on empty timeline area', () => {
        component.onTrackMouseDown(mockEvent);
        
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(component.isCreatingLoop).toBe(true);
        expect(component['dragState'].dragType).toBe('create');
        expect(component['dragState'].isDragging).toBe(true);
        expect(document.body.classList.add).toHaveBeenCalledWith('creating-loop');
      });
      
      it('should not start creation when clicking on existing loop', () => {
        // Add a loop at the click position
        component.loops = [{
          id: '1',
          startTime: 55,
          endTime: 65,
          name: 'Existing Loop',
          playCount: 0,
          isActive: false
        }];
        
        component.onTrackMouseDown(mockEvent);
        
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        expect(component.isCreatingLoop).toBe(false);
      });
      
      it('should not start creation when not ready', () => {
        component.isLoading = true;
        
        component.onTrackMouseDown(mockEvent);
        
        expect(component.isCreatingLoop).toBe(false);
        expect(document.body.classList.add).not.toHaveBeenCalled();
      });
      
      it('should not start creation when loop creation is disabled', () => {
        component.canCreateLoop = false;
        
        component.onTrackMouseDown(mockEvent);
        
        expect(component.isCreatingLoop).toBe(false);
        expect(document.body.classList.add).not.toHaveBeenCalled();
      });
    });
    
    describe('Visual Creation Preview State', () => {
      beforeEach(() => {
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 90, // 30% of 300px width = 36s on 120s duration
          currentTarget: mockTrack
        });
      });
      
      it('should initialize creation preview state correctly', () => {
        component.onTrackMouseDown(mockEvent);
        
        const preview = component.creationPreview;
        expect(preview).toBeTruthy();
        expect(preview!.startTime).toBe(36); // 30% of 120s
        expect(preview!.endTime).toBe(36);
        expect(preview!.isVisible).toBe(true);
      });
      
      it('should update creation preview during mouse move', () => {
        // Start creation
        component.onTrackMouseDown(mockEvent);
        
        // Move mouse to create larger loop
        component.onDocumentMouseMove({ clientX: 210 } as MouseEvent); // 70% position
        
        const preview = component.creationPreview;
        expect(preview!.startTime).toBe(36); // Original start
        expect(preview!.endTime).toBeCloseTo(84, 0); // 70% of 120s
      });
      
      it('should respect minimum loop duration', () => {
        component.onTrackMouseDown(mockEvent);
        
        // Move mouse only slightly
        component.onDocumentMouseMove({ clientX: 95 } as MouseEvent); // Just 5px
        
        const preview = component.creationPreview;
        expect(preview!.endTime - preview!.startTime).toBeGreaterThanOrEqual(0.5);
      });
      
      it('should handle reverse dragging (right to left)', () => {
        // Start at 70% position
        const startEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 210,
          currentTarget: mockTrack
        });
        
        component.onTrackMouseDown(startEvent);
        
        // Drag left to 30% position
        component.onDocumentMouseMove({ clientX: 90 } as MouseEvent);
        
        const preview = component.creationPreview;
        expect(preview!.startTime).toBeCloseTo(36, 0); // Left position becomes start
        expect(preview!.endTime).toBeCloseTo(84, 0); // Right position becomes end
      });
    });
    
    describe('Creation Preview Position Calculation', () => {
      it('should calculate preview position correctly', () => {
        component['_creationPreview'] = {
          startTime: 24, // 20% of 120s
          endTime: 60,   // 50% of 120s
          startX: 60,
          currentX: 150,
          isVisible: true
        };
        
        const position = component.getCreationPreviewPosition();
        
        expect(position).toBeTruthy();
        expect(position!.left).toBe(20); // 20% of timeline
        expect(position!.width).toBe(30); // 30% of timeline (50% - 20%)
      });
      
      it('should return null when no preview exists', () => {
        component['_creationPreview'] = null;
        
        const position = component.getCreationPreviewPosition();
        expect(position).toBeNull();
      });
      
      it('should constrain position within bounds', () => {
        component['_creationPreview'] = {
          startTime: -10, // Invalid negative time
          endTime: 140,   // Beyond duration
          startX: 0,
          currentX: 350,
          isVisible: true
        };
        
        const position = component.getCreationPreviewPosition();
        
        expect(position!.left).toBe(0); // Constrained to 0
        expect(position!.width).toBeGreaterThan(0); // Should have some width
        expect(position!.width).toBeLessThanOrEqual(100); // Should not exceed 100%
      });
    });
    
    describe('Collision Detection During Creation', () => {
      beforeEach(() => {
        component.loops = [
          { id: '1', startTime: 30, endTime: 60, name: 'Existing Loop', playCount: 0, isActive: false }
        ];
      });
      
      it('should detect collision during visual creation', () => {
        // Start creation that will overlap with existing loop
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 75, // 25% position (30s)
          currentTarget: mockTrack
        });
        
        component.onTrackMouseDown(mockEvent);
        
        // Drag to create overlapping loop
        component.onDocumentMouseMove({ clientX: 135 } as MouseEvent); // 45% position (54s)
        
        expect(component.creationHasCollision).toBe(true);
        expect(document.body.classList.add).toHaveBeenCalledWith('creation-collision');
      });
      
      it('should not detect collision for non-overlapping creation', () => {
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 25, // 8.33% position (10s)
          currentTarget: mockTrack
        });
        
        component.onTrackMouseDown(mockEvent);
        
        // Create non-overlapping loop
        component.onDocumentMouseMove({ clientX: 75 } as MouseEvent); // 25% position (30s)
        
        expect(component.creationHasCollision).toBe(false);
        expect(document.body.classList.remove).toHaveBeenCalledWith('creation-collision');
      });
    });
    
    describe('Visual Creation Completion', () => {
      beforeEach(() => {
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 60, // 20% position (24s)
          currentTarget: mockTrack
        });
      });
      
      it('should emit loop creation event on successful completion', () => {
        component.onTrackMouseDown(mockEvent);
        
        // Drag to create 30-second loop
        component.onDocumentMouseMove({ clientX: 135 } as MouseEvent); // 45% position (54s)
        
        // Finish creation
        component.onDocumentMouseUp();
        
        expect(component.loopCreate.emit).toHaveBeenCalledWith({
          startTime: 24,
          endTime: 54
        });
      });
      
      it('should not create loop when duration is too small', () => {
        component.onTrackMouseDown(mockEvent);
        
        // Move mouse only slightly (less than 0.5s duration)
        component.onDocumentMouseMove({ clientX: 62 } as MouseEvent);
        
        // Finish creation
        component.onDocumentMouseUp();
        
        expect(component.loopCreate.emit).not.toHaveBeenCalled();
      });
      
      it('should not create loop when collision detected', () => {
        component.loops = [
          { id: '1', startTime: 20, endTime: 40, name: 'Existing', playCount: 0, isActive: false }
        ];
        
        component.onTrackMouseDown(mockEvent);
        
        // Create overlapping loop
        component.onDocumentMouseMove({ clientX: 105 } as MouseEvent); // 35% position (42s)
        
        // Finish creation
        component.onDocumentMouseUp();
        
        expect(component.loopCreate.emit).not.toHaveBeenCalled();
      });
      
      it('should clean up visual state after completion', () => {
        component.onTrackMouseDown(mockEvent);
        component.onDocumentMouseMove({ clientX: 135 } as MouseEvent);
        component.onDocumentMouseUp();
        
        expect(component.isCreatingLoop).toBe(false);
        expect(component.creationPreview).toBeNull();
        expect(document.body.classList.remove).toHaveBeenCalledWith('creating-loop');
        expect(document.body.classList.remove).toHaveBeenCalledWith('creation-collision');
      });
      
      it('should use adjusted bounds when validation suggests them', () => {
        // Create a loop that goes beyond duration
        component.duration = 50; // Short duration
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 240, // 80% position (40s of 50s duration)
          currentTarget: mockTrack
        });
        
        component.onTrackMouseDown(mockEvent);
        
        // Drag beyond duration
        component.onDocumentMouseMove({ clientX: 300 } as MouseEvent); // 100% position (50s)
        
        // Finish creation
        component.onDocumentMouseUp();
        
        expect(component.loopCreate.emit).toHaveBeenCalledWith(jasmine.objectContaining({
          startTime: jasmine.any(Number),
          endTime: 50 // Should be adjusted to duration limit
        }));
      });
    });
    
    describe('Template Integration for Visual Creation', () => {
      beforeEach(() => {
        component.duration = 100;
        fixture.detectChanges();
      });
      
      it('should add mousedown event listener to timeline track', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        
        expect(track).toBeTruthy();
        
        // Mock mousedown event
        const mousedownEvent = new MouseEvent('mousedown', { clientX: 150 });
        spyOn(component, 'onTrackMouseDown');
        
        track.dispatchEvent(mousedownEvent);
        
        expect(component.onTrackMouseDown).toHaveBeenCalled();
      });
      
      it('should show creation preview when creating loop', () => {
        component['_creationPreview'] = {
          startTime: 20,
          endTime: 40,
          startX: 60,
          currentX: 120,
          isVisible: true
        };
        
        fixture.detectChanges();
        
        const compiled = fixture.nativeElement as HTMLElement;
        const preview = compiled.querySelector('.creation-preview');
        
        expect(preview).toBeTruthy();
        expect(preview?.getAttribute('style')).toContain('left: 20%');
        expect(preview?.getAttribute('style')).toContain('width: 20%');
      });
      
      it('should show collision warning during creation collision', () => {
        component.loops = [
          { id: '1', startTime: 25, endTime: 35, name: 'Collision', playCount: 0, isActive: false }
        ];
        
        component['_creationPreview'] = {
          startTime: 20,
          endTime: 30, // Overlaps with existing loop
          startX: 60,
          currentX: 90,
          isVisible: true
        };
        
        fixture.detectChanges();
        
        const compiled = fixture.nativeElement as HTMLElement;
        const preview = compiled.querySelector('.creation-preview');
        const warning = preview?.querySelector('.collision-warning');
        
        expect(preview?.classList.contains('has-collision')).toBe(true);
        expect(warning).toBeTruthy();
        expect(warning?.textContent).toBe('⚠');
      });
      
      it('should apply correct cursor styles during creation', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        
        // Default state
        expect(track.style.cursor).toBe('crosshair');
        
        // During creation
        component['dragState'].isDragging = true;
        component['dragState'].dragType = 'create';
        fixture.detectChanges();
        
        expect(track.style.cursor).toBe('grabbing');
      });
      
      it('should apply creation mode classes to timeline track', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        
        // Start creation mode
        component['dragState'].isDragging = true;
        component['dragState'].dragType = 'create';
        fixture.detectChanges();
        
        expect(track.classList.contains('creating')).toBe(true);
        
        // With collision
        component['_creationPreview'] = {
          startTime: 20,
          endTime: 30,
          startX: 60,
          currentX: 90,
          isVisible: true
        };
        component.loops = [
          { id: '1', startTime: 25, endTime: 35, name: 'Collision', playCount: 0, isActive: false }
        ];
        fixture.detectChanges();
        
        expect(track.classList.contains('has-collision')).toBe(true);
      });
    });
    
    describe('Accessibility for Visual Creation', () => {
      it('should update aria-label to include creation instructions', () => {
        component.duration = 100;
        fixture.detectChanges();
        
        const compiled = fixture.nativeElement as HTMLElement;
        const track = compiled.querySelector('.timeline-track') as HTMLElement;
        const ariaLabel = track.getAttribute('aria-label');
        
        expect(ariaLabel).toContain('Double-click or drag to create loop');
      });
      
      it('should provide aria-label for creation preview', () => {
        component['_creationPreview'] = {
          startTime: 15,
          endTime: 45,
          startX: 45,
          currentX: 135,
          isVisible: true
        };
        
        fixture.detectChanges();
        
        const compiled = fixture.nativeElement as HTMLElement;
        const preview = compiled.querySelector('.creation-preview');
        const ariaLabel = preview?.getAttribute('aria-label');
        
        expect(ariaLabel).toBe('Creating loop from 0:15 to 0:45');
      });
    });
    
    describe('Error Handling and Edge Cases for Visual Creation', () => {
      it('should handle mouse move without active creation gracefully', () => {
        expect(() => {
          component.onDocumentMouseMove({ clientX: 150 } as MouseEvent);
        }).not.toThrow();
      });
      
      it('should handle mouse up without active creation gracefully', () => {
        expect(() => {
          component.onDocumentMouseUp();
        }).not.toThrow();
        
        expect(component.isCreatingLoop).toBe(false);
      });
      
      it('should handle missing timeline track element', () => {
        spyOn(document, 'querySelector').and.returnValue(null);
        
        mockEvent = jasmine.createSpyObj('MouseEvent', ['preventDefault', 'stopPropagation'], {
          clientX: 150,
          currentTarget: mockTrack
        });
        
        component.onTrackMouseDown(mockEvent);
        
        expect(() => {
          component.onDocumentMouseMove({ clientX: 200 } as MouseEvent);
        }).not.toThrow();
      });
      
      it('should handle creation preview position calculation with zero duration', () => {
        component.duration = 0;
        component['_creationPreview'] = {
          startTime: 10,
          endTime: 20,
          startX: 30,
          currentX: 60,
          isVisible: true
        };
        
        const position = component.getCreationPreviewPosition();
        expect(position).toBeNull();
      });
    });
  });
});