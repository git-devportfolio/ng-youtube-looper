import { Injectable } from '@angular/core';
import { fromEvent, Subject, takeUntil, filter, map } from 'rxjs';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  preventDefault?: boolean;
  description: string;
  category: 'video' | 'loop' | 'navigation' | 'global';
  action: () => void;
  enabled: boolean;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService {
  private readonly destroy$ = new Subject<void>();
  private shortcuts = new Map<string, KeyboardShortcut>();
  private enabledShortcuts = new Set<string>();
  private readonly shortcutPressed$ = new Subject<KeyboardShortcut>();

  // Observable for components to listen to shortcut activations
  readonly shortcutActivated$ = this.shortcutPressed$.asObservable();

  constructor() {
    this.initializeGlobalKeyboardListener();
  }

  /**
   * Register a new keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.generateShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
    
    if (shortcut.enabled) {
      this.enabledShortcuts.add(key);
    }
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(shortcut: Partial<KeyboardShortcut>): void {
    const key = this.generateShortcutKey(shortcut);
    this.shortcuts.delete(key);
    this.enabledShortcuts.delete(key);
  }

  /**
   * Enable/disable a specific shortcut
   */
  toggleShortcut(shortcut: Partial<KeyboardShortcut>, enabled: boolean): void {
    const key = this.generateShortcutKey(shortcut);
    const existingShortcut = this.shortcuts.get(key);
    
    if (existingShortcut) {
      existingShortcut.enabled = enabled;
      if (enabled) {
        this.enabledShortcuts.add(key);
      } else {
        this.enabledShortcuts.delete(key);
      }
    }
  }

  /**
   * Get all registered shortcuts grouped by category
   */
  getShortcutsByCategory(): ShortcutCategory[] {
    const categories = new Map<string, KeyboardShortcut[]>();
    
    this.shortcuts.forEach(shortcut => {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, []);
      }
      categories.get(shortcut.category)!.push(shortcut);
    });

    return Array.from(categories.entries()).map(([name, shortcuts]) => ({
      name,
      shortcuts: shortcuts.sort((a, b) => a.key.localeCompare(b.key))
    }));
  }

  /**
   * Get formatted shortcut display string
   */
  getShortcutDisplayString(shortcut: Partial<KeyboardShortcut>): string {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.metaKey) parts.push('Cmd');
    
    if (shortcut.key) {
      // Format special keys
      const keyMap: Record<string, string> = {
        ' ': 'Space',
        'Escape': 'Esc',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Enter': '⏎',
      };
      
      parts.push(keyMap[shortcut.key] || shortcut.key.toUpperCase());
    }
    
    return parts.join(' + ');
  }

  /**
   * Disable all shortcuts (useful for input focus states)
   */
  disableAllShortcuts(): void {
    this.enabledShortcuts.clear();
  }

  /**
   * Re-enable all registered shortcuts
   */
  enableAllShortcuts(): void {
    this.shortcuts.forEach((shortcut, key) => {
      if (shortcut.enabled) {
        this.enabledShortcuts.add(key);
      }
    });
  }

  /**
   * Check if shortcuts should be disabled (e.g., when input is focused)
   */
  private shouldDisableShortcuts(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    
    // Disable shortcuts when typing in inputs, textareas, or contenteditable elements
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.contentEditable === 'true' ||
      target.isContentEditable
    );
  }

  private initializeGlobalKeyboardListener(): void {
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(
        takeUntil(this.destroy$),
        filter(event => !this.shouldDisableShortcuts(event)),
        map(event => {
          const key = this.generateShortcutKey({
            key: event.key,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey
          });
          
          return { event, shortcutKey: key };
        }),
        filter(({ shortcutKey }) => this.enabledShortcuts.has(shortcutKey))
      )
      .subscribe(({ event, shortcutKey }) => {
        const shortcut = this.shortcuts.get(shortcutKey);
        if (shortcut) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
          
          shortcut.action();
          this.shortcutPressed$.next(shortcut);
        }
      });
  }

  private generateShortcutKey(shortcut: Partial<KeyboardShortcut>): string {
    const modifiers = [];
    if (shortcut.ctrlKey) modifiers.push('ctrl');
    if (shortcut.altKey) modifiers.push('alt');
    if (shortcut.shiftKey) modifiers.push('shift');
    if (shortcut.metaKey) modifiers.push('meta');
    
    return [...modifiers, shortcut.key?.toLowerCase()].join('+');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
