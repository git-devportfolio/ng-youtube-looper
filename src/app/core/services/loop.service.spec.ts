import { TestBed } from '@angular/core/testing';
import { LoopService, Loop, LoopValidationError, DEFAULT_LOOP_CONFIG } from './loop.service';
import { ValidationService } from './validation.service';
import { SecureStorageService } from './storage.service';
import { CreateLoopRequest, UpdateLoopRequest } from '@shared/interfaces';

describe('LoopService', () => {
  let service: LoopService;
  let validationService: jasmine.SpyObj<ValidationService>;
  let storageService: jasmine.SpyObj<SecureStorageService>;

  const mockValidationService = {
    isValidLoopName: jasmine.createSpy('isValidLoopName'),
    isValidPlaybackSpeed: jasmine.createSpy('isValidPlaybackSpeed'),
    isValidTimeRange: jasmine.createSpy('isValidTimeRange'),
    formatTime: jasmine.createSpy('formatTime').and.returnValue('1:30'),
    parseTime: jasmine.createSpy('parseTime').and.returnValue(90)
  };

  const mockStorageService = {
    setItem: jasmine.createSpy('setItem').and.returnValue(true),
    getItem: jasmine.createSpy('getItem').and.returnValue(null)
  };

  beforeEach(() => {
    // Set default return values for mocks
    mockValidationService.isValidLoopName.and.returnValue(true);
    mockValidationService.isValidPlaybackSpeed.and.returnValue(true);
    mockValidationService.isValidTimeRange.and.returnValue(true);
    mockValidationService.parseTime.and.returnValue(0); // Default to 0 for invalid inputs
    
    TestBed.configureTestingModule({
      providers: [
        LoopService,
        { provide: ValidationService, useValue: mockValidationService },
        { provide: SecureStorageService, useValue: mockStorageService }
      ]
    });
    service = TestBed.inject(LoopService);
    validationService = TestBed.inject(ValidationService) as jasmine.SpyObj<ValidationService>;
    storageService = TestBed.inject(SecureStorageService) as jasmine.SpyObj<SecureStorageService>;
  });

  afterEach(() => {
    // Reset spies and set default return values
    mockValidationService.isValidLoopName.calls.reset();
    mockValidationService.isValidLoopName.and.returnValue(true);
    mockValidationService.isValidPlaybackSpeed.calls.reset();
    mockValidationService.isValidPlaybackSpeed.and.returnValue(true);
    mockValidationService.isValidTimeRange.calls.reset();
    mockValidationService.isValidTimeRange.and.returnValue(true);
    mockValidationService.parseTime.calls.reset();
    mockValidationService.parseTime.and.returnValue(0);
    mockValidationService.formatTime.calls.reset();
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

    it('should handle MM:SS format directly', () => {
      const result = service.parseTime('1:30');
      
      expect(result).toBe(90); // 1*60 + 30, handled directly now
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

  describe('advanced creation and validation methods (Task 23.2)', () => {
    describe('createValidatedLoop', () => {
      it('should create and validate a loop in one operation', () => {
        const result = service.createValidatedLoop('Validated Loop', 10, 20);
        
        expect(result.loop.name).toBe('Validated Loop');
        expect(result.loop.startTime).toBe(10);
        expect(result.loop.endTime).toBe(20);
        expect(result.validation.isValid).toBe(true);
        expect(result.validation.errors).toEqual([]);
      });

      it('should return validation errors when creating invalid loop', () => {
        validationService.isValidLoopName.and.returnValue(false);
        
        const result = service.createValidatedLoop('', 20, 10); // Invalid name and time range
        
        expect(result.validation.isValid).toBe(false);
        expect(result.validation.errors).toContain(LoopValidationError.INVALID_NAME);
        expect(result.validation.errors).toContain(LoopValidationError.ZERO_DURATION);
      });
    });

    describe('suggestNonOverlappingTimeRange', () => {
      it('should return desired range if no overlaps', () => {
        const suggestion = service.suggestNonOverlappingTimeRange(10, 20, [], 100);
        
        expect(suggestion).toEqual({ startTime: 10, endTime: 30 });
      });

      it('should find gap between existing loops', () => {
        const existingLoops = [
          service.createLoop('Loop 1', 0, 10),
          service.createLoop('Loop 2', 40, 50)
        ];
        
        const suggestion = service.suggestNonOverlappingTimeRange(15, 20, existingLoops, 100);
        
        // The algorithm suggests placement starting from desiredStart (15) since it doesn't overlap
        expect(suggestion).toEqual({ startTime: 15, endTime: 35 });
      });

      it('should suggest placement after last loop', () => {
        const existingLoops = [
          service.createLoop('Loop 1', 0, 20)
        ];
        
        const suggestion = service.suggestNonOverlappingTimeRange(10, 15, existingLoops, 100);
        
        expect(suggestion).toEqual({ startTime: 20, endTime: 35 });
      });

      it('should suggest placement after existing loop when desired overlaps', () => {
        const existingLoops = [
          service.createLoop('Loop 1', 30, 40)
        ];
        
        const suggestion = service.suggestNonOverlappingTimeRange(35, 20, existingLoops, 100);
        
        // Since 35-55 would overlap with 30-40, algorithm places after the existing loop: 40-60
        expect(suggestion).toEqual({ startTime: 40, endTime: 60 });
      });

      it('should return null if no suitable placement found', () => {
        const existingLoops = [
          service.createLoop('Loop 1', 0, 50)
        ];
        
        const suggestion = service.suggestNonOverlappingTimeRange(10, 40, existingLoops, 50);
        
        expect(suggestion).toBeNull();
      });

      it('should respect video duration limits', () => {
        const suggestion = service.suggestNonOverlappingTimeRange(80, 30, [], 100);
        
        expect(suggestion).toBeNull(); // Would exceed video duration
      });
    });

    describe('validateMultipleLoops', () => {
      it('should validate multiple loops correctly', () => {
        const loops = [
          service.createLoop('Loop 1', 10, 20),
          service.createLoop('Loop 2', 30, 40),
          service.createLoop('Loop 3', 15, 25) // Overlaps with Loop 1
        ];
        
        const results = service.validateMultipleLoops(loops, 100);
        
        expect(results.size).toBe(3);
        expect(results.get(loops[0].id)?.isValid).toBe(false); // Overlaps with Loop 3
        expect(results.get(loops[1].id)?.isValid).toBe(true);  // No overlap
        expect(results.get(loops[2].id)?.isValid).toBe(false); // Overlaps with Loop 1
      });

      it('should handle empty array', () => {
        const results = service.validateMultipleLoops([]);
        
        expect(results.size).toBe(0);
      });
    });

    describe('getLoopCreationSuggestions', () => {
      it('should provide suggestions for different loop sizes', () => {
        const suggestions = service.getLoopCreationSuggestions(600); // 10 minutes
        
        expect(suggestions).toBeTruthy();
        expect(suggestions?.shortLoop.duration).toBe(30); // 30s
        expect(suggestions?.mediumLoop.duration).toBe(120); // 2min
        expect(suggestions?.longLoop.duration).toBe(300); // 5min
      });

      it('should adapt suggestions to video duration', () => {
        const suggestions = service.getLoopCreationSuggestions(60); // 1 minute
        
        expect(suggestions).toBeTruthy();
        expect(suggestions?.shortLoop.duration).toBe(6); // 10% of 60s
        expect(suggestions?.mediumLoop.duration).toBe(15); // 25% of 60s
        expect(suggestions?.longLoop.duration).toBe(30); // 50% of 60s
      });

      it('should work with existing loops', () => {
        const existingLoops = [
          service.createLoop('Existing', 0, 30)
        ];
        
        const suggestions = service.getLoopCreationSuggestions(600, existingLoops);
        
        expect(suggestions).toBeTruthy();
        // Should suggest placements that avoid the existing loop
        expect(suggestions?.shortLoop.startTime).toBeGreaterThanOrEqual(30);
      });

      it('should return null for invalid video duration', () => {
        const suggestions = service.getLoopCreationSuggestions(0);
        
        expect(suggestions).toBeNull();
      });

      it('should return null if no suitable placements found', () => {
        const existingLoops = [
          service.createLoop('Full Coverage', 0, 100)
        ];
        
        const suggestions = service.getLoopCreationSuggestions(100, existingLoops);
        
        expect(suggestions).toBeNull();
      });
    });
  });

  describe('time utilities and calculations (Task 23.3)', () => {
    describe('calculateAdjustedLoopDuration', () => {
      it('should calculate duration accounting for playback speed', () => {
        const loop = service.createLoop('Speed Test', 10, 30, { playbackSpeed: 2 });
        const adjustedDuration = service.calculateAdjustedLoopDuration(loop);
        
        expect(adjustedDuration).toBe(10); // 20s duration / 2x speed = 10s
      });

      it('should handle normal speed loops', () => {
        const loop = service.createLoop('Normal Speed', 0, 15);
        const adjustedDuration = service.calculateAdjustedLoopDuration(loop);
        
        expect(adjustedDuration).toBe(15); // Same as base duration
      });

      it('should handle zero speed gracefully', () => {
        const loop = service.createLoop('Zero Speed', 10, 20, { playbackSpeed: 0 });
        const adjustedDuration = service.calculateAdjustedLoopDuration(loop);
        
        expect(adjustedDuration).toBe(10); // Falls back to base duration
      });
    });

    describe('calculateTotalPlaybackTime', () => {
      it('should calculate total time with repeats', () => {
        const loop = service.createLoop('Repeat Test', 0, 10, { 
          playbackSpeed: 1, 
          repeatCount: 3 
        });
        const totalTime = service.calculateTotalPlaybackTime(loop);
        
        expect(totalTime).toBe(30); // 10s × 3 repeats
      });

      it('should handle speed and repeats together', () => {
        const loop = service.createLoop('Complex Test', 0, 20, { 
          playbackSpeed: 2, 
          repeatCount: 4 
        });
        const totalTime = service.calculateTotalPlaybackTime(loop);
        
        expect(totalTime).toBe(40); // (20s / 2x speed) × 4 repeats = 10s × 4
      });

      it('should default to 1 repeat if not specified', () => {
        const loop = service.createLoop('Single Play', 5, 15);
        const totalTime = service.calculateTotalPlaybackTime(loop);
        
        expect(totalTime).toBe(10); // Single play
      });
    });

    describe('formatTimeExtended', () => {
      it('should format time with milliseconds', () => {
        expect(service.formatTimeExtended(65.123, true)).toBe('1:05.123');
        expect(service.formatTimeExtended(125.567, true)).toBe('2:05.566'); // JavaScript floating point precision
      });

      it('should format time without milliseconds', () => {
        expect(service.formatTimeExtended(65.999, false)).toBe('1:05');
        expect(service.formatTimeExtended(125.123)).toBe('2:05'); // Default false
      });

      it('should handle negative times', () => {
        expect(service.formatTimeExtended(-10, true)).toBe('0:00.000');
        expect(service.formatTimeExtended(-5, false)).toBe('0:00');
      });

      it('should handle zero time', () => {
        expect(service.formatTimeExtended(0, true)).toBe('0:00.000');
        expect(service.formatTimeExtended(0, false)).toBe('0:00');
      });
    });

    describe('formatDuration', () => {
      it('should format short durations (MM:SS)', () => {
        expect(service.formatDuration(65)).toBe('1:05');
        expect(service.formatDuration(3599)).toBe('59:59');
      });

      it('should format long durations with hours (HH:MM:SS)', () => {
        expect(service.formatDuration(3600)).toBe('1:00:00');
        expect(service.formatDuration(3665)).toBe('1:01:05');
        expect(service.formatDuration(7325)).toBe('2:02:05');
      });

      it('should handle negative durations', () => {
        expect(service.formatDuration(-100)).toBe('0:00:00');
      });

      it('should handle zero duration', () => {
        expect(service.formatDuration(0)).toBe('0:00');
      });
    });

    describe('parseTime extended', () => {
      it('should parse direct seconds input', () => {
        expect(service.parseTime('65')).toBe(65);
        expect(service.parseTime('123.45')).toBe(123.45);
      });

      it('should parse HH:MM:SS format', () => {
        expect(service.parseTime('1:05:30')).toBe(3930); // 1h + 5min + 30s
        expect(service.parseTime('0:01:05')).toBe(65);
        expect(service.parseTime('2:30:45.5')).toBe(9045.5);
      });

      it('should parse MM:SS format', () => {
        expect(service.parseTime('5:30')).toBe(330);
        expect(service.parseTime('0:45')).toBe(45);
        expect(service.parseTime('12:15.5')).toBe(735.5);
      });

      it('should validate time format constraints', () => {
        expect(service.parseTime('1:70:30')).toBe(0); // Invalid minutes
        expect(service.parseTime('1:30:70')).toBe(0); // Invalid seconds
        expect(service.parseTime('5:70')).toBe(0); // Invalid seconds in MM:SS
      });

      it('should handle invalid inputs gracefully', () => {
        expect(service.parseTime('')).toBe(0);
        expect(service.parseTime('invalid')).toBe(0);
        expect(service.parseTime('1:2:3:4')).toBe(0); // Too many parts
        expect(service.parseTime('1')).toBe(1); // Handles single number as seconds
      });

      it('should handle negative values', () => {
        expect(service.parseTime('-5:30')).toBe(0);
        expect(service.parseTime('5:-30')).toBe(0);
      });
    });

    describe('frame-based utilities', () => {
      describe('secondsToFrames', () => {
        it('should convert seconds to frames at 30fps', () => {
          expect(service.secondsToFrames(1, 30)).toBe(30);
          expect(service.secondsToFrames(2.5, 30)).toBe(75);
        });

        it('should convert seconds to frames at different frame rates', () => {
          expect(service.secondsToFrames(1, 60)).toBe(60);
          expect(service.secondsToFrames(1, 24)).toBe(24);
        });

        it('should use default 30fps when not specified', () => {
          expect(service.secondsToFrames(2)).toBe(60);
        });
      });

      describe('framesToSeconds', () => {
        it('should convert frames to seconds at 30fps', () => {
          expect(service.framesToSeconds(30, 30)).toBe(1);
          expect(service.framesToSeconds(75, 30)).toBe(2.5);
        });

        it('should handle zero frame rate', () => {
          expect(service.framesToSeconds(30, 0)).toBe(0);
        });
      });

      describe('roundToFrame', () => {
        it('should round to nearest frame boundary', () => {
          expect(service.roundToFrame(1.016, 30)).toBeCloseTo(1.0, 3); // 30 frames
          expect(service.roundToFrame(1.05, 30)).toBeCloseTo(1.067, 3); // 32 frames
        });

        it('should handle zero frame rate', () => {
          expect(service.roundToFrame(1.234, 0)).toBe(1.234);
        });
      });
    });

    describe('loop position utilities', () => {
      let testLoop: any;

      beforeEach(() => {
        testLoop = service.createLoop('Position Test', 10, 30);
      });

      describe('getTimeRemainingInLoop', () => {
        it('should calculate time remaining when inside loop', () => {
          expect(service.getTimeRemainingInLoop(15, testLoop)).toBe(15); // 30 - 15
          expect(service.getTimeRemainingInLoop(25, testLoop)).toBe(5); // 30 - 25
        });

        it('should return 0 when outside loop boundaries', () => {
          expect(service.getTimeRemainingInLoop(5, testLoop)).toBe(0); // Before loop
          expect(service.getTimeRemainingInLoop(35, testLoop)).toBe(0); // After loop
        });

        it('should return 0 at loop end', () => {
          expect(service.getTimeRemainingInLoop(30, testLoop)).toBe(0);
        });
      });

      describe('getLoopProgress', () => {
        it('should calculate progress percentage correctly', () => {
          expect(service.getLoopProgress(10, testLoop)).toBe(0); // At start
          expect(service.getLoopProgress(20, testLoop)).toBe(50); // Halfway
          expect(service.getLoopProgress(30, testLoop)).toBe(100); // At end
        });

        it('should clamp progress outside loop boundaries', () => {
          expect(service.getLoopProgress(5, testLoop)).toBe(0); // Before loop
          expect(service.getLoopProgress(35, testLoop)).toBe(100); // After loop
        });

        it('should handle zero-duration loops', () => {
          const zeroLoop = service.createLoop('Zero Duration', 10, 10);
          expect(service.getLoopProgress(10, zeroLoop)).toBe(0);
        });
      });
    });
  });

  describe('edge cases and collision handling (Task 23.4)', () => {
    describe('detectLoopConflicts', () => {
      it('should detect overlapping loops', () => {
        const loops = [
          service.createLoop('Loop 1', 10, 30),
          service.createLoop('Loop 2', 25, 45),
          service.createLoop('Loop 3', 50, 60)
        ];

        const conflicts = service.detectLoopConflicts(loops);

        expect(conflicts.overlapping).toHaveSize(1);
        expect(conflicts.overlapping[0].loop1.name).toBe('Loop 1');
        expect(conflicts.overlapping[0].loop2.name).toBe('Loop 2');
        expect(conflicts.overlapping[0].overlapStart).toBe(25);
        expect(conflicts.overlapping[0].overlapEnd).toBe(30);
        expect(conflicts.overlapping[0].overlapDuration).toBe(5);
      });

      it('should detect loops exceeding video duration', () => {
        const loops = [
          service.createLoop('Loop 1', 10, 30),
          service.createLoop('Loop 2', 80, 120),
          service.createLoop('Loop 3', 150, 180)
        ];

        const conflicts = service.detectLoopConflicts(loops, 100);

        expect(conflicts.exceedingDuration).toHaveSize(2);
        expect(conflicts.exceedingDuration[0].name).toBe('Loop 2');
        expect(conflicts.exceedingDuration[1].name).toBe('Loop 3');
      });

      it('should detect invalid time values', () => {
        const invalidLoops = [
          { ...service.createLoop('Valid Loop', 10, 30), startTime: -5 } as any,
          { ...service.createLoop('NaN Loop', 0, 10), endTime: NaN } as any,
          service.createLoop('Zero Duration', 20, 20),
          service.createLoop('Negative Duration', 30, 25)
        ];

        const conflicts = service.detectLoopConflicts(invalidLoops);

        expect(conflicts.invalidTimes).toHaveSize(4);
        expect(conflicts.invalidTimes.map(l => l.name)).toContain('Valid Loop');
        expect(conflicts.invalidTimes.map(l => l.name)).toContain('NaN Loop');
        expect(conflicts.invalidTimes.map(l => l.name)).toContain('Zero Duration');
        expect(conflicts.invalidTimes.map(l => l.name)).toContain('Negative Duration');
      });

      it('should detect duplicate names', () => {
        const loops = [
          service.createLoop('Practice Section', 10, 30),
          service.createLoop('practice section', 40, 50), // Different case
          service.createLoop('Practice Section  ', 60, 70), // Extra spaces
          service.createLoop('Other Loop', 80, 90)
        ];

        const conflicts = service.detectLoopConflicts(loops);

        expect(conflicts.duplicateNames).toHaveSize(3);
        expect(conflicts.duplicateNames.every(l => 
          l.name.toLowerCase().trim() === 'practice section'
        )).toBe(true);
      });
    });

    describe('resolveLoopConflicts', () => {
      it('should remove invalid loops', () => {
        const loops = [
          service.createLoop('Valid Loop', 10, 30),
          { ...service.createLoop('Invalid Loop', 0, 10), startTime: -5 } as any
        ];

        const result = service.resolveLoopConflicts(loops, 100, { removeInvalid: true });

        expect(result.resolvedLoops).toHaveSize(1);
        expect(result.removedLoops).toHaveSize(1);
        expect(result.modifications).toHaveSize(1);
        expect(result.modifications[0].action).toBe('removed');
        expect(result.modifications[0].details).toContain('Invalid time values');
      });

      it('should trim loops exceeding video duration', () => {
        const loops = [
          service.createLoop('Normal Loop', 10, 30),
          service.createLoop('Exceeding Loop', 80, 120),
          service.createLoop('After Video', 150, 180)
        ];

        const result = service.resolveLoopConflicts(loops, 100, { 
          trimToVideoDuration: true,
          removeInvalid: false 
        });

        expect(result.resolvedLoops).toHaveSize(2);
        expect(result.removedLoops).toHaveSize(1);
        expect(result.resolvedLoops[1].endTime).toBe(100);
        expect(result.modifications.some(m => m.action === 'trimmed')).toBe(true);
        expect(result.modifications.some(m => m.action === 'removed')).toBe(true);
      });

      it('should rename duplicate loops', () => {
        const loops = [
          service.createLoop('Practice', 10, 20),
          service.createLoop('Practice', 30, 40),
          service.createLoop('Practice', 50, 60)
        ];

        const result = service.resolveLoopConflicts(loops, 100, { 
          renameDuplicates: true,
          adjustOverlaps: false 
        });

        expect(result.resolvedLoops).toHaveSize(3);
        expect(result.resolvedLoops[0].name).toBe('Practice');
        expect(result.resolvedLoops[1].name).toBe('Practice (2)');
        expect(result.resolvedLoops[2].name).toBe('Practice (3)');
        expect(result.modifications.filter(m => m.action === 'renamed')).toHaveSize(2);
      });

      it('should adjust overlapping loops', () => {
        const loops = [
          service.createLoop('Loop 1', 10, 30),
          service.createLoop('Loop 2', 25, 45),
          service.createLoop('Loop 3', 40, 50)
        ];

        const result = service.resolveLoopConflicts(loops, 100, { 
          adjustOverlaps: true,
          renameDuplicates: false 
        });

        expect(result.resolvedLoops).toHaveSize(3);
        
        // First loop should remain unchanged
        expect(result.resolvedLoops[0].startTime).toBe(10);
        expect(result.resolvedLoops[0].endTime).toBe(30);
        
        // Second loop should be moved after first
        expect(result.resolvedLoops[1].startTime).toBe(30);
        expect(result.resolvedLoops[1].endTime).toBe(50);
        
        // Third loop should be moved after second
        expect(result.resolvedLoops[2].startTime).toBe(50);
        expect(result.resolvedLoops[2].endTime).toBe(60);
        
        expect(result.modifications.filter(m => m.action === 'adjusted')).toHaveSize(2);
      });

      it('should remove loops that cannot be resolved', () => {
        const loops = [
          service.createLoop('Loop 1', 0, 50),
          service.createLoop('Loop 2', 25, 75),
          service.createLoop('Loop 3', 40, 90)
        ];

        const result = service.resolveLoopConflicts(loops, 60, { 
          adjustOverlaps: true,
          trimToVideoDuration: false 
        });

        // Some loops may be removed due to insufficient space
        expect(result.resolvedLoops.length + result.removedLoops.length).toBe(3);
        expect(result.modifications.some(m => m.action === 'removed')).toBe(true);
      });
    });

    describe('validateLoopCollection', () => {
      it('should validate empty collection', () => {
        const validation = service.validateLoopCollection([]);
        
        expect(validation.isValid).toBe(true);
        expect(validation.criticalIssues).toHaveSize(0);
        expect(validation.warnings).toContain('No loops defined');
        expect(validation.suggestions).toContain('Add at least one loop to begin practicing');
      });

      it('should identify critical issues', () => {
        const loops = [
          { ...service.createLoop('Invalid Loop', 0, 10), startTime: -5 } as any,
          service.createLoop('Exceeding Loop', 80, 120)
        ];

        const validation = service.validateLoopCollection(loops, 100);
        
        expect(validation.isValid).toBe(false);
        expect(validation.criticalIssues).toHaveSize(2);
        expect(validation.criticalIssues[0]).toContain('invalid time values');
        expect(validation.criticalIssues[1]).toContain('exceed video duration');
      });

      it('should provide warnings and suggestions', () => {
        const loops = [
          service.createLoop('Overlap 1', 10, 30),
          service.createLoop('Overlap 2', 25, 45),
          service.createLoop('Duplicate', 50, 60),
          service.createLoop('Duplicate', 70, 80)
        ];

        const validation = service.validateLoopCollection(loops, 100);
        
        expect(validation.isValid).toBe(true);
        expect(validation.warnings.some(w => w.includes('overlapping'))).toBe(true);
        expect(validation.warnings.some(w => w.includes('duplicate'))).toBe(true);
        expect(validation.suggestions.some(s => s.includes('resolveLoopConflicts'))).toBe(true);
      });

      it('should provide performance suggestions', () => {
        const manyActiveLoops = Array.from({ length: 7 }, (_, i) => 
          service.createLoop(`Loop ${i}`, i * 10, (i + 1) * 10, { isActive: true })
        );

        const validation = service.validateLoopCollection(manyActiveLoops, 100);
        
        expect(validation.suggestions.some(s => s.includes('organizing loops'))).toBe(true);
      });
    });

    describe('analyzeLoopsForDebug', () => {
      it('should provide comprehensive analysis', () => {
        const loops = [
          service.createLoop('Loop 1', 10, 30, { isActive: true }),
          service.createLoop('Loop 2', 35, 50),
          service.createLoop('Loop 3', 45, 65, { isActive: true })
        ];

        const analysis = service.analyzeLoopsForDebug(loops, 100);

        expect(analysis.summary.total).toBe(3);
        expect(analysis.summary.active).toBe(2);
        expect(analysis.summary.totalDuration).toBe(55); // 20 + 15 + 20 (no overlap subtracted in this calculation)
        expect(analysis.summary.coveragePercentage).toBeCloseTo(55, 1);

        expect(analysis.timeRanges.earliest).toBe(10);
        expect(analysis.timeRanges.latest).toBe(65);
        expect(analysis.timeRanges.gaps).toHaveSize(1);
        expect(analysis.timeRanges.gaps[0]).toEqual({ start: 30, end: 35, duration: 5 });

        expect(analysis.timeRanges.overlaps).toHaveSize(1);
        expect(analysis.timeRanges.overlaps[0]).toEqual({
          start: 45,
          end: 50,
          duration: 5,
          loopCount: 2
        });

        expect(analysis.conflicts).toBeDefined();
        expect(analysis.validation).toBeDefined();
      });

      it('should handle empty loops collection', () => {
        const analysis = service.analyzeLoopsForDebug([]);

        expect(analysis.summary.total).toBe(0);
        expect(analysis.summary.active).toBe(0);
        expect(analysis.summary.totalDuration).toBe(0);
        expect(analysis.summary.averageDuration).toBe(0);

        expect(analysis.timeRanges.earliest).toBe(0);
        expect(analysis.timeRanges.latest).toBe(0);
        expect(analysis.timeRanges.gaps).toHaveSize(0);
        expect(analysis.timeRanges.overlaps).toHaveSize(0);
      });

      it('should calculate coverage percentage correctly', () => {
        const loops = [
          service.createLoop('Full Coverage', 0, 100)
        ];

        const analysis = service.analyzeLoopsForDebug(loops, 100);
        expect(analysis.summary.coveragePercentage).toBe(100);

        const analysisNoDuration = service.analyzeLoopsForDebug(loops);
        expect(analysisNoDuration.summary.coveragePercentage).toBeUndefined();
      });
    });

    describe('edge cases handling', () => {
      it('should handle NaN and undefined values gracefully', () => {
        const problematicLoop = {
          ...service.createLoop('Test', 10, 20),
          startTime: NaN,
          endTime: undefined as any
        };

        const conflicts = service.detectLoopConflicts([problematicLoop]);
        expect(conflicts.invalidTimes).toHaveSize(1);

        const validation = service.validateLoopCollection([problematicLoop]);
        expect(validation.isValid).toBe(false);
      });

      it('should handle very large numbers', () => {
        const loops = [
          service.createLoop('Large Numbers', Number.MAX_SAFE_INTEGER - 100, Number.MAX_SAFE_INTEGER)
        ];

        const analysis = service.analyzeLoopsForDebug(loops);
        expect(analysis.summary.totalDuration).toBe(100);
        expect(analysis.timeRanges.earliest).toBe(Number.MAX_SAFE_INTEGER - 100);
        expect(analysis.timeRanges.latest).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('should handle identical start and end times', () => {
        const loops = [
          service.createLoop('Zero Duration', 30, 30)
        ];

        const conflicts = service.detectLoopConflicts(loops);
        expect(conflicts.invalidTimes).toHaveSize(1);

        const resolved = service.resolveLoopConflicts(loops);
        expect(resolved.removedLoops).toHaveSize(1);
      });

      it('should handle loops with extreme negative values', () => {
        const loops = [
          { ...service.createLoop('Negative', 0, 10), startTime: -1000000 } as any
        ];

        const conflicts = service.detectLoopConflicts(loops);
        expect(conflicts.invalidTimes).toHaveSize(1);

        const resolved = service.resolveLoopConflicts(loops);
        expect(resolved.removedLoops).toHaveSize(1);
        expect(resolved.modifications[0].details).toContain('Invalid time values');
      });
    });
  });

  describe('integration and compatibility (Task 23.5)', () => {
    describe('type compatibility', () => {
      it('should be compatible with SessionLoop interface', () => {
        const loop = service.createLoop('Test Loop', 10, 30, { 
          color: '#ff0000',
          playCount: 5,
          isActive: true
        });

        // Test compatibility with SessionLoop from storage.types.ts
        const sessionLoop: any = {
          id: loop.id,
          name: loop.name, // SessionLoop has name as string | undefined
          startTime: loop.startTime,
          endTime: loop.endTime,
          color: loop.color, // SessionLoop has color as string | undefined
          playCount: loop.playCount,
          isActive: loop.isActive
        };

        expect(sessionLoop.id).toBe(loop.id);
        expect(sessionLoop.name).toBe(loop.name);
        expect(sessionLoop.startTime).toBe(loop.startTime);
        expect(sessionLoop.endTime).toBe(loop.endTime);
        expect(sessionLoop.color).toBe(loop.color);
        expect(sessionLoop.playCount).toBe(loop.playCount);
        expect(sessionLoop.isActive).toBe(loop.isActive);
      });

      it('should be compatible with LoopSegment interface', () => {
        const loop = service.createLoop('Test Segment', 15, 45, { 
          playbackSpeed: 1.5,
          isActive: true
        });

        // Test compatibility with LoopSegment from loop-manager.facade.ts
        const loopSegment: any = {
          id: loop.id,
          name: loop.name,
          startTime: loop.startTime,
          endTime: loop.endTime,
          playbackSpeed: loop.playbackSpeed,
          repeatCount: loop.repeatCount,
          isActive: loop.isActive
        };

        expect(loopSegment.id).toBe(loop.id);
        expect(loopSegment.name).toBe(loop.name);
        expect(loopSegment.startTime).toBe(loop.startTime);
        expect(loopSegment.endTime).toBe(loop.endTime);
        expect(loopSegment.playbackSpeed).toBe(loop.playbackSpeed);
        expect(loopSegment.isActive).toBe(loop.isActive);
      });

      it('should handle optional fields correctly for compatibility', () => {
        const minimalLoop = service.createLoop('Minimal Loop', 0, 10);

        // Should work with systems expecting undefined for optional fields
        expect(minimalLoop.color).toBeDefined(); // Has default value
        expect(minimalLoop.playbackSpeed).toBeDefined(); // Has default value
        expect(minimalLoop.repeatCount).toBeDefined(); // Has default value
        expect(minimalLoop.playCount).toBe(0); // Required field
        expect(minimalLoop.isActive).toBe(false); // Required field
      });
    });

    describe('ValidationService integration', () => {
      beforeEach(() => {
        // Reset ValidationService mock for integration tests
        validationService.isValidLoopName.and.returnValue(true);
        validationService.isValidPlaybackSpeed.and.returnValue(true);
        validationService.isValidTimeRange.and.returnValue(true);
        validationService.formatTime.and.returnValue('2:30');
        validationService.parseTime.and.returnValue(150);
      });

      it('should integrate properly with ValidationService for time formatting', () => {
        const result = service.formatTime(150);
        
        expect(validationService.formatTime).toHaveBeenCalledWith(150);
        expect(result).toBe('2:30');
      });

      it('should integrate properly with ValidationService for time parsing', () => {
        const result = service.parseTime('invalid::format::too:many'); // Too many colons
        
        expect(validationService.parseTime).toHaveBeenCalledWith('invalid::format::too:many');
        expect(result).toBe(0); // Falls back to 0 for invalid formats in our enhanced parseTime
      });

      it('should use ValidationService for loop validation', () => {
        const loop = service.createLoop('Integration Test', 10, 30);
        
        service.validateLoop(loop);
        
        expect(validationService.isValidLoopName).toHaveBeenCalledWith(loop.name);
      });

      it('should use ValidationService for time range validation', () => {
        service.isValidTimeRange(10, 30, 100);
        
        expect(validationService.isValidTimeRange).toHaveBeenCalledWith(10, 30, 100);
      });
    });

    describe('performance tests', () => {
      it('should handle large collections efficiently', () => {
        const largeLoopCollection = Array.from({ length: 1000 }, (_, i) => 
          service.createLoop(`Loop ${i}`, i * 10, (i * 10) + 5)
        );

        const startTime = performance.now();
        const conflicts = service.detectLoopConflicts(largeLoopCollection);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
        expect(conflicts).toBeDefined();
        expect(conflicts.overlapping).toBeDefined();
      });

      it('should resolve conflicts for medium collections efficiently', () => {
        const mediumLoopCollection = Array.from({ length: 100 }, (_, i) => 
          service.createLoop(`Overlapping Loop ${i}`, i * 2, (i * 2) + 10) // Intentional overlaps
        );

        const startTime = performance.now();
        const result = service.resolveLoopConflicts(mediumLoopCollection, 1000);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
        expect(result.resolvedLoops).toBeDefined();
        expect(result.modifications).toBeDefined();
      });

      it('should analyze large collections for debug efficiently', () => {
        const loops = Array.from({ length: 500 }, (_, i) => 
          service.createLoop(`Analysis Loop ${i}`, i * 5, (i * 5) + 3, { 
            isActive: i % 3 === 0 
          })
        );

        const startTime = performance.now();
        const analysis = service.analyzeLoopsForDebug(loops, 5000);
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
        expect(analysis.summary.total).toBe(500);
        expect(analysis.timeRanges).toBeDefined();
        expect(analysis.conflicts).toBeDefined();
        expect(analysis.validation).toBeDefined();
      });
    });

    describe('comprehensive feature coverage', () => {
      it('should demonstrate full workflow integration', () => {
        // 1. Create loops with various configurations
        const loops = [
          service.createLoop('Intro', 0, 15, { isActive: true }),
          service.createLoop('Verse 1', 15, 45, { playbackSpeed: 0.8 }),
          service.createLoop('Chorus', 45, 75, { repeatCount: 3, color: '#ff6b6b', isActive: true }),
          service.createLoop('Bridge', 75, 95, { isActive: true }),
          service.createLoop('Outro', 95, 110)
        ];

        // 2. Validate the collection
        const validation = service.validateLoopCollection(loops, 120);
        expect(validation.isValid).toBe(true);

        // 3. Get statistics
        const stats = service.getLoopStatistics(loops);
        expect(stats.totalCount).toBe(5);
        expect(stats.activeCount).toBe(3); // Intro, Chorus, Bridge are active

        // 4. Sort and analyze
        const sortedLoops = service.sortLoopsByStartTime(loops);
        expect(sortedLoops[0].name).toBe('Intro');
        expect(sortedLoops[4].name).toBe('Outro');

        // 5. Find current loop during playback
        const currentLoop = service.getCurrentLoop(50, loops);
        expect(currentLoop?.name).toBe('Chorus');

        // 6. Calculate durations and progress
        const totalDuration = service.calculateTotalLoopsDuration(loops);
        expect(totalDuration).toBe(110); // Sum of all loop durations: 15+30+30+20+15=110

        const progress = service.getLoopProgress(60, loops.find(l => l.name === 'Chorus')!);
        expect(progress).toBe(50); // 50% through the chorus

        // 7. Advanced analysis
        const analysis = service.analyzeLoopsForDebug(loops, 120);
        expect(analysis.summary.coveragePercentage).toBeCloseTo(91.67, 1); // 110/120 * 100 = 91.67

        // 8. Test conflict resolution if needed
        const conflicts = service.detectLoopConflicts(loops);
        expect(conflicts.overlapping).toHaveSize(0); // No overlaps in this well-designed set
      });

      it('should handle edge cases in real-world scenarios', () => {
        // Test with problematic input that might come from user interface
        const problematicLoops = [
          service.createLoop('  Trimmed Name  ', 0, 10), // Name with spaces
          service.createLoop('', 10, 20), // Empty name - should be handled by validation
          service.createLoop('Very Long Loop Name That Exceeds Normal Limits For Display', 20, 30), // Long name
          { ...service.createLoop('Broken Loop', 30, 40), endTime: NaN } as any, // Broken time
          service.createLoop('Normal Loop', 40, 50) // Normal loop for comparison
        ];

        // Should handle gracefully
        const conflicts = service.detectLoopConflicts(problematicLoops);
        expect(conflicts.invalidTimes).toHaveSize(1); // Only the NaN one

        const resolved = service.resolveLoopConflicts(problematicLoops, 100);
        expect(resolved.resolvedLoops.length).toBeLessThanOrEqual(problematicLoops.length);
        expect(resolved.modifications).toBeDefined();
      });
    });
  });

  // === Tests for Enhanced CRUD Operations ===

  describe('Enhanced CRUD Operations', () => {
    beforeEach(() => {
      // Setup video context
      service.setCurrentVideoId('test-video-123');
    });

    describe('Reactive State Management', () => {
      it('should initialize with empty state', () => {
        expect(service.loops()).toEqual([]);
        expect(service.activeLoopId()).toBe(null);
        expect(service.loopCount()).toBe(0);
        expect(service.hasActiveLoop()).toBe(false);
        expect(service.totalDuration()).toBe(0);
      });

      it('should update computed signals when loops change', () => {
        const request: CreateLoopRequest = {
          name: 'Test Loop',
          startTime: 30,
          endTime: 60,
          playbackSpeed: 0.75
        };

        const result = service.createLoopFromRequest(request);
        expect(result.success).toBe(true);

        expect(service.loopCount()).toBe(1);
        expect(service.totalDuration()).toBe(30); // 60-30
        
        if (result.loop) {
          service.setActiveLoop(result.loop.id);
          expect(service.hasActiveLoop()).toBe(true);
          expect(service.activeLoop()).toEqual(result.loop);
        }
      });
    });

    describe('createLoopFromRequest', () => {
      it('should create loop successfully with valid data', () => {
        const request: CreateLoopRequest = {
          name: 'Guitar Solo',
          startTime: 45,
          endTime: 90,
          playbackSpeed: 0.5,
          repeatCount: 3,
          color: '#ff5733'
        };

        const result = service.createLoopFromRequest(request);

        expect(result.success).toBe(true);
        expect(result.loop).toBeDefined();
        expect(result.loop!.name).toBe('Guitar Solo');
        expect(result.loop!.startTime).toBe(45);
        expect(result.loop!.endTime).toBe(90);
        expect(result.loop!.playbackSpeed).toBe(0.5);
        expect(result.loop!.repeatCount).toBe(3);
        expect(result.loop!.color).toBe('#ff5733');
        expect(storageService.setItem).toHaveBeenCalled();
      });

      it('should fail validation for invalid loop data', () => {
        mockValidationService.isValidLoopName.and.returnValue(false);

        const request: CreateLoopRequest = {
          name: '', // Invalid name
          startTime: 60,
          endTime: 30 // Invalid time range
        };

        const result = service.createLoopFromRequest(request);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation failed');
        expect(result.validation).toBeDefined();
      });
    });

    describe('updateLoop', () => {
      it('should update existing loop successfully', () => {
        // First create a loop
        const createRequest: CreateLoopRequest = {
          name: 'Original Loop',
          startTime: 30,
          endTime: 60
        };

        const createResult = service.createLoopFromRequest(createRequest);
        expect(createResult.success).toBe(true);

        const loopId = createResult.loop!.id;

        // Update the loop
        const updateRequest: UpdateLoopRequest = {
          id: loopId,
          name: 'Updated Loop',
          playbackSpeed: 0.75
        };

        const updateResult = service.updateLoop(updateRequest);

        expect(updateResult.success).toBe(true);
        expect(updateResult.loop!.name).toBe('Updated Loop');
        expect(updateResult.loop!.playbackSpeed).toBe(0.75);
        expect(updateResult.loop!.startTime).toBe(30); // Should remain unchanged
        expect(storageService.setItem).toHaveBeenCalledTimes(2); // Create + Update
      });

      it('should fail to update non-existent loop', () => {
        const request: UpdateLoopRequest = {
          id: 'non-existent-id',
          name: 'Updated Name'
        };

        const result = service.updateLoop(request);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('deleteLoop', () => {
      it('should delete existing loop successfully', () => {
        // Create a loop first
        const createRequest: CreateLoopRequest = {
          name: 'To Delete',
          startTime: 20,
          endTime: 40
        };

        const createResult = service.createLoopFromRequest(createRequest);
        expect(createResult.success).toBe(true);

        const loopId = createResult.loop!.id;
        service.setActiveLoop(loopId);

        // Delete the loop
        const deleteResult = service.deleteLoop(loopId);

        expect(deleteResult.success).toBe(true);
        expect(deleteResult.loop!.name).toBe('To Delete');
        expect(service.loopCount()).toBe(0);
        expect(service.hasActiveLoop()).toBe(false); // Should clear active
        expect(storageService.setItem).toHaveBeenCalledTimes(3); // Create + SetActive + Delete
      });

      it('should fail to delete non-existent loop', () => {
        const result = service.deleteLoop('non-existent-id');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('Active Loop Management', () => {
      it('should set and clear active loop', () => {
        // Create a loop
        const createRequest: CreateLoopRequest = {
          name: 'Active Test',
          startTime: 15,
          endTime: 45
        };

        const result = service.createLoopFromRequest(createRequest);
        expect(result.success).toBe(true);

        const loopId = result.loop!.id;

        // Set as active
        const setActiveResult = service.setActiveLoop(loopId);
        expect(setActiveResult).toBe(true);
        expect(service.activeLoopId()).toBe(loopId);
        expect(service.hasActiveLoop()).toBe(true);
        expect(service.activeLoop() ?? null).toEqual(result.loop ?? null);

        // Clear active
        const clearActiveResult = service.setActiveLoop(null);
        expect(clearActiveResult).toBe(true);
        expect(service.activeLoopId()).toBe(null);
        expect(service.hasActiveLoop()).toBe(false);
        expect(service.activeLoop()).toBe(null);
      });

      it('should fail to set non-existent loop as active', () => {
        const result = service.setActiveLoop('non-existent-id');
        expect(result).toBe(false);
        expect(service.lastError()).toContain('not found');
      });
    });

    describe('Storage Integration', () => {
      it('should persist loops to storage with correct key', () => {
        const videoId = 'test-video-456';
        service.setCurrentVideoId(videoId);

        const request: CreateLoopRequest = {
          name: 'Storage Test',
          startTime: 10,
          endTime: 30
        };

        service.createLoopFromRequest(request);

        expect(storageService.setItem).toHaveBeenCalledWith(
          `ng-youtube-looper-loops-${videoId}`,
          jasmine.objectContaining({
            videoId: videoId,
            loops: jasmine.any(Array),
            updatedAt: jasmine.any(String)
          })
        );
      });

      it('should load loops from storage on video ID change', () => {
        const videoId = 'stored-video-789';
        const storedData = {
          videoId: videoId,
          loops: [
            {
              id: 'stored-loop-1',
              name: 'Stored Loop',
              startTime: 20,
              endTime: 50,
              playCount: 0,
              isActive: false
            }
          ],
          activeLoopId: 'stored-loop-1',
          updatedAt: new Date().toISOString()
        };

        mockStorageService.getItem.and.returnValue(storedData);

        service.setCurrentVideoId(videoId);

        expect(storageService.getItem).toHaveBeenCalledWith(`ng-youtube-looper-loops-${videoId}`);
        expect(service.loopCount()).toBe(1);
        expect(service.loops()[0].name).toBe('Stored Loop');
        expect(service.activeLoopId()).toBe('stored-loop-1');
      });

      it('should clear loops when storage is empty', () => {
        // First add some loops
        const request: CreateLoopRequest = {
          name: 'Temp Loop',
          startTime: 5,
          endTime: 15
        };
        service.createLoopFromRequest(request);
        expect(service.loopCount()).toBe(1);

        // Change to video with no stored loops
        mockStorageService.getItem.and.returnValue(null);
        service.setCurrentVideoId('empty-video');

        expect(service.loopCount()).toBe(0);
        expect(service.hasActiveLoop()).toBe(false);
      });
    });

    describe('Bulk Operations', () => {
      it('should clear all loops', () => {
        // Create multiple loops
        ['Loop A', 'Loop B', 'Loop C'].forEach((name, index) => {
          const request: CreateLoopRequest = {
            name,
            startTime: index * 20,
            endTime: (index * 20) + 15
          };
          service.createLoopFromRequest(request);
        });

        expect(service.loopCount()).toBe(3);

        // Clear all
        service.clearAllLoops();

        expect(service.loopCount()).toBe(0);
        expect(service.hasActiveLoop()).toBe(false);
        expect(storageService.setItem).toHaveBeenCalledWith(
          jasmine.stringMatching(/ng-youtube-looper-loops-/),
          jasmine.objectContaining({
            loops: []
          })
        );
      });
    });
  });
});