import { TestBed } from '@angular/core/testing';
import { LoopService, Loop, LoopValidationError, DEFAULT_LOOP_CONFIG } from './loop.service';
import { ValidationService } from './validation.service';

describe('LoopService', () => {
  let service: LoopService;
  let validationService: jasmine.SpyObj<ValidationService>;

  const mockValidationService = {
    isValidLoopName: jasmine.createSpy('isValidLoopName'),
    isValidPlaybackSpeed: jasmine.createSpy('isValidPlaybackSpeed'),
    isValidTimeRange: jasmine.createSpy('isValidTimeRange'),
    formatTime: jasmine.createSpy('formatTime').and.returnValue('1:30'),
    parseTime: jasmine.createSpy('parseTime').and.returnValue(90)
  };

  beforeEach(() => {
    // Set default return values for mocks
    mockValidationService.isValidLoopName.and.returnValue(true);
    mockValidationService.isValidPlaybackSpeed.and.returnValue(true);
    mockValidationService.isValidTimeRange.and.returnValue(true);
    
    TestBed.configureTestingModule({
      providers: [
        LoopService,
        { provide: ValidationService, useValue: mockValidationService }
      ]
    });
    service = TestBed.inject(LoopService);
    validationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
  });

  afterEach(() => {
    // Reset spies and set default return values
    mockValidationService.isValidLoopName.calls.reset();
    mockValidationService.isValidLoopName.and.returnValue(true);
    mockValidationService.isValidPlaybackSpeed.calls.reset();
    mockValidationService.isValidPlaybackSpeed.and.returnValue(true);
    mockValidationService.isValidTimeRange.calls.reset();
    mockValidationService.isValidTimeRange.and.returnValue(true);
    mockValidationService.formatTime.calls.reset();
    mockValidationService.parseTime.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createLoop', () => {
    it('should create a loop with required parameters', () => {
      const loop = service.createLoop('Test Loop', 10, 20);
      
      expect(loop.id).toMatch(/^loop-\d+-[a-z0-9]+$/);
      expect(loop.name).toBe('Test Loop');
      expect(loop.startTime).toBe(10);
      expect(loop.endTime).toBe(20);
      expect(loop.color).toBe(DEFAULT_LOOP_CONFIG.color);
      expect(loop.playbackSpeed).toBe(DEFAULT_LOOP_CONFIG.playbackSpeed);
      expect(loop.playCount).toBe(DEFAULT_LOOP_CONFIG.playCount);
      expect(loop.isActive).toBe(DEFAULT_LOOP_CONFIG.isActive);
    });

    it('should create a loop with custom options', () => {
      const options = {
        color: '#FF0000',
        playbackSpeed: 1.5,
        repeatCount: 3,
        isActive: true
      };
      
      const loop = service.createLoop('Custom Loop', 5, 15, options);
      
      expect(loop.color).toBe('#FF0000');
      expect(loop.playbackSpeed).toBe(1.5);
      expect(loop.repeatCount).toBe(3);
      expect(loop.isActive).toBe(true);
    });

    it('should trim the loop name', () => {
      const loop = service.createLoop('  Trimmed Loop  ', 0, 10);
      expect(loop.name).toBe('Trimmed Loop');
    });

    it('should generate unique IDs for different loops', () => {
      const loop1 = service.createLoop('Loop 1', 0, 10);
      const loop2 = service.createLoop('Loop 2', 10, 20);
      
      expect(loop1.id).not.toBe(loop2.id);
    });
  });

  describe('validateLoop', () => {
    let mockLoop: Loop;

    beforeEach(() => {
      mockLoop = service.createLoop('Test Loop', 10, 20);
    });

    it('should validate a valid loop', () => {
      const result = service.validateLoop(mockLoop);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(validationService.isValidLoopName).toHaveBeenCalledWith('Test Loop');
    });

    it('should detect invalid loop name', () => {
      validationService.isValidLoopName.and.returnValue(false);
      
      const result = service.validateLoop(mockLoop);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.INVALID_NAME);
    });

    it('should detect invalid time range', () => {
      const invalidLoop = service.createLoop('Invalid', 20, 10); // end before start
      
      const result = service.validateLoop(invalidLoop);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.ZERO_DURATION);
    });

    it('should detect negative times', () => {
      const invalidLoop = service.createLoop('Negative', -5, 10);
      
      const result = service.validateLoop(invalidLoop);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.NEGATIVE_TIME);
    });

    it('should detect loop exceeding video duration', () => {
      const longLoop = service.createLoop('Long', 10, 100);
      const videoDuration = 50;
      
      const result = service.validateLoop(longLoop, videoDuration);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.EXCEEDS_VIDEO_DURATION);
    });

    it('should detect overlapping loops', () => {
      const loop1 = service.createLoop('Loop 1', 10, 30);
      const loop2 = service.createLoop('Loop 2', 20, 40); // Overlaps with loop1
      
      const result = service.validateLoop(loop2, undefined, [loop1]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.OVERLAPPING_LOOPS);
      expect(result.warnings).toContain('Overlaps with loops: Loop 1');
    });

    it('should detect invalid playback speed', () => {
      validationService.isValidPlaybackSpeed.and.returnValue(false);
      mockLoop.playbackSpeed = 5.0;
      
      const result = service.validateLoop(mockLoop);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(LoopValidationError.INVALID_PLAYBACK_SPEED);
    });

    it('should warn about loops covering large portion of video', () => {
      const longLoop = service.createLoop('Long', 0, 90);
      const videoDuration = 100;
      
      const result = service.validateLoop(longLoop, videoDuration);
      
      expect(result.warnings).toContain('Loop covers more than 80% of video duration');
    });
  });

  describe('isValidTimeRange', () => {
    it('should validate time range without video duration', () => {
      const result = service.isValidTimeRange(10, 20);
      expect(result).toBe(true);
    });

    it('should validate time range with video duration', () => {
      service.isValidTimeRange(10, 20, 100);
      expect(validationService.isValidTimeRange).toHaveBeenCalledWith(10, 20, 100);
    });

    it('should reject invalid time ranges', () => {
      const result1 = service.isValidTimeRange(20, 10);
      const result2 = service.isValidTimeRange(-5, 10);
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('calculateLoopDuration', () => {
    it('should calculate loop duration correctly', () => {
      const loop = service.createLoop('Test', 10, 35);
      const duration = service.calculateLoopDuration(loop);
      
      expect(duration).toBe(25);
    });

    it('should return 0 for invalid loops', () => {
      const invalidLoop = service.createLoop('Invalid', 20, 10);
      const duration = service.calculateLoopDuration(invalidLoop);
      
      expect(duration).toBe(0);
    });
  });

  describe('formatTime and parseTime', () => {
    it('should delegate to ValidationService for formatting', () => {
      const result = service.formatTime(90);
      
      expect(validationService.formatTime).toHaveBeenCalledWith(90);
      expect(result).toBe('1:30');
    });

    it('should delegate to ValidationService for parsing', () => {
      const result = service.parseTime('1:30');
      
      expect(validationService.parseTime).toHaveBeenCalledWith('1:30');
      expect(result).toBe(90);
    });
  });

  describe('findOverlappingLoops', () => {
    it('should find overlapping loops', () => {
      const loop1 = service.createLoop('Loop 1', 10, 30);
      const loop2 = service.createLoop('Loop 2', 20, 40);
      const loop3 = service.createLoop('Loop 3', 50, 60);
      const existingLoops = [loop1, loop3];
      
      const overlapping = service.findOverlappingLoops(loop2, existingLoops);
      
      expect(overlapping).toHaveSize(1);
      expect(overlapping[0].id).toBe(loop1.id);
    });

    it('should not include the same loop in overlapping results', () => {
      const loop1 = service.createLoop('Loop 1', 10, 30);
      const existingLoops = [loop1];
      
      const overlapping = service.findOverlappingLoops(loop1, existingLoops);
      
      expect(overlapping).toHaveSize(0);
    });
  });

  describe('utility methods', () => {
    let loops: Loop[];

    beforeEach(() => {
      loops = [
        service.createLoop('Loop A', 30, 40, { isActive: true, playCount: 5 }),
        service.createLoop('Loop B', 10, 20, { isActive: false, playCount: 2 }),
        service.createLoop('Loop C', 50, 60, { isActive: true, playCount: 8 })
      ];
    });

    it('should sort loops by start time', () => {
      const sorted = service.sortLoopsByStartTime(loops);
      
      expect(sorted[0].startTime).toBe(10);
      expect(sorted[1].startTime).toBe(30);
      expect(sorted[2].startTime).toBe(50);
    });

    it('should get active loops', () => {
      const activeLoops = service.getActiveLoops(loops);
      
      expect(activeLoops).toHaveSize(2);
      expect(activeLoops.map(l => l.name)).toEqual(['Loop A', 'Loop C']);
    });

    it('should find current loop based on time', () => {
      const currentLoop = service.getCurrentLoop(35, loops);
      
      expect(currentLoop?.name).toBe('Loop A');
    });

    it('should return null if no current loop', () => {
      const currentLoop = service.getCurrentLoop(45, loops);
      
      expect(currentLoop).toBeNull();
    });

    it('should calculate total loops duration', () => {
      const totalDuration = service.calculateTotalLoopsDuration(loops);
      
      expect(totalDuration).toBe(30); // 10 + 10 + 10
    });

    it('should generate loop statistics', () => {
      const stats = service.getLoopStatistics(loops);
      
      expect(stats.totalCount).toBe(3);
      expect(stats.activeCount).toBe(2);
      expect(stats.totalDuration).toBe(30);
      expect(stats.averageDuration).toBe(10);
      expect(stats.mostPlayed?.name).toBe('Loop C'); // playCount: 8
    });

    it('should handle empty loops array for statistics', () => {
      const stats = service.getLoopStatistics([]);
      
      expect(stats.totalCount).toBe(0);
      expect(stats.activeCount).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.mostPlayed).toBeNull();
    });
  });
});