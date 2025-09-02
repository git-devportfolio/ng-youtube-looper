// Core loop segment interface for the application
export interface LoopSegment {
  id: string;
  name: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  playbackSpeed: number; // between 0.25 and 2.0
  repeatCount?: number; // optional, defaults to infinite loop
  color?: string; // optional, for visual distinction
  playCount: number; // tracks how many times played
  isActive: boolean; // whether this loop is currently active
  createdAt?: Date;
  updatedAt?: Date;
}

// Status types for loop management
export type LoopStatus = 'active' | 'inactive';

// Request object for creating new loops
export interface CreateLoopRequest {
  name: string;
  startTime: number;
  endTime: number;
  playbackSpeed?: number;
  repeatCount?: number;
  color?: string;
}

// Request object for updating existing loops
export interface UpdateLoopRequest {
  id: string;
  name?: string;
  startTime?: number;
  endTime?: number;
  playbackSpeed?: number;
  repeatCount?: number;
  color?: string;
  isActive?: boolean;
}

// Validation result for loop operations
export interface LoopValidationResult {
  isValid: boolean;
  errors: LoopValidationError[];
  warnings: string[];
  correctedValues?: Partial<LoopSegment>;
}

// Validation error codes
export enum LoopValidationError {
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  OVERLAPPING_LOOPS = 'OVERLAPPING_LOOPS', 
  EXCEEDS_VIDEO_DURATION = 'EXCEEDS_VIDEO_DURATION',
  INVALID_NAME = 'INVALID_NAME',
  INVALID_PLAYBACK_SPEED = 'INVALID_PLAYBACK_SPEED',
  NEGATIVE_TIME = 'NEGATIVE_TIME',
  ZERO_DURATION = 'ZERO_DURATION',
  DUPLICATE_NAME = 'DUPLICATE_NAME'
}

// Configuration for loop behavior
export interface LoopConfiguration {
  allowOverlapping: boolean;
  maxLoopsPerVideo: number;
  minDuration: number; // minimum loop duration in seconds
  maxDuration: number; // maximum loop duration in seconds
  defaultColor: string;
  defaultPlaybackSpeed: number;
}

// Default configuration values
export const DEFAULT_LOOP_CONFIGURATION: LoopConfiguration = {
  allowOverlapping: false,
  maxLoopsPerVideo: 50,
  minDuration: 0.1, // 100ms minimum
  maxDuration: 3600, // 1 hour maximum
  defaultColor: '#3498db',
  defaultPlaybackSpeed: 1.0
};

// Loop statistics for analytics
export interface LoopStatistics {
  totalCount: number;
  activeCount: number;
  totalDuration: number; // sum of all loop durations
  averageDuration: number;
  mostPlayed: LoopSegment | null;
  leastPlayed: LoopSegment | null;
  totalPlayTime: number; // total time spent playing loops
}

// Collection validation result
export interface LoopCollectionValidation {
  isValid: boolean;
  criticalIssues: LoopValidationError[];
  warnings: string[];
  suggestions: string[];
  overlappingPairs: Array<{loop1: LoopSegment, loop2: LoopSegment}>;
}

// Loop operation result
export interface LoopOperationResult {
  success: boolean;
  loop?: LoopSegment;
  error?: string;
  validation?: LoopValidationResult;
}

// Conflict resolution options
export interface LoopConflictResolution {
  strategy: 'merge' | 'keep_first' | 'keep_last' | 'adjust_times';
  preserveNames: boolean;
  adjustmentMode: 'auto' | 'manual';
}

// Result of conflict resolution
export interface LoopConflictResult {
  resolvedLoops: LoopSegment[];
  removedLoops: LoopSegment[];
  modifications: Array<{
    originalLoop: LoopSegment;
    modifiedLoop: LoopSegment;
    changeType: 'time_adjusted' | 'merged' | 'renamed';
  }>;
}