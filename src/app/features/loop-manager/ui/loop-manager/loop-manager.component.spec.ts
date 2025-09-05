import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LoopManagerComponent } from './loop-manager.component';
import { LoopManagerFacade } from '../../data-access/loop-manager.facade';
import { LoopSegment } from '@core/models/loop.model';

describe('LoopManagerComponent', () => {
  let component: LoopManagerComponent;
  let fixture: ComponentFixture<LoopManagerComponent>;
  let mockLoopManagerFacade: jasmine.SpyObj<LoopManagerFacade>;

  const mockLoops: LoopSegment[] = [
    {
      id: '1',
      name: 'Test Loop 1',
      startTime: 30,
      endTime: 60,
      color: '#ff0000',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'Test Loop 2', 
      startTime: 90,
      endTime: 120,
      color: '#00ff00',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('LoopManagerFacade', [
      'createLoop',
      'updateLoop', 
      'deleteLoop',
      'playLoop',
      'stopLoop'
    ], {
      loops: signal(mockLoops),
      currentLoop: signal(null),
      isLoading: signal(false),
      error: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [LoopManagerComponent],
      providers: [
        { provide: LoopManagerFacade, useValue: spy }
      ]
    }).compileComponents();

    mockLoopManagerFacade = TestBed.inject(LoopManagerFacade) as jasmine.SpyObj<LoopManagerFacade>;
    fixture = TestBed.createComponent(LoopManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loops in view model', () => {
    expect(component.vm().loops).toEqual(mockLoops);
    expect(component.vm().totalLoops).toBe(2);
    expect(component.vm().hasLoops).toBe(true);
  });

  it('should handle add loop action', () => {
    component.onAddLoop();
    expect(component.showAddForm()).toBe(true);
    expect(component.editingLoopId()).toBe(null);
  });

  it('should handle edit loop action', () => {
    const loop = mockLoops[0];
    component.onEditLoop(loop);
    expect(component.showAddForm()).toBe(true);
    expect(component.editingLoopId()).toBe(loop.id);
  });

  it('should handle delete loop action', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const loop = mockLoops[0];
    
    component.onDeleteLoop(loop);
    
    expect(window.confirm).toHaveBeenCalled();
    expect(mockLoopManagerFacade.deleteLoop).toHaveBeenCalledWith(loop.id);
  });

  it('should not delete loop if not confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const loop = mockLoops[0];
    
    component.onDeleteLoop(loop);
    
    expect(window.confirm).toHaveBeenCalled();
    expect(mockLoopManagerFacade.deleteLoop).not.toHaveBeenCalled();
  });

  it('should handle duplicate loop action', () => {
    const loop = mockLoops[0];
    
    component.onDuplicateLoop(loop);
    
    expect(mockLoopManagerFacade.createLoop).toHaveBeenCalledWith(
      jasmine.objectContaining({
        name: 'Test Loop 1 (copie)',
        startTime: loop.startTime,
        endTime: loop.endTime,
        color: loop.color
      })
    );
  });

  it('should handle play loop action', () => {
    const loop = mockLoops[0];
    
    component.onPlayLoop(loop);
    
    expect(mockLoopManagerFacade.playLoop).toHaveBeenCalledWith(loop.id);
  });

  it('should handle search functionality', () => {
    component.onSearch('Test Loop 1');
    expect(component.searchTerm()).toBe('Test Loop 1');
    
    const filteredLoops = component.vm().loops;
    expect(filteredLoops).toHaveLength(1);
    expect(filteredLoops[0].name).toBe('Test Loop 1');
  });

  it('should handle sort functionality', () => {
    component.onSortChange('startTime');
    expect(component.sortBy()).toBe('startTime');
    expect(component.sortDirection()).toBe('asc');
    
    // Toggle direction
    component.onSortChange('startTime');
    expect(component.sortDirection()).toBe('desc');
  });

  it('should format time correctly', () => {
    expect(component.formatTime(90)).toBe('1:30');
    expect(component.formatTime(30)).toBe('0:30');
    expect(component.formatTime(125)).toBe('2:05');
  });

  it('should format duration correctly', () => {
    expect(component.formatDuration(30, 90)).toBe('1:00');
    expect(component.formatDuration(0, 45)).toBe('0:45');
  });
});