// Core services barrel exports

export { LoopService } from './loop.service';
export type { 
  Loop, 
  LoopValidationResult, 
  LoopValidationError 
} from './loop.service';
export { DEFAULT_LOOP_CONFIG } from './loop.service';

export { ValidationService } from './validation.service';

export { StorageService } from './storage.service';
export type {
  VideoSession,
  SessionLoop,
  HistoryEntry,
  AppSettings,
  StorageError as StorageErrorInterface
} from './storage.types';
export { StorageError } from './storage.types';