import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { LoopFormComponent, LoopFormResult } from './loop-form.component';
import { LoopManagerFacade } from '../../services/loop-manager.facade';
import { LoopSegment, CreateLoopRequest, UpdateLoopRequest } from '@shared/interfaces';

describe('LoopFormComponent', () => {
  let component: LoopFormComponent;
  let fixture: ComponentFixture<LoopFormComponent>;
  let mockFacade: jasmine.SpyObj<LoopManagerFacade>;

  beforeEach(async () => {
    const facadeSpy = jasmine.createSpyObj('LoopManagerFacade', [
      'formatTime',
      'parseTime'
    ]);

    facadeSpy.formatTime.and.returnValue('1:30');
    facadeSpy.parseTime.and.returnValue(90);

    await TestBed.configureTestingModule({
      imports: [LoopFormComponent, ReactiveFormsModule],
      providers: [
        { provide: LoopManagerFacade, useValue: facadeSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoopFormComponent);
    component = fixture.componentInstance;
    mockFacade = TestBed.inject(LoopManagerFacade) as jasmine.SpyObj<LoopManagerFacade>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with default values', () => {
    expect(component.loopForm.get('name')?.value).toBe('');
    expect(component.loopForm.get('startTimeText')?.value).toBe('0:00');
    expect(component.loopForm.get('endTimeText')?.value).toBe('0:30');
    expect(component.loopForm.get('playbackSpeed')?.value).toBe(1.0);
    expect(component.loopForm.get('repeatCount')?.value).toBe(1);
    expect(component.loopForm.get('color')?.value).toBe('#3B82F6');
  });

  describe('Edit Mode', () => {
    beforeEach(() => {
      const mockLoop: LoopSegment = {
        id: '1',
        name: 'Test Loop',
        startTime: 60,
        endTime: 120,
        playbackSpeed: 0.5,
        repeatCount: 3,
        color: '#EF4444',
        playCount: 0,
        isActive: true
      };
      
      component.editingLoop = mockLoop;
      component.ngOnChanges({ editingLoop: { currentValue: mockLoop, previousValue: null, firstChange: true, isFirstChange: () => true } });
    });

    it('should populate form with editing loop data', () => {
      expect(mockFacade.formatTime).toHaveBeenCalledWith(60);
      expect(mockFacade.formatTime).toHaveBeenCalledWith(120);
      expect(component.loopForm.get('name')?.value).toBe('Test Loop');
      expect(component.loopForm.get('playbackSpeed')?.value).toBe(0.5);
      expect(component.loopForm.get('repeatCount')?.value).toBe(3);
      expect(component.loopForm.get('color')?.value).toBe('#EF4444');
    });

    it('should show edit mode title and button text', () => {
      expect(component.isEditMode).toBe(true);
      expect(component.formTitle).toBe('Modifier la boucle');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', () => {
      component.loopForm.patchValue({
        name: '',
        startTimeText: '',
        endTimeText: ''
      });
      
      expect(component.loopForm.invalid).toBe(true);
      expect(component.nameControl?.hasError('required')).toBe(true);
      expect(component.startTimeControl?.hasError('required')).toBe(true);
      expect(component.endTimeControl?.hasError('required')).toBe(true);
    });

    it('should validate time format', () => {
      component.loopForm.patchValue({
        startTimeText: 'invalid',
        endTimeText: '99:99'
      });
      
      expect(component.startTimeControl?.hasError('invalidTimeFormat')).toBe(true);
      expect(component.endTimeControl?.hasError('invalidTimeFormat')).toBe(true);
    });

    it('should validate time range (end > start)', () => {
      mockFacade.parseTime.and.callFake((timeString: string) => {
        if (timeString === '2:00') return 120;
        if (timeString === '1:00') return 60;
        return 0;
      });

      component.loopForm.patchValue({
        startTimeText: '2:00',
        endTimeText: '1:00'
      });
      
      expect(component.loopForm.hasError('invalidTimeRange')).toBe(true);
    });

    it('should validate video duration', () => {
      component.videoDuration = 60;
      mockFacade.parseTime.and.returnValue(90);
      
      component.loopForm.patchValue({
        endTimeText: '1:30'
      });
      
      expect(component.loopForm.hasError('exceedsVideoDuration')).toBe(true);
    });

    it('should validate playback speed range', () => {
      component.loopForm.patchValue({
        playbackSpeed: 3.0
      });
      
      expect(component.playbackSpeedControl?.hasError('max')).toBe(true);
      
      component.loopForm.patchValue({
        playbackSpeed: 0.1
      });
      
      expect(component.playbackSpeedControl?.hasError('min')).toBe(true);
    });
  });

  describe('Form Submission', () => {
    it('should emit create request for new loop', () => {
      spyOn(component.formSubmit, 'emit');
      mockFacade.parseTime.and.callFake((timeString: string) => {
        if (timeString === '1:00') return 60;
        if (timeString === '2:00') return 120;
        return 0;
      });

      component.loopForm.patchValue({
        name: 'New Loop',
        startTimeText: '1:00',
        endTimeText: '2:00',
        playbackSpeed: 0.75,
        repeatCount: 2,
        color: '#10B981'
      });

      component.onSubmit();

      const expectedRequest: CreateLoopRequest = {
        name: 'New Loop',
        startTime: 60,
        endTime: 120,
        playbackSpeed: 0.75,
        repeatCount: 2,
        color: '#10B981'
      };

      expect(component.formSubmit.emit).toHaveBeenCalledWith({
        type: 'create',
        data: expectedRequest
      });
    });

    it('should emit update request for editing loop', () => {
      spyOn(component.formSubmit, 'emit');
      mockFacade.parseTime.and.callFake((timeString: string) => {
        if (timeString === '1:00') return 60;
        if (timeString === '2:00') return 120;
        return 0;
      });

      const editingLoop: LoopSegment = {
        id: 'edit-1',
        name: 'Original',
        startTime: 30,
        endTime: 60,
        playbackSpeed: 1,
        playCount: 0,
        isActive: true
      };

      component.editingLoop = editingLoop;
      component.loopForm.patchValue({
        name: 'Updated Loop',
        startTimeText: '1:00',
        endTimeText: '2:00'
      });

      component.onSubmit();

      const expectedRequest: UpdateLoopRequest = {
        id: 'edit-1',
        name: 'Updated Loop',
        startTime: 60,
        endTime: 120,
        playbackSpeed: 1.0,
        repeatCount: 1,
        color: '#3B82F6'
      };

      expect(component.formSubmit.emit).toHaveBeenCalledWith({
        type: 'update',
        data: expectedRequest
      });
    });

    it('should not submit invalid form', () => {
      spyOn(component.formSubmit, 'emit');
      
      component.loopForm.patchValue({
        name: '', // Invalid - required
        startTimeText: 'invalid'
      });

      component.onSubmit();

      expect(component.formSubmit.emit).not.toHaveBeenCalled();
    });
  });

  describe('Error Messages', () => {
    it('should provide appropriate error messages for name field', () => {
      const nameControl = component.nameControl;
      nameControl?.setValue('');
      nameControl?.markAsTouched();
      
      expect(component.getNameErrorMessage()).toBe('Le nom est requis');
    });

    it('should provide appropriate error messages for time fields', () => {
      const startControl = component.startTimeControl;
      startControl?.setValue('invalid');
      startControl?.markAsTouched();
      
      expect(component.getStartTimeErrorMessage()).toBe('Format invalide (utilisez MM:SS ou MM:SS.sss)');
    });

    it('should provide form-level error messages', () => {
      component.loopForm.setErrors({ invalidTimeRange: true });
      component.loopForm.markAsTouched();
      
      expect(component.getFormErrorMessage()).toBe('L\'heure de fin doit être supérieure à l\'heure de début');
    });
  });

  describe('Form Actions', () => {
    it('should emit cancel event and reset form', () => {
      spyOn(component.formCancel, 'emit');
      
      component.loopForm.patchValue({ name: 'Test' });
      component.onCancel();
      
      expect(component.formCancel.emit).toHaveBeenCalled();
      expect(component.loopForm.get('name')?.value).toBe('');
    });

    it('should reset form to default values', () => {
      component.loopForm.patchValue({
        name: 'Test',
        startTimeText: '1:00',
        playbackSpeed: 2.0
      });

      component.resetForm();

      expect(component.loopForm.get('name')?.value).toBe('');
      expect(component.loopForm.get('startTimeText')?.value).toBe('0:00');
      expect(component.loopForm.get('playbackSpeed')?.value).toBe(1.0);
    });
  });
});
