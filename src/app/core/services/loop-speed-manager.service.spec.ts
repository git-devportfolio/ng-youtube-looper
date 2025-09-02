import { TestBed } from '@angular/core/testing';
import { LoopSpeedManagerService } from './loop-speed-manager.service';

describe('LoopSpeedManagerService', () => {
  let service: LoopSpeedManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoopSpeedManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default global speed of 1.0', () => {
    expect(service.globalSpeed()).toBe(1.0);
  });

  it('should set and get loop speed correctly', () => {
    const result = service.setLoopSpeed('loop-1', 1.5);
    expect(result.success).toBe(true);
    expect(service.getLoopSpeed('loop-1')).toBe(1.5);
  });

  it('should validate speed values', () => {
    const invalidResult = service.setLoopSpeed('loop-1', 3.0); // Beyond max
    expect(invalidResult.success).toBe(false);
  });

  it('should manage active loop correctly', () => {
    service.setLoopSpeed('loop-1', 1.5);
    service.setActiveLoop('loop-1');
    
    expect(service.activeLoopSpeed()).toBe(1.5);
    expect(service.hasActiveLoop()).toBe(true);
  });

  it('should reset all speeds', () => {
    service.setLoopSpeed('loop-1', 1.5);
    service.setGlobalSpeed(0.75);
    
    const result = service.resetAllSpeeds();
    
    expect(result.success).toBe(true);
    expect(service.globalSpeed()).toBe(1.0);
    expect(service.totalMappings()).toBe(0);
  });
});