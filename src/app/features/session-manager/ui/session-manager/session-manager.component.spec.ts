import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { SessionManagerComponent } from './session-manager.component';
import { SessionFacade } from '../../data-access';
import { LooperSession, SessionHistoryEntry } from '@core/services/looper-storage.types';

describe('SessionManagerComponent', () => {
  let component: SessionManagerComponent;
  let fixture: ComponentFixture<SessionManagerComponent>;
  let mockSessionFacade: jasmine.SpyObj<SessionFacade>;

  const mockSessions: LooperSession[] = [
    {
      id: 'session-1',
      name: 'Test Session 1',
      videoId: 'video-1',
      videoTitle: 'Test Video 1',
      videoUrl: 'https://youtube.com/watch?v=test1',
      videoDuration: 300,
      loops: [],
      globalPlaybackSpeed: 1.0,
      currentTime: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalPlayTime: 0,
      playCount: 0
    }
  ];

  const mockHistory: SessionHistoryEntry[] = [
    {
      sessionId: 'session-1',
      sessionName: 'Test Session 1',
      videoId: 'video-1',
      videoTitle: 'Test Video 1',
      accessedAt: new Date(),
      duration: 150,
      loopsCount: 2,
      lastCurrentTime: 45
    }
  ];

  beforeEach(async () => {
    const sessionFacadeSpy = jasmine.createSpyObj('SessionFacade', [
      'loadSession',
      'deleteSession',
      'createSession',
      'updateSession',
      'exportSelectedSessions'
    ], {
      sessionList: signal(mockSessions),
      currentSession: signal(mockSessions[0]),
      filteredSessions: signal(mockSessions),
      recentSessions: signal([]),
      history: signal(mockHistory),
      isLoading: signal(false),
      lastError: signal(null),
      hasActiveSessions: signal(true)
    });

    await TestBed.configureTestingModule({
      imports: [SessionManagerComponent],
      providers: [
        { provide: SessionFacade, useValue: sessionFacadeSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionManagerComponent);
    component = fixture.componentInstance;
    mockSessionFacade = TestBed.inject(SessionFacade) as jasmine.SpyObj<SessionFacade>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with list view', () => {
    component.ngOnInit();
    expect(component.currentView()).toBe('list');
  });

  it('should set video context', () => {
    component.setVideoContext('test-video', 'Test Title', 'test-url', 300);
    
    const context = component.videoContext();
    expect(context).toEqual({
      videoId: 'test-video',
      videoTitle: 'Test Title',
      videoUrl: 'test-url',
      videoDuration: 300
    });
    
    expect(component.canCreateSession()).toBe(true);
  });

  it('should navigate between views', () => {
    component.navigateToView('history');
    expect(component.currentView()).toBe('history');

    component.navigateToView('import-export');
    expect(component.currentView()).toBe('import-export');

    component.navigateBack();
    expect(component.currentView()).toBe('list');
  });

  it('should navigate to create session', () => {
    component.setVideoContext('test-video', 'Test Title', 'test-url', 300);
    
    component.navigateToCreate();
    
    expect(component.currentView()).toBe('create');
  });

  it('should navigate to edit session', () => {
    component.navigateToEdit(mockSessions[0]);
    
    expect(component.currentView()).toBe('edit');
    expect(component.editingSession()).toBe(mockSessions[0]);
  });

  it('should handle session selection', () => {
    component.onSessionSelect(mockSessions[0]);
    
    expect(component.selectedSessions()).toContain('session-1');
    
    // Toggle selection
    component.onSessionSelect(mockSessions[0]);
    expect(component.selectedSessions()).not.toContain('session-1');
  });

  it('should load session', () => {
    component.onSessionLoad(mockSessions[0]);
    
    expect(mockSessionFacade.loadSession).toHaveBeenCalledWith('session-1');
  });

  it('should edit session', () => {
    component.onSessionEdit(mockSessions[0]);
    
    expect(component.currentView()).toBe('edit');
    expect(component.editingSession()).toBe(mockSessions[0]);
  });

  it('should delete session', async () => {
    mockSessionFacade.deleteSession.and.returnValue(Promise.resolve({ success: true }));
    component['_selectedSessions'].set(['session-1']);
    
    await component.onSessionDelete(mockSessions[0]);
    
    expect(mockSessionFacade.deleteSession).toHaveBeenCalledWith('session-1');
    expect(component.selectedSessions()).not.toContain('session-1');
  });

  it('should duplicate session', async () => {
    mockSessionFacade.createSession.and.returnValue(Promise.resolve({ success: true }));
    mockSessionFacade.updateSession.and.returnValue(Promise.resolve({ success: true }));
    
    await component.onSessionDuplicate(mockSessions[0]);
    
    expect(mockSessionFacade.createSession).toHaveBeenCalledWith(
      'Test Session 1 (Copie)',
      'video-1',
      'Test Video 1',
      'https://youtube.com/watch?v=test1',
      300
    );
  });

  it('should handle session form save', () => {
    component['_currentView'].set('create');
    
    component.onSessionSave({ name: 'New Session', description: '', tags: [] });
    
    expect(component.currentView()).toBe('list');
  });

  it('should handle session form cancel', () => {
    component['_currentView'].set('edit');
    
    component.onSessionCancel();
    
    expect(component.currentView()).toBe('list');
  });

  it('should manage bulk operations', () => {
    component.selectAllSessions();
    expect(component.selectedSessions()).toEqual(['session-1']);
    
    component.clearSelectedSessions();
    expect(component.selectedSessions()).toEqual([]);
  });

  it('should export selected sessions', async () => {
    component['_selectedSessions'].set(['session-1']);
    mockSessionFacade.exportSelectedSessions.and.returnValue(Promise.resolve({ success: true }));
    
    await component.exportSelectedSessions();
    
    expect(mockSessionFacade.exportSelectedSessions).toHaveBeenCalledWith(['session-1']);
    expect(component.selectedSessions()).toEqual([]);
  });

  it('should load session from history', async () => {
    mockSessionFacade.loadSession.and.returnValue(Promise.resolve(true));
    
    await component.loadSessionFromHistory(mockHistory[0]);
    
    expect(mockSessionFacade.loadSession).toHaveBeenCalledWith('session-1');
    expect(component.currentView()).toBe('list');
  });

  it('should create session from history entry', () => {
    component.createSessionFromHistory(mockHistory[0]);
    
    const context = component.videoContext();
    expect(context?.videoId).toBe('video-1');
    expect(context?.videoTitle).toBe('Test Video 1');
    expect(component.currentView()).toBe('create');
  });

  it('should format duration correctly', () => {
    expect(component.formatDuration(90)).toBe('1:30');
    expect(component.formatDuration(3661)).toBe('1:01:01');
  });

  it('should format relative dates', () => {
    const now = new Date();
    const minuteAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const hourAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    
    expect(component.formatRelativeDate(minuteAgo)).toBe('Il y a 2 min');
    expect(component.formatRelativeDate(hourAgo)).toBe('Il y a 2h');
    expect(component.formatRelativeDate(dayAgo)).toBe('Hier');
  });

  it('should compute view states correctly', () => {
    expect(component.showBackButton()).toBe(false);
    
    component.navigateToView('create');
    expect(component.showBackButton()).toBe(true);
    
    expect(component.viewTitle()).toBe('Nouvelle Session');
  });

  it('should track history entries by ID', () => {
    const trackId = component.trackHistoryById(0, mockHistory[0]);
    expect(trackId).toBe('session-1');
  });
});