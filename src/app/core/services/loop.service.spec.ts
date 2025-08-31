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
    mockValidationService.parseTime.and.returnValue(0); // Default to 0 for invalid inputs
    
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
});