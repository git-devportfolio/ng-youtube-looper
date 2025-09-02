import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoopListComponent, LoopListAction } from './loop-list.component';
import { LoopManagerFacade } from '../../services/loop-manager.facade';
import { LoopSegment } from '@shared/interfaces';
import { signal } from '@angular/core';

describe('LoopListComponent', () => {
  let component: LoopListComponent;
  let fixture: ComponentFixture<LoopListComponent>;
  let mockFacade: jasmine.SpyObj<LoopManagerFacade>;

  const mockLoops: LoopSegment[] = [
    {
      id: '1',
      name: 'First Loop',
      startTime: 30,
      endTime: 60,
      playbackSpeed: 1.0,
      repeatCount: 1,
      color: '#3B82F6',
      playCount: 5,
      isActive: true
    },
    {
      id: '2', 
      name: 'Second Loop',
      startTime: 90,
      endTime: 120,
      playbackSpeed: 0.5,
      repeatCount: 3,
      color: '#EF4444',
      playCount: 0,
      isActive: false
    }
  ];

  beforeEach(async () => {
    const facadeSpy = jasmine.createSpyObj('LoopManagerFacade', [
      'formatTime'
    ], {
      vm: jasmine.createSpy('vm').and.returnValue({
        loops: mockLoops,
        activeLoop: mockLoops[0],
        isLooping: false,
        hasLoops: true,
        totalLoops: 2,
        activeLoopIndex: 0,
        canStartLoop: true,
        lastError: null
      })
    });

    facadeSpy.formatTime.and.callFake((seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    });

    await TestBed.configureTestingModule({
      imports: [LoopListComponent],
      providers: [
        { provide: LoopManagerFacade, useValue: facadeSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoopListComponent);
    component = fixture.componentInstance;
    mockFacade = TestBed.inject(LoopManagerFacade) as jasmine.SpyObj<LoopManagerFacade>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loops sorted by start time', () => {
    const sorted = component.sortedLoops();
    expect(sorted).toEqual(mockLoops); // Already sorted in mock data
    expect(sorted[0].startTime).toBeLessThan(sorted[1].startTime);
  });

  describe('Loop Display', () => {
    it('should show loop count in header', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.list-title').textContent).toContain('Boucles (2)');
    });

    it('should display loop properties correctly', () => {
      const loop = mockLoops[0];
      expect(component.formatTimeRange(loop)).toBe('0:30 - 1:00');
      expect(component.calculateDuration(loop)).toBe(30);
      expect(component.formatDuration(30)).toBe('0:30');
      expect(component.getSpeedLabel(1.0)).toBe('1x');
      expect(component.getRepeatLabel(1)).toBe('1 fois');
      expect(component.getRepeatLabel(3)).toBe('3 fois');
    });

    it('should identify active loop correctly', () => {
      expect(component.isActiveLoop(mockLoops[0])).toBe(true);
      expect(component.isActiveLoop(mockLoops[1])).toBe(false);
    });
  });

  describe('Loop Actions', () => {
    it('should emit play action when play button clicked', () => {
      spyOn(component.loopAction, 'emit');
      const loop = mockLoops[0];
      
      component.onPlayLoop(loop);
      
      expect(component.loopAction.emit).toHaveBeenCalledWith({
        type: 'play',
        loop
      });
    });

    it('should emit edit action when edit button clicked', () => {
      spyOn(component.loopAction, 'emit');
      const loop = mockLoops[1];
      
      component.onEditLoop(loop);
      
      expect(component.loopAction.emit).toHaveBeenCalledWith({
        type: 'edit',
        loop
      });
    });

    it('should emit delete action when delete button clicked', () => {
      spyOn(component.loopAction, 'emit');
      const loop = mockLoops[0];
      
      component.onDeleteLoop(loop);
      
      expect(component.loopAction.emit).toHaveBeenCalledWith({
        type: 'delete',
        loop
      });
    });

    it('should emit duplicate action when duplicate button clicked', () => {
      spyOn(component.loopAction, 'emit');
      const loop = mockLoops[1];
      
      component.onDuplicateLoop(loop);
      
      expect(component.loopAction.emit).toHaveBeenCalledWith({
        type: 'duplicate',
        loop
      });
    });

    it('should emit select event when loop card clicked', () => {
      spyOn(component.loopSelect, 'emit');
      const loop = mockLoops[0];
      
      component.onSelectLoop(loop);
      
      expect(component.loopSelect.emit).toHaveBeenCalledWith(loop);
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockFacade.vm.and.returnValue({
        loops: [],
        activeLoop: null,
        isLooping: false,
        hasLoops: false,
        totalLoops: 0,
        activeLoopIndex: -1,
        canStartLoop: false,
        lastError: null
      });
      fixture.detectChanges();
    });

    it('should show empty state when no loops exist', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.empty-state')).toBeTruthy();
      expect(compiled.querySelector('.empty-title').textContent).toContain('Aucune boucle');
    });

    it('should show loops count as 0', () => {
      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.list-title').textContent).toContain('Boucles (0)');
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle loop cards with different viewport sizes', () => {
      const compiled = fixture.nativeElement;
      const loopsGrid = compiled.querySelector('.loops-grid');
      expect(loopsGrid).toBeTruthy();
      
      // Grid should adapt based on CSS media queries
      expect(loopsGrid.classList.contains('loops-grid')).toBe(true);
    });

    it('should show action buttons appropriately', () => {
      const compiled = fixture.nativeElement;
      const actionButtons = compiled.querySelectorAll('.action-btn');
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () => {
    it('should calculate loop duration correctly', () => {
      const loop = mockLoops[0];
      expect(component.calculateDuration(loop)).toBe(30);
    });

    it('should format time range correctly', () => {
      const loop = mockLoops[1];
      expect(component.formatTimeRange(loop)).toBe('1:30 - 2:00');
    });

    it('should format speed labels correctly', () => {
      expect(component.getSpeedLabel(0.5)).toBe('0.5x');
      expect(component.getSpeedLabel(2.0)).toBe('2x');
    });

    it('should format repeat labels correctly', () => {
      expect(component.getRepeatLabel(1)).toBe('1 fois');
      expect(component.getRepeatLabel(5)).toBe('5 fois');
      expect(component.getRepeatLabel(undefined)).toBe('1 fois');
    });
  });
});
