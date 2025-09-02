import { TestBed } from '@angular/core/testing';
import { LoopManagerFacade } from './loop-manager.facade';
import { LoopService } from '@core/services/loop.service';
import { ValidationService } from '@core/services/validation.service';
import { SecureStorageService } from '@core/services/storage.service';
import { CreateLoopRequest } from '@shared/interfaces';

describe('LoopManagerFacade', () => {
  let facade: LoopManagerFacade;
  let loopService: jasmine.SpyObj<LoopService>;
  let validationService: jasmine.SpyObj<ValidationService>;
  let storageService: jasmine.SpyObj<SecureStorageService>;

  beforeEach(async () => {
    const loopServiceSpy = jasmine.createSpyObj('LoopService', [
      'createLoopFromRequest',
      'updateLoop',
      'deleteLoop',
      'setActiveLoop',
      'getLoopById',
      'setCurrentVideoId',
      'getLoopProgress',
      'clearAllLoops',
      'formatTime',
      'parseTime',
      'findOverlappingLoops'
    ], {
      loops: jasmine.createSpy('loops').and.returnValue([]),
      activeLoop: jasmine.createSpy('activeLoop').and.returnValue(null),
      activeLoopId: jasmine.createSpy('activeLoopId').and.returnValue(null),
      lastError: jasmine.createSpy('lastError').and.returnValue(null)
    });

    const validationServiceSpy = jasmine.createSpyObj('ValidationService', [
      'isValidLoopName',
      'isValidTimeRange',
      'isValidPlaybackSpeed'
    ]);

    const storageServiceSpy = jasmine.createSpyObj('SecureStorageService', [
      'getItem',
      'setItem',
      'removeItem'
    ]);

    await TestBed.configureTestingModule({
      providers: [
        LoopManagerFacade,
        { provide: LoopService, useValue: loopServiceSpy },
        { provide: ValidationService, useValue: validationServiceSpy },
        { provide: SecureStorageService, useValue: storageServiceSpy }
      ]
    }).compileComponents();

    facade = TestBed.inject(LoopManagerFacade);
    loopService = TestBed.inject(LoopService) as jasmine.SpyObj<LoopService>;
    validationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
    storageService = TestBed.inject(SecureStorageService) as jasmine.SpyObj<SecureStorageService>;
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('ViewModel', () => {
    it('should provide main ViewModel with correct structure', () => {
      const vm = facade.vm();
      expect(vm).toEqual({
        loops: [],
        activeLoop: null,
        isLooping: false,
        hasLoops: false,
        canStartLoop: false,
        totalLoops: 0,
        activeLoopIndex: -1,
        lastError: null
      });
    });

    it('should provide timeline ViewModel with correct structure', () => {
      const timelineVm = facade.timelineVm();
      expect(timelineVm).toEqual({
        loops: [],
        activeLoopId: null,
        canCreateLoop: true,
        hasOverlaps: false
      });
    });
  });

  describe('Loop Commands', () => {
    it('should create loop through LoopService', () => {
      const request: CreateLoopRequest = {
        name: 'Test Loop',
        startTime: 10,
        endTime: 20
      };
      
      const expectedResult = { success: true, loop: { id: '1', ...request } };
      loopService.createLoopFromRequest.and.returnValue(expectedResult as any);

      const result = facade.createLoop(request);
      
      expect(loopService.createLoopFromRequest).toHaveBeenCalledWith(request);
      expect(result).toBe(expectedResult);
    });

    it('should update loop through LoopService', () => {
      const updateRequest = { id: '1', name: 'Updated Loop' };
      const expectedResult = { success: true, loop: { id: '1', name: 'Updated Loop' } };
      
      loopService.updateLoop.and.returnValue(expectedResult as any);

      const result = facade.editLoop(updateRequest);
      
      expect(loopService.updateLoop).toHaveBeenCalledWith(updateRequest);
      expect(result).toBe(expectedResult);
    });

    it('should delete loop through LoopService', () => {
      const loopId = '1';
      const expectedResult = { success: true };
      
      loopService.deleteLoop.and.returnValue(expectedResult as any);

      const result = facade.deleteLoop(loopId);
      
      expect(loopService.deleteLoop).toHaveBeenCalledWith(loopId);
      expect(result).toBe(expectedResult);
    });
  });

  describe('Loop Playback', () => {
    it('should select loop through LoopService', () => {
      const loopId = '1';
      loopService.setActiveLoop.and.returnValue(true);

      const result = facade.selectLoop(loopId);
      
      expect(loopService.setActiveLoop).toHaveBeenCalledWith(loopId);
      expect(result).toBe(true);
    });

    it('should start playing loop when valid loop exists', () => {
      const mockLoop = { id: '1', name: 'Test', startTime: 10, endTime: 20 };
      loopService.activeLoop = jasmine.createSpy('activeLoop').and.returnValue(mockLoop);

      const result = facade.playLoop();
      
      expect(result).toBe(true);
      expect(facade.vm().isLooping).toBe(true);
    });

    it('should not start playing when no active loop', () => {
      loopService.activeLoop = jasmine.createSpy('activeLoop').and.returnValue(null);

      const result = facade.playLoop();
      
      expect(result).toBe(false);
    });

    it('should stop playing loop', () => {
      facade.stopLoop();
      expect(facade.vm().isLooping).toBe(false);
    });
  });

  describe('Video Integration', () => {
    it('should set video context', () => {
      const videoId = 'test-video-123';
      
      facade.setVideoContext(videoId);
      
      expect(loopService.setCurrentVideoId).toHaveBeenCalledWith(videoId);
    });

    it('should update video time', () => {
      const currentTime = 45.5;
      
      facade.updateVideoTime(currentTime);
      
      expect(facade.getLoopProgress()).toEqual(jasmine.any(Number));
    });
  });

  describe('Utility Methods', () => {
    it('should format time through LoopService', () => {
      const seconds = 125;
      const expectedFormat = '2:05';
      loopService.formatTime.and.returnValue(expectedFormat);

      const result = facade.formatTime(seconds);
      
      expect(loopService.formatTime).toHaveBeenCalledWith(seconds);
      expect(result).toBe(expectedFormat);
    });

    it('should parse time through LoopService', () => {
      const timeString = '1:30';
      const expectedSeconds = 90;
      loopService.parseTime.and.returnValue(expectedSeconds);

      const result = facade.parseTime(timeString);
      
      expect(loopService.parseTime).toHaveBeenCalledWith(timeString);
      expect(result).toBe(expectedSeconds);
    });
  });

  describe('Loop Progress Tracking', () => {
    it('should calculate loop progress for active loop', () => {
      const mockLoop = { 
        id: '1', 
        name: 'Test',
        startTime: 10, 
        endTime: 20,
        playCount: 0,
        isActive: true,
        playbackSpeed: 1
      };
      const currentTime = 15;
      
      loopService.activeLoop = jasmine.createSpy('activeLoop').and.returnValue(mockLoop);
      loopService.getLoopProgress.and.returnValue(50);
      
      facade.updateVideoTime(currentTime);
      const progress = facade.getLoopProgress();
      
      expect(loopService.getLoopProgress).toHaveBeenCalledWith(currentTime, mockLoop);
      expect(progress).toBe(50);
    });

    it('should determine if loop should repeat', () => {
      const mockLoop = { 
        id: '1', 
        name: 'Test',
        startTime: 10, 
        endTime: 20,
        repeatCount: 3,
        playCount: 0,
        isActive: true,
        playbackSpeed: 1
      };
      
      loopService.activeLoop = jasmine.createSpy('activeLoop').and.returnValue(mockLoop);
      
      // Set up looping state
      facade.playLoop();
      facade.updateVideoTime(20.1); // Past the end time
      
      const shouldRepeat = facade.shouldRepeatLoop();
      expect(shouldRepeat).toBe(true);
    });
  });
});