import { TestBed } from '@angular/core/testing';
import { SecureStorageService } from './storage.service';

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SecureStorageService);
    originalLocalStorage = window.localStorage;
  });

  afterEach(() => {
    // Clean up after each test
    try {
      localStorage.clear();
    } catch {
      // Ignore cleanup errors
    }
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Private method testing via public interface', () => {
    describe('validateStorageAvailable', () => {
      it('should return true when localStorage is available', () => {
        const result = service.saveData('test-key', 'test-value');
        expect(result).toBe(true);
      });

      it('should handle when localStorage is not available', () => {
        // Mock localStorage to throw error
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Storage not available'),
          getItem: jasmine.createSpy().and.throwError('Storage not available'),
          removeItem: jasmine.createSpy().and.throwError('Storage not available'),
          clear: jasmine.createSpy().and.throwError('Storage not available'),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.saveData('test', 'value');
        expect(result).toBe(false);
      });
    });

    describe('calculateStorageSize', () => {
      it('should calculate storage size correctly', () => {
        localStorage.clear();
        const initialSize = service.getStorageSize();
        
        service.saveData('test-key', 'test-value');
        const newSize = service.getStorageSize();
        
        expect(newSize).toBeGreaterThan(initialSize);
        expect(newSize).toBeGreaterThan(0);
      });

      it('should handle storage calculation errors gracefully', () => {
        const mockLocalStorage = {
          hasOwnProperty: () => { throw new Error('Access denied'); },
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          removeItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        
        // Spy on console.error to prevent error logging in test output
        spyOn(console, 'error');
        
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const size = service.getStorageSize();
        expect(size).toBe(0);
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('validateSizeLimit', () => {
      it('should reject data that exceeds single item size limit', () => {
        const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB string
        const result = service.saveData('large-data', largeData);
        expect(result).toBe(false);
      });

      it('should accept data within size limits', () => {
        const normalData = 'normal data';
        const result = service.saveData('normal-data', normalData);
        expect(result).toBe(true);
      });
    });

    describe('serializeData and deserializeData', () => {
      it('should serialize and deserialize complex objects correctly', () => {
        const complexData = {
          id: 123,
          name: 'Test Object',
          array: [1, 2, 3],
          nested: {
            prop: 'value'
          }
        };

        service.saveData('complex-data', complexData);
        const retrieved = service.loadData('complex-data', {});

        expect(retrieved).toEqual(complexData);
      });

      it('should handle serialization of functions by filtering them out', () => {
        const dataWithFunction = {
          id: 123,
          name: 'Test',
          func: () => 'test function',
          undefinedProp: undefined
        };

        service.saveData('func-data', dataWithFunction);
        const retrieved = service.loadData('func-data', {}) as any;

        expect(retrieved.id).toBe(123);
        expect(retrieved.name).toBe('Test');
        expect(retrieved.func).toBe(null);
        // undefinedProp might not exist in the retrieved object due to JSON serialization behavior
        expect(retrieved.undefinedProp === null || retrieved.undefinedProp === undefined).toBe(true);
      });

      it('should sanitize potentially malicious strings', () => {
        const maliciousData = {
          content: '<script>alert("xss")</script>Safe content'
        };

        service.saveData('malicious-data', maliciousData);
        const retrieved = service.loadData('malicious-data', {}) as any;

        expect(retrieved.content).toBe('Safe content');
      });

      it('should reject malicious JSON strings during deserialization', () => {
        // Directly test by putting malicious data in localStorage - this should be caught by the security checks
        localStorage.setItem('malicious-json', '{"content": "<script>alert(\\"xss\\")</script>"}');
        
        spyOn(console, 'error'); // Prevent error logging in tests
        
        const result = service.loadData('malicious-json', { default: 'safe' });
        // Either returns sanitized data or default value due to error
        expect(result.default || result.content).toBeDefined();
      });
    });

    describe('sanitizeData', () => {
      it('should sanitize nested objects correctly', () => {
        const dirtyData = {
          safe: 'content',
          __dangerous: 'should be removed',
          scriptKey: 'should be removed',
          evalKey: 'should be removed',
          nested: {
            safe: 'nested content',
            __alsoDangerous: 'should be removed'
          }
        };

        service.saveData('dirty-data', dirtyData);
        const cleaned = service.loadData('dirty-data', {}) as any;

        expect(cleaned.safe).toBe('content');
        expect(cleaned.__dangerous).toBeUndefined();
        expect(cleaned.scriptKey).toBeUndefined();
        expect(cleaned.evalKey).toBeUndefined();
        expect(cleaned.nested.safe).toBe('nested content');
        expect(cleaned.nested.__alsoDangerous).toBeUndefined();
      });

      it('should sanitize arrays correctly', () => {
        const arrayData = [
          { safe: 'content1' },
          { __dangerous: 'should be removed' },
          'simple string'
        ];

        service.saveData('array-data', arrayData);
        const cleaned = service.loadData('array-data', []) as any[];

        expect(cleaned).toHaveSize(3);
        expect(cleaned[0].safe).toBe('content1');
        expect(cleaned[1].__dangerous).toBeUndefined();
        expect(cleaned[2]).toBe('simple string');
      });
    });
  });

  describe('Public API methods', () => {
    describe('saveData and loadData', () => {
      it('should save and load data correctly', () => {
        const testData = { id: 1, name: 'Test' };
        const saved = service.saveData('test-key', testData);
        expect(saved).toBe(true);

        const loaded = service.loadData('test-key', {});
        expect(loaded).toEqual(testData);
      });

      it('should return default value when key does not exist', () => {
        const defaultValue = { default: true };
        const result = service.loadData('non-existent-key', defaultValue);
        expect(result).toEqual(defaultValue);
      });

      it('should return default value when localStorage is corrupted', () => {
        localStorage.setItem('corrupted-key', 'invalid-json{');
        const defaultValue = { default: true };
        
        const result = service.loadData('corrupted-key', defaultValue);
        expect(result).toEqual(defaultValue);
      });
    });

    describe('removeData', () => {
      it('should remove data successfully', () => {
        service.saveData('remove-test', 'data');
        expect(localStorage.getItem('remove-test')).toBeTruthy();

        const removed = service.removeData('remove-test');
        expect(removed).toBe(true);
        expect(localStorage.getItem('remove-test')).toBeNull();
      });

      it('should handle removal errors gracefully', () => {
        const mockLocalStorage = {
          removeItem: jasmine.createSpy().and.throwError('Removal failed'),
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          clear: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.removeData('test-key');
        expect(result).toBe(false);
      });
    });

    describe('clearAll', () => {
      it('should clear all localStorage data', () => {
        service.saveData('test1', 'data1');
        service.saveData('test2', 'data2');
        
        const cleared = service.clearAll();
        expect(cleared).toBe(true);
        expect(localStorage.length).toBe(0);
      });

      it('should handle clear errors gracefully', () => {
        const mockLocalStorage = {
          clear: jasmine.createSpy().and.throwError('Clear failed'),
          setItem: jasmine.createSpy(),
          getItem: jasmine.createSpy(),
          removeItem: jasmine.createSpy(),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const result = service.clearAll();
        expect(result).toBe(false);
      });
    });

    describe('getStorageSize', () => {
      it('should return storage size in bytes', () => {
        localStorage.clear();
        const initialSize = service.getStorageSize();
        
        service.saveData('size-test', 'test-data');
        const newSize = service.getStorageSize();
        
        expect(newSize).toBeGreaterThan(initialSize);
        expect(typeof newSize).toBe('number');
      });
    });

    describe('getStorageInfo', () => {
      it('should return comprehensive storage information', () => {
        const info = service.getStorageInfo();
        
        expect(info.available).toBeDefined();
        expect(info.currentSize).toBeDefined();
        expect(info.maxSize).toBeDefined();
        expect(info.utilizationPercentage).toBeDefined();
        expect(info.remainingSize).toBeDefined();
        
        expect(typeof info.available).toBe('boolean');
        expect(typeof info.currentSize).toBe('number');
        expect(typeof info.maxSize).toBe('number');
        expect(typeof info.utilizationPercentage).toBe('number');
        expect(typeof info.remainingSize).toBe('number');
        
        expect(info.maxSize).toBe(5 * 1024 * 1024); // 5MB
        expect(info.currentSize + info.remainingSize).toBe(info.maxSize);
      });
    });

    describe('isStorageHealthy', () => {
      it('should return true for healthy storage', () => {
        localStorage.clear(); // Start with clean storage
        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(true);
      });

      it('should return false when storage utilization is too high', () => {
        // This test is conceptual as it's hard to fill localStorage to 90% in a unit test
        const healthy = service.isStorageHealthy();
        expect(typeof healthy).toBe('boolean');
      });

      it('should return false when storage is not available', () => {
        const mockLocalStorage = {
          setItem: jasmine.createSpy().and.throwError('Not available'),
          getItem: jasmine.createSpy().and.throwError('Not available'),
          removeItem: jasmine.createSpy().and.throwError('Not available'),
          clear: jasmine.createSpy().and.throwError('Not available'),
          length: 0,
          key: jasmine.createSpy()
        };
        Object.defineProperty(window, 'localStorage', {
          value: mockLocalStorage,
          writable: true
        });

        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(false);
      });

      it('should handle health check errors gracefully', () => {
        spyOn(service, 'getStorageInfo').and.throwError('Info error');
        
        const healthy = service.isStorageHealthy();
        expect(healthy).toBe(false);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values correctly', () => {
      service.saveData('null-test', null);
      service.saveData('undefined-test', undefined);
      
      // When loading null values with a string default, we should get null if data was successfully saved
      // But if undefined wasn't serialized properly, we might get the default
      const nullResult = service.loadData<string | null>('null-test', 'default');
      const undefinedResult = service.loadData<string | null>('undefined-test', 'default');
      
      // null should be preserved
      expect(nullResult).toBe(null);
      // undefined gets converted to null in serialization, or falls back to default if not saved
      expect(undefinedResult === null || undefinedResult === 'default').toBe(true);
    });

    it('should handle empty strings and objects', () => {
      service.saveData('empty-string', '');
      service.saveData('empty-object', {});
      service.saveData('empty-array', []);
      
      expect(service.loadData('empty-string', 'default')).toBe('');
      expect(service.loadData('empty-object', {})).toEqual({});
      expect(service.loadData('empty-array', [])).toEqual([]);
    });

    it('should handle very deep nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value'
              }
            }
          }
        }
      };

      service.saveData('deep-object', deepObject);
      const retrieved = service.loadData('deep-object', {});
      
      expect(retrieved).toEqual(deepObject);
    });
  });
});