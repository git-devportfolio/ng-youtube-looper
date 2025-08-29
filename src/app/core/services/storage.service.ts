import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

  saveData<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify(data);
      
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('Data too large for localStorage');
        return false;
      }
      
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  loadData<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  removeData(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removal error:', error);
    }
  }

  clearAll(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }

  getStorageSize(): number {
    let totalSize = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage.getItem(key)?.length || 0;
        }
      }
    } catch (error) {
      console.error('Error calculating storage size:', error);
    }
    return totalSize;
  }
}