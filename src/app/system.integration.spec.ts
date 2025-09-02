import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { YouTubeService } from '@core/services/youtube.service';
import { LoopService } from '@core/services/loop.service';
import { LoopSpeedManagerService } from '@core/services/loop-speed-manager.service';
import { VideoPlayerFacade } from '@features/video-player/data-access/video-player.facade';

describe('System Integration - Speed Control Validation', () => {
  let youTubeService: YouTubeService;
  let loopService: LoopService;
  let speedManager: LoopSpeedManagerService;
  let facade: VideoPlayerFacade;

  beforeEach(() => {
    // Mock YouTube API
    (window as any).YT = {
      Player: jasmine.createSpy('Player').and.returnValue({
        setPlaybackRate: jasmine.createSpy('setPlaybackRate'),
        seekTo: jasmine.createSpy('seekTo'),
        getCurrentTime: jasmine.createSpy('getCurrentTime').and.returnValue(0),
        getDuration: jasmine.createSpy('getDuration').and.returnValue(180),
        destroy: jasmine.createSpy('destroy')
      })
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        YouTubeService,
        LoopService,
        LoopSpeedManagerService,
        VideoPlayerFacade
      ]
    });

    youTubeService = TestBed.inject(YouTubeService);
    loopService = TestBed.inject(LoopService);
    speedManager = TestBed.inject(LoopSpeedManagerService);
    facade = TestBed.inject(VideoPlayerFacade);
  });

  afterEach(() => {
    delete (window as any).YT;
  });

  it('should integrate speed control system across all services', () => {
    // Test 1: Basic speed management
    expect(speedManager.globalSpeed()).toBe(1.0);
    
    const speedResult = speedManager.setGlobalSpeed(1.5);
    expect(speedResult.success).toBe(true);
    expect(speedManager.globalSpeed()).toBe(1.5);

    // Test 2: Loop creation and speed assignment
    const loopResult = facade.addLoop('Integration Test Loop', 30, 60);
    expect(loopResult).toBe(true);
    
    const loops = facade.loops();
    expect(loops.length).toBe(1);
    
    const loopId = loops[0].id;
    const loopSpeedResult = speedManager.setLoopSpeed(loopId, 0.75);
    expect(loopSpeedResult.success).toBe(true);
    expect(speedManager.getLoopSpeed(loopId)).toBe(0.75);

    // Test 3: Active loop management
    speedManager.setActiveLoop(loopId);
    expect(speedManager.hasActiveLoop()).toBe(true);
    expect(speedManager.activeLoopSpeed()).toBe(0.75);

    // Test 4: Service coordination
    youTubeService.setPlaybackRate(speedManager.activeLoopSpeed());
    youTubeService.seekTo(loops[0].startTime);
    
    expect((window as any).YT.Player().setPlaybackRate).toHaveBeenCalledWith(0.75);
    expect((window as any).YT.Player().seekTo).toHaveBeenCalledWith(30);
  });

  it('should validate speed boundaries across the system', () => {
    // Valid speeds
    const validSpeeds = [0.25, 0.75, 1.0, 1.25, 1.5, 2.0];
    validSpeeds.forEach(speed => {
      const result = speedManager.setGlobalSpeed(speed);
      expect(result.success).toBe(true);
      expect(speedManager.globalSpeed()).toBe(speed);
    });

    // Invalid speeds
    const invalidSpeeds = [0.1, 3.0, -1, 0];
    invalidSpeeds.forEach(speed => {
      const result = speedManager.setGlobalSpeed(speed);
      expect(result.success).toBe(false);
    });
  });

  it('should handle multiple loops with different speeds', () => {
    // Create multiple loops
    facade.addLoop('Loop A', 10, 30);
    facade.addLoop('Loop B', 40, 60);
    facade.addLoop('Loop C', 70, 90);

    const loops = facade.loops();
    expect(loops.length).toBe(3);

    // Assign different speeds
    speedManager.setLoopSpeed(loops[0].id, 0.5);
    speedManager.setLoopSpeed(loops[1].id, 1.0);
    speedManager.setLoopSpeed(loops[2].id, 1.5);

    // Verify each speed
    expect(speedManager.getLoopSpeed(loops[0].id)).toBe(0.5);
    expect(speedManager.getLoopSpeed(loops[1].id)).toBe(1.0);
    expect(speedManager.getLoopSpeed(loops[2].id)).toBe(1.5);
    
    expect(speedManager.totalMappings()).toBe(3);
  });

  it('should clean up resources properly', () => {
    // Setup state
    facade.addLoop('Cleanup Test', 20, 40);
    speedManager.setLoopSpeed(facade.loops()[0].id, 0.75);
    expect(speedManager.totalMappings()).toBe(1);

    // Cleanup
    speedManager.resetAllSpeeds();
    expect(speedManager.totalMappings()).toBe(0);
    expect(speedManager.globalSpeed()).toBe(1.0);
    expect(speedManager.hasActiveLoop()).toBe(false);
  });

  it('should validate complete system workflow', () => {
    // 1. Create loop
    const loopSuccess = facade.addLoop('System Test', 45, 75);
    expect(loopSuccess).toBe(true);
    
    // 2. Configure speed
    const loopId = facade.loops()[0].id;
    const speedSuccess = speedManager.setLoopSpeed(loopId, 0.5);
    expect(speedSuccess.success).toBe(true);
    
    // 3. Activate loop
    speedManager.setActiveLoop(loopId);
    expect(speedManager.activeLoopSpeed()).toBe(0.5);
    
    // 4. Start loop playback
    facade.startLoop(loopId);
    expect((window as any).YT.Player().seekTo).toHaveBeenCalledWith(45);
    
    // 5. Verify system state
    expect(facade.loops().length).toBe(1);
    expect(speedManager.hasActiveLoop()).toBe(true);
    expect(speedManager.totalMappings()).toBe(1);
  });
});