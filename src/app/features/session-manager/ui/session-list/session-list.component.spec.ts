import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';

import { SessionListComponent } from './session-list.component';
import { SessionFacade } from '../../data-access';
import { LooperSession } from '@core/services/looper-storage.types';

describe('SessionListComponent', () => {
  let component: SessionListComponent;
  let fixture: ComponentFixture<SessionListComponent>;
  let mockSessionFacade: jasmine.SpyObj<SessionFacade>;

  const mockSessions: LooperSession[] = [
    {
      id: 'session-1',
      name: 'Guitar Solo Practice',
      description: 'Working on solo techniques',
      tags: ['guitar', 'solo'],
      videoId: 'video-1',
      videoTitle: 'Amazing Guitar Solo Tutorial',
      videoUrl: 'https://youtube.com/watch?v=test1',
      videoDuration: 300,
      loops: [
        { id: 'loop-1', startTime: 30, endTime: 60, name: 'Solo Part 1' }
      ],
      globalPlaybackSpeed: 1.0,
      currentTime: 45,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
      totalPlayTime: 150,
      playCount: 5
    },
    {
      id: 'session-2',
      name: 'Bass Line Study',
      videoId: 'video-2',
      videoTitle: 'Bass Tutorial',
      videoUrl: 'https://youtube.com/watch?v=test2',
      videoDuration: 240,
      loops: [],
      globalPlaybackSpeed: 0.8,
      currentTime: 0,
      isActive: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      totalPlayTime: 60,
      playCount: 2
    }
  ];

  beforeEach(async () => {
    const sessionFacadeSpy = jasmine.createSpyObj('SessionFacade', [
      'setSearchQuery',
      'setVideoFilter'
    ], {
      sessionList: signal(mockSessions),
      filteredSessions: signal(mockSessions),
      currentSession: signal(mockSessions[0]),
      isLoading: signal(false),
      lastError: signal(null),
      hasActiveSessions: signal(true)
    });

    await TestBed.configureTestingModule({
      imports: [SessionListComponent, FormsModule],
      providers: [
        { provide: SessionFacade, useValue: sessionFacadeSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionListComponent);
    component = fixture.componentInstance;
    mockSessionFacade = TestBed.inject(SessionFacade) as jasmine.SpyObj<SessionFacade>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display sessions', () => {
    fixture.detectChanges();
    
    const sessionCards = fixture.nativeElement.querySelectorAll('.session-card');
    expect(sessionCards.length).toBe(2);
  });

  it('should emit sessionSelect when session is clicked', () => {
    spyOn(component.sessionSelect, 'emit');
    
    component.onSessionSelect(mockSessions[0]);
    
    expect(component.sessionSelect.emit).toHaveBeenCalledWith(mockSessions[0]);
    expect(component.selectedSessionId()).toBe('session-1');
  });

  it('should emit sessionLoad when load button is clicked', () => {
    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    spyOn(component.sessionLoad, 'emit');
    
    component.onSessionLoad(mockSessions[0], mockEvent);
    
    expect(component.sessionLoad.emit).toHaveBeenCalledWith(mockSessions[0]);
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should emit sessionEdit when edit button is clicked', () => {
    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    spyOn(component.sessionEdit, 'emit');
    
    component.onSessionEdit(mockSessions[0], mockEvent);
    
    expect(component.sessionEdit.emit).toHaveBeenCalledWith(mockSessions[0]);
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should show delete confirmation when delete button is clicked', () => {
    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    
    component.onSessionDelete(mockSessions[0], mockEvent);
    
    expect(component.confirmingDeleteId()).toBe('session-1');
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should emit sessionDelete when delete is confirmed', () => {
    spyOn(component.sessionDelete, 'emit');
    
    component.confirmDelete(mockSessions[0]);
    
    expect(component.sessionDelete.emit).toHaveBeenCalledWith(mockSessions[0]);
    expect(component.confirmingDeleteId()).toBeNull();
  });

  it('should cancel delete confirmation', () => {
    component['_confirmingDeleteId'].set('session-1');
    
    component.cancelDelete();
    
    expect(component.confirmingDeleteId()).toBeNull();
  });

  it('should emit sessionDuplicate when duplicate button is clicked', () => {
    const mockEvent = { stopPropagation: jasmine.createSpy() } as any;
    spyOn(component.sessionDuplicate, 'emit');
    
    component.onSessionDuplicate(mockSessions[0], mockEvent);
    
    expect(component.sessionDuplicate.emit).toHaveBeenCalledWith(mockSessions[0]);
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  it('should calculate total session duration correctly', () => {
    const duration = component.getTotalSessionDuration(mockSessions[0]);
    expect(duration).toBe(30); // 60 - 30 = 30 seconds
  });

  it('should format duration correctly', () => {
    expect(component.formatDuration(90)).toBe('1:30');
    expect(component.formatDuration(3661)).toBe('1:01:01');
    expect(component.formatDuration(45)).toBe('0:45');
  });

  it('should format date correctly', () => {
    const testDate = new Date('2025-01-15T10:30:00');
    const formatted = component.formatDate(testDate);
    
    // Should contain date elements (exact format may vary by locale)
    expect(formatted).toContain('15');
    expect(formatted).toContain('janv.');
    expect(formatted).toContain('2025');
  });

  it('should identify active session correctly', () => {
    expect(component.isSessionActive(mockSessions[0])).toBe(true);
    expect(component.isSessionActive(mockSessions[1])).toBe(false);
  });

  it('should track sessions by ID', () => {
    const trackId = component.trackSessionById(0, mockSessions[0]);
    expect(trackId).toBe('session-1');
  });

  it('should handle search query changes', () => {
    component.onSearchChange('test query');
    
    expect(mockSessionFacade.setSearchQuery).toHaveBeenCalledWith('test query');
  });

  it('should clear search', () => {
    component['_searchQuery'].set('test query');
    
    component.clearSearch();
    
    expect(component.searchQuery()).toBe('');
  });

  it('should handle sorting', () => {
    component.setSortBy('name');
    expect(component.sortBy()).toBe('name');
    expect(component.sortAscending()).toBe(true);
    
    // Toggle sort direction
    component.setSortBy('name');
    expect(component.sortAscending()).toBe(false);
    
    // Different sort field
    component.setSortBy('date');
    expect(component.sortBy()).toBe('date');
    expect(component.sortAscending()).toBe(false); // Date defaults to descending
  });

  it('should get session stats correctly', () => {
    const stats = component.getSessionStats(mockSessions[0]);
    
    expect(stats.loopsCount).toBe(1);
    expect(stats.totalDuration).toBe('0:30');
    expect(stats.totalPlayTime).toBe('2:30');
  });

  it('should generate sort icons correctly', () => {
    component['_sortBy'].set('name');
    component['_sortAscending'].set(true);
    
    expect(component.getSortIcon('name')).toBe('↑');
    expect(component.getSortIcon('date')).toBe('↕');
    
    component['_sortAscending'].set(false);
    expect(component.getSortIcon('name')).toBe('↓');
  });
});