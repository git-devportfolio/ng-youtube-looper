import { Injectable, inject, signal, computed } from '@angular/core';
import { ValidationService } from './validation.service';
import { SecureStorageService } from './storage.service';

// Type for tracking speed per loop
export interface LoopSpeedMapping {
  loopId: string;
  playbackSpeed: number;
  lastUpdated: number;
  isActive: boolean;
}

// Configuration for speed management
export interface SpeedManagerConfig {
  useGlobalFallback: boolean;
  globalFallbackSpeed: number;
  persistToStorage: boolean;
  storageKey: string;
}

// Result of speed operations
export interface SpeedOperationResult {
  success: boolean;
  speed?: number;
  error?: string;
  wasAdjusted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LoopSpeedManagerService {
  private readonly validationService = inject(ValidationService);
  private readonly storageService = inject(SecureStorageService);

  // Configuration with defaults
  private readonly config: SpeedManagerConfig = {
    useGlobalFallback: true,
    globalFallbackSpeed: 1.0,
    persistToStorage: true,
    storageKey: 'loop-speed-mappings'
  };

  // Private signals for state management
  private readonly _speedMappings = signal<Map<string, LoopSpeedMapping>>(new Map());
  private readonly _activeLoopId = signal<string | null>(null);
  private readonly _globalSpeed = signal<number>(this.config.globalFallbackSpeed);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly speedMappings = this._speedMappings.asReadonly();
  readonly activeLoopId = this._activeLoopId.asReadonly();
  readonly globalSpeed = this._globalSpeed.asReadonly();
  readonly error = this._lastError.asReadonly();

  // Computed signals for derived state
  readonly activeLoopSpeed = computed(() => {
    const activeId = this._activeLoopId();
    if (!activeId) return this._globalSpeed();
    
    const mappings = this._speedMappings();
    const mapping = mappings.get(activeId);
    return mapping?.playbackSpeed || this._globalSpeed();
  });

  readonly hasActiveLoop = computed(() => this._activeLoopId() !== null);

  readonly totalMappings = computed(() => this._speedMappings().size);

  readonly activeMappings = computed(() => {
    const mappings = this._speedMappings();
    return Array.from(mappings.values()).filter(m => m.isActive);
  });

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Set the active loop and return its speed
   */
  setActiveLoop(loopId: string | null): SpeedOperationResult {
    try {
      this._activeLoopId.set(loopId);
      
      if (loopId) {
        // Update active state for all mappings
        const mappings = new Map(this._speedMappings());
        
        // Deactivate all other mappings
        mappings.forEach((mapping, id) => {
          mapping.isActive = id === loopId;
          if (id === loopId) {
            mapping.lastUpdated = Date.now();
          }
        });
        
        this._speedMappings.set(mappings);
        this.saveToStorage();
        
        const currentSpeed = this.activeLoopSpeed();
        return { 
          success: true, 
          speed: currentSpeed 
        };
      }
      
      return { 
        success: true, 
        speed: this._globalSpeed() 
      };
    } catch (error) {
      const errorMsg = `Failed to set active loop: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Set playback speed for a specific loop
   */
  setLoopSpeed(loopId: string, speed: number): SpeedOperationResult {
    try {
      // Validate the speed
      const validation = this.validationService.isValidPlaybackSpeed(speed);
      
      if (!validation) {
        const errorMsg = 'Invalid speed value';
        this._lastError.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const validatedSpeed = speed;
      const wasAdjusted = Math.abs(validatedSpeed - speed) > 0.001;
      
      // Update or create mapping
      const mappings = new Map(this._speedMappings());
      const currentMapping = mappings.get(loopId);
      
      const newMapping: LoopSpeedMapping = {
        loopId,
        playbackSpeed: validatedSpeed,
        lastUpdated: Date.now(),
        isActive: currentMapping?.isActive || false
      };
      
      mappings.set(loopId, newMapping);
      this._speedMappings.set(mappings);
      
      // Update active state if this is the current loop
      if (this._activeLoopId() === loopId) {
        // Mark this mapping as active
        newMapping.isActive = true;
      }
      
      this.saveToStorage();
      this._lastError.set(null);
      
      return { 
        success: true, 
        speed: validatedSpeed,
        wasAdjusted 
      };
    } catch (error) {
      const errorMsg = `Failed to set loop speed: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get playback speed for a specific loop
   */
  getLoopSpeed(loopId: string): number {
    const mappings = this._speedMappings();
    const mapping = mappings.get(loopId);
    return mapping?.playbackSpeed || this._globalSpeed();
  }

  /**
   * Remove speed mapping for a loop (when loop is deleted)
   */
  removeLoopSpeed(loopId: string): SpeedOperationResult {
    try {
      const mappings = new Map(this._speedMappings());
      const existed = mappings.has(loopId);
      
      mappings.delete(loopId);
      this._speedMappings.set(mappings);
      
      // If this was the active loop, clear active state
      if (this._activeLoopId() === loopId) {
        this._activeLoopId.set(null);
      }
      
      this.saveToStorage();
      
      return { 
        success: true,
        speed: existed ? this._globalSpeed() : this._globalSpeed()
      };
    } catch (error) {
      const errorMsg = `Failed to remove loop speed: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Set global fallback speed
   */
  setGlobalSpeed(speed: number): SpeedOperationResult {
    try {
      const validation = this.validationService.isValidPlaybackSpeed(speed);
      
      if (!validation) {
        const errorMsg = 'Invalid global speed value';
        this._lastError.set(errorMsg);
        return { success: false, error: errorMsg };
      }

      const validatedSpeed = speed;
      const wasAdjusted = Math.abs(validatedSpeed - speed) > 0.001;
      
      this._globalSpeed.set(validatedSpeed);
      this.saveToStorage();
      this._lastError.set(null);
      
      return { 
        success: true, 
        speed: validatedSpeed,
        wasAdjusted 
      };
    } catch (error) {
      const errorMsg = `Failed to set global speed: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Reset all speed mappings
   */
  resetAllSpeeds(): SpeedOperationResult {
    try {
      this._speedMappings.set(new Map());
      this._globalSpeed.set(this.config.globalFallbackSpeed);
      this._activeLoopId.set(null);
      this.saveToStorage();
      
      return { success: true, speed: this.config.globalFallbackSpeed };
    } catch (error) {
      const errorMsg = `Failed to reset speeds: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get all speed mappings as an array
   */
  getAllSpeedMappings(): LoopSpeedMapping[] {
    return Array.from(this._speedMappings().values());
  }

  /**
   * Update multiple loop speeds at once
   */
  setMultipleLoopSpeeds(speeds: Array<{ loopId: string; speed: number }>): {
    successful: Array<{ loopId: string; speed: number }>;
    failed: Array<{ loopId: string; error: string }>;
  } {
    const successful: Array<{ loopId: string; speed: number }> = [];
    const failed: Array<{ loopId: string; error: string }> = [];
    
    speeds.forEach(({ loopId, speed }) => {
      const result = this.setLoopSpeed(loopId, speed);
      
      if (result.success && result.speed !== undefined) {
        successful.push({ loopId, speed: result.speed });
      } else {
        failed.push({ loopId, error: result.error || 'Unknown error' });
      }
    });
    
    return { successful, failed };
  }

  /**
   * Get speed statistics
   */
  getSpeedStatistics(): {
    totalMappings: number;
    activeMappings: number;
    averageSpeed: number;
    speedRange: { min: number; max: number };
    globalSpeed: number;
    mostCommonSpeed: number | null;
  } {
    const mappings = Array.from(this._speedMappings().values());
    const speeds = mappings.map(m => m.playbackSpeed);
    
    if (speeds.length === 0) {
      return {
        totalMappings: 0,
        activeMappings: 0,
        averageSpeed: this._globalSpeed(),
        speedRange: { min: this._globalSpeed(), max: this._globalSpeed() },
        globalSpeed: this._globalSpeed(),
        mostCommonSpeed: null
      };
    }
    
    const average = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    
    // Find most common speed
    const speedCounts = new Map<number, number>();
    speeds.forEach(speed => {
      speedCounts.set(speed, (speedCounts.get(speed) || 0) + 1);
    });
    
    let mostCommonSpeed: number | null = null;
    let maxCount = 0;
    speedCounts.forEach((count, speed) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonSpeed = speed;
      }
    });
    
    return {
      totalMappings: mappings.length,
      activeMappings: this.activeMappings().length,
      averageSpeed: average,
      speedRange: { min, max },
      globalSpeed: this._globalSpeed(),
      mostCommonSpeed
    };
  }

  /**
   * Save speed mappings to localStorage
   */
  private saveToStorage(): void {
    if (!this.config.persistToStorage) return;
    
    try {
      const data = {
        mappings: Array.from(this._speedMappings().entries()),
        globalSpeed: this._globalSpeed(),
        lastSaved: Date.now()
      };
      
      this.storageService.setItem(this.config.storageKey, data);
    } catch (error) {
      console.warn('Failed to save loop speed mappings to storage:', error);
    }
  }

  /**
   * Load speed mappings from localStorage
   */
  private loadFromStorage(): void {
    if (!this.config.persistToStorage) return;
    
    try {
      const data = this.storageService.getItem(this.config.storageKey);
      
      if (data && data.mappings && Array.isArray(data.mappings)) {
        const mappings = new Map<string, LoopSpeedMapping>();
        
        data.mappings.forEach(([loopId, mapping]: [string, LoopSpeedMapping]) => {
          // Validate loaded data
          if (
            typeof mapping.loopId === 'string' &&
            typeof mapping.playbackSpeed === 'number' &&
            this.validationService.isValidPlaybackSpeed(mapping.playbackSpeed)
          ) {
            mappings.set(loopId, {
              ...mapping,
              isActive: false // Reset active state on load
            });
          }
        });
        
        this._speedMappings.set(mappings);
        
        // Load global speed if valid
        if (typeof data.globalSpeed === 'number' && 
            this.validationService.isValidPlaybackSpeed(data.globalSpeed)) {
          this._globalSpeed.set(data.globalSpeed);
        }
      }
    } catch (error) {
      console.warn('Failed to load loop speed mappings from storage:', error);
    }
  }

  /**
   * Export speed configuration for backup/sharing
   */
  exportSpeedConfiguration(): {
    mappings: LoopSpeedMapping[];
    globalSpeed: number;
    exportDate: string;
    version: string;
  } {
    return {
      mappings: this.getAllSpeedMappings(),
      globalSpeed: this._globalSpeed(),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import speed configuration from backup
   */
  importSpeedConfiguration(config: {
    mappings: LoopSpeedMapping[];
    globalSpeed: number;
  }): SpeedOperationResult {
    try {
      // Validate imported data
      if (!Array.isArray(config.mappings)) {
        return { success: false, error: 'Invalid mappings format' };
      }
      
      const validMappings = new Map<string, LoopSpeedMapping>();
      
      config.mappings.forEach(mapping => {
        if (
          typeof mapping.loopId === 'string' &&
          typeof mapping.playbackSpeed === 'number' &&
          this.validationService.isValidPlaybackSpeed(mapping.playbackSpeed)
        ) {
          validMappings.set(mapping.loopId, {
            ...mapping,
            isActive: false,
            lastUpdated: Date.now()
          });
        }
      });
      
      this._speedMappings.set(validMappings);
      
      // Validate and set global speed
      if (typeof config.globalSpeed === 'number' && 
          this.validationService.isValidPlaybackSpeed(config.globalSpeed)) {
        this._globalSpeed.set(config.globalSpeed);
      }
      
      this.saveToStorage();
      
      return { success: true, speed: this._globalSpeed() };
    } catch (error) {
      const errorMsg = `Failed to import speed configuration: ${error}`;
      this._lastError.set(errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}