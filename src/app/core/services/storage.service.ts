import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SecureStorageService {
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_SINGLE_ITEM_SIZE = 1024 * 1024; // 1MB per item

  /**
   * Validate if localStorage is available and functional
   */
  private validateStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate current localStorage usage in bytes
   */
  private calculateStorageSize(): number {
    let totalSize = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          if (value) {
            // Add key length + value length + some overhead
            totalSize += key.length + value.length + 4;
          }
        }
      }
    } catch (error) {
      console.error('Error calculating storage size:', error);
    }
    return totalSize;
  }

  /**
   * Validate if data size is within limits
   */
  private validateSizeLimit(data: unknown, maxSize: number = this.MAX_SINGLE_ITEM_SIZE): boolean {
    try {
      const serializedSize = JSON.stringify(data).length;
      const currentSize = this.calculateStorageSize();
      
      if (serializedSize > maxSize) {
        console.warn(`Data size (${serializedSize} bytes) exceeds single item limit (${maxSize} bytes)`);
        return false;
      }
      
      if (currentSize + serializedSize > this.MAX_STORAGE_SIZE) {
        console.warn(`Total storage would exceed limit: ${currentSize + serializedSize} > ${this.MAX_STORAGE_SIZE}`);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Securely serialize data to JSON string
   */
  private serializeData(data: unknown): string {
    try {
      return JSON.stringify(data, (_key, value) => {
        // Filter out functions and undefined values
        if (typeof value === 'function' || value === undefined) {
          return null;
        }
        // Prevent potential XSS by sanitizing strings
        if (typeof value === 'string') {
          return value.replace(/<script[^>]*>.*?<\/script>/gi, '');
        }
        return value;
      });
    } catch (error) {
      console.error('Serialization error:', error);
      throw new Error('Failed to serialize data');
    }
  }

  /**
   * Securely deserialize JSON string to object
   */
  private deserializeData<T>(jsonString: string): T {
    try {
      // Basic JSON validation before parsing
      if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid JSON string');
      }
      
      // Check for potential malicious content
      if (jsonString.includes('<script') || jsonString.includes('javascript:')) {
        throw new Error('Potentially malicious content detected');
      }
      
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Deserialization error:', error);
      throw new Error('Failed to deserialize data');
    }
  }

  /**
   * Sanitize data by removing potentially harmful properties
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip function properties and potentially dangerous keys
        if (typeof value === 'function' || 
            key.startsWith('__') || 
            key.includes('script') || 
            key.includes('eval')) {
          continue;
        }
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    
    // For primitive values, just return them
    return data;
  }

  /**
   * Generic method to save data with security checks
   */
  saveData<T>(key: string, data: T): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        console.error('localStorage is not available');
        return false;
      }

      const sanitizedData = this.sanitizeData(data);
      
      if (!this.validateSizeLimit(sanitizedData)) {
        return false;
      }

      const serialized = this.serializeData(sanitizedData);
      localStorage.setItem(key, serialized);
      
      return true;
    } catch (error) {
      console.error('Storage save error:', error);
      return false;
    }
  }

  /**
   * Generic method to load data with fallback
   */
  loadData<T>(key: string, defaultValue: T): T {
    try {
      if (!this.validateStorageAvailable()) {
        console.warn('localStorage is not available, returning default value');
        return defaultValue;
      }

      const item = localStorage.getItem(key);
      if (!item) {
        return defaultValue;
      }

      const parsed = this.deserializeData<T>(item);
      return this.sanitizeData(parsed);
    } catch (error) {
      console.error('Storage load error:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data from localStorage
   */
  removeData(key: string): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        return false;
      }
      
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage removal error:', error);
      return false;
    }
  }

  /**
   * Clear all data from localStorage
   */
  clearAll(): boolean {
    try {
      if (!this.validateStorageAvailable()) {
        return false;
      }
      
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  /**
   * Get current storage size in bytes
   */
  getStorageSize(): number {
    return this.calculateStorageSize();
  }

  /**
   * Get storage information for monitoring
   */
  getStorageInfo() {
    const currentSize = this.calculateStorageSize();
    const isAvailable = this.validateStorageAvailable();
    
    return {
      available: isAvailable,
      currentSize,
      maxSize: this.MAX_STORAGE_SIZE,
      utilizationPercentage: (currentSize / this.MAX_STORAGE_SIZE) * 100,
      remainingSize: this.MAX_STORAGE_SIZE - currentSize
    };
  }

  /**
   * Check if storage is healthy and functional
   */
  isStorageHealthy(): boolean {
    try {
      const info = this.getStorageInfo();
      return info.available && 
             info.utilizationPercentage < 90 && 
             info.remainingSize > 50000; // At least 50KB remaining
    } catch {
      return false;
    }
  }
}