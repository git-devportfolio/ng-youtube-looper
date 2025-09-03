// Core services barrel exports

export { LoopService } from './loop.service';
export type { 
  Loop, 
  LoopValidationResult, 
  LoopValidationError 
} from './loop.service';
export { DEFAULT_LOOP_CONFIG } from './loop.service';

export { ValidationService } from './validation.service';

export { SecureStorageService } from './storage.service';
export type {
  VideoSession,
  SessionLoop,
  HistoryEntry,
  AppSettings,
  StorageError as StorageErrorInterface
} from './storage.types';
export { StorageError } from './storage.types';

export { LooperStorageService } from './looper-storage.service';
export type {
  LooperSession,
  SessionSettings,
  CurrentState,
  SessionHistoryEntry,
  SessionMetadata,
  CompressedSessionData,
  StorageOperationResult,
  LooperStorageConfig
} from './looper-storage.types';
export { 
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_LOOPER_STORAGE_CONFIG,
  LOOPER_STORAGE_KEYS
} from './looper-storage.types';

export { SessionManagerService } from './session-manager.service';