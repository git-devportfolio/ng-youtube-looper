import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';

import { SessionFormComponent } from './session-form.component';
import { SessionFacade } from '../../data-access';
import { LooperSession } from '@core/services/looper-storage.types';

describe('SessionFormComponent', () => {
  let component: SessionFormComponent;
  let fixture: ComponentFixture<SessionFormComponent>;
  let mockSessionFacade: jasmine.SpyObj<SessionFacade>;

  const mockSession: LooperSession = {
    id: 'test-session-1',
    name: 'Test Session',
    description: 'A test session',
    tags: ['test', 'guitar'],
    videoId: 'test-video',
    videoTitle: 'Test Video',
    videoUrl: 'https://youtube.com/watch?v=test',
    videoDuration: 180,
    loops: [],
    globalPlaybackSpeed: 1.0,
    currentTime: 0,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalPlayTime: 0,
    playCount: 0
  };

  beforeEach(async () => {
    const sessionFacadeSpy = jasmine.createSpyObj('SessionFacade', [
      'createSession',
      'updateSession',
      'sessionExistsByName'
    ], {
      isLoading: signal(false),
      lastError: signal(null)
    });

    await TestBed.configureTestingModule({
      imports: [SessionFormComponent, ReactiveFormsModule],
      providers: [
        { provide: SessionFacade, useValue: sessionFacadeSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionFormComponent);
    component = fixture.componentInstance;
    mockSessionFacade = TestBed.inject(SessionFacade) as jasmine.SpyObj<SessionFacade>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with empty values', () => {
    component.ngOnInit();
    
    expect(component.sessionForm.get('name')?.value).toBe('');
    expect(component.sessionForm.get('description')?.value).toBe('');
    expect(component.sessionForm.get('tags')?.value).toBe('');
  });

  it('should load session data in edit mode', () => {
    component.session = mockSession;
    component.ngOnInit();
    
    expect(component.sessionForm.get('name')?.value).toBe('Test Session');
    expect(component.sessionForm.get('description')?.value).toBe('A test session');
    expect(component.sessionForm.get('tags')?.value).toBe('test, guitar');
    expect(component.isEditMode()).toBe(true);
  });

  it('should validate required name field', () => {
    component.ngOnInit();
    const nameControl = component.sessionForm.get('name');
    
    nameControl?.setValue('');
    nameControl?.markAsTouched();
    
    expect(nameControl?.valid).toBeFalsy();
    expect(nameControl?.errors?.['required']).toBeTruthy();
  });

  it('should validate name length', () => {
    component.ngOnInit();
    const nameControl = component.sessionForm.get('name');
    
    // Too short
    nameControl?.setValue('a');
    expect(nameControl?.valid).toBeFalsy();
    expect(nameControl?.errors?.['minlength']).toBeTruthy();
    
    // Too long
    nameControl?.setValue('a'.repeat(51));
    expect(nameControl?.valid).toBeFalsy();
    expect(nameControl?.errors?.['maxlength']).toBeTruthy();
    
    // Valid length
    nameControl?.setValue('Valid Session Name');
    expect(nameControl?.valid).toBeTruthy();
  });

  it('should validate description length', () => {
    component.ngOnInit();
    const descControl = component.sessionForm.get('description');
    
    // Too long
    descControl?.setValue('a'.repeat(201));
    expect(descControl?.valid).toBeFalsy();
    expect(descControl?.errors?.['maxlength']).toBeTruthy();
    
    // Valid length
    descControl?.setValue('Valid description');
    expect(descControl?.valid).toBeTruthy();
  });

  it('should emit save event on valid form submission', async () => {
    component.videoId = 'test-video';
    component.videoTitle = 'Test Video';
    component.videoUrl = 'https://youtube.com/watch?v=test';
    component.videoDuration = 180;
    
    mockSessionFacade.createSession.and.returnValue(Promise.resolve({ success: true }));
    mockSessionFacade.updateSession.and.returnValue(Promise.resolve({ success: true }));
    
    spyOn(component.save, 'emit');
    
    component.ngOnInit();
    component.sessionForm.patchValue({
      name: 'Test Session',
      description: 'Test description',
      tags: 'test, guitar'
    });

    await component.onSubmit();

    expect(component.save.emit).toHaveBeenCalledWith({
      name: 'Test Session',
      description: 'Test description',
      tags: ['test', 'guitar']
    });
  });

  it('should emit cancel event', () => {
    spyOn(component.cancel, 'emit');
    
    component.onCancel();
    
    expect(component.cancel.emit).toHaveBeenCalled();
  });

  it('should format duration correctly', () => {
    expect(component.formatDuration(90)).toBe('1:30');
    expect(component.formatDuration(3661)).toBe('1:01:01');
    expect(component.formatDuration(45)).toBe('0:45');
  });

  it('should parse tags correctly', () => {
    component.ngOnInit();
    component.sessionForm.patchValue({ tags: 'tag1, tag2, tag3  ,  tag4  ' });
    
    const formData = (component as any).getFormData();
    expect(formData.tags).toEqual(['tag1', 'tag2', 'tag3', 'tag4']);
  });

  it('should handle empty tags', () => {
    component.ngOnInit();
    component.sessionForm.patchValue({ tags: '  ,  ,  ' });
    
    const formData = (component as any).getFormData();
    expect(formData.tags).toEqual([]);
  });

  it('should disable submit when form is invalid', () => {
    component.ngOnInit();
    component.sessionForm.patchValue({ name: '' }); // Invalid
    
    expect(component.canSubmit()).toBeFalsy();
  });

  it('should require video data for create mode', () => {
    component.session = null; // Create mode
    component.videoId = null;
    component.ngOnInit();
    
    component.sessionForm.patchValue({ name: 'Valid Name' });
    
    expect(component.canSubmit()).toBeFalsy();
  });
});