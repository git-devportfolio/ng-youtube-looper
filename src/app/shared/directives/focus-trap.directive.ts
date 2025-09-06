import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  Input,
  Renderer2,
  inject
} from '@angular/core';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true
})
export class FocusTrapDirective implements OnInit, OnDestroy {
  @Input() appFocusTrap = true;
  @Input() restoreFocus = true;
  @Input() initialFocus?: string; // CSS selector for initial focus element

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];
  private isTrapping = false;
  
  // Focusable element selectors
  private readonly focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
    '[contenteditable="true"]',
    'audio[controls]',
    'video[controls]',
    'details summary',
    'iframe'
  ].join(',');

  ngOnInit(): void {
    if (this.appFocusTrap) {
      this.enableFocusTrap();
    }
  }

  ngOnDestroy(): void {
    this.disableFocusTrap();
  }

  /**
   * Enable focus trap on the container
   */
  private enableFocusTrap(): void {
    if (this.isTrapping) return;
    
    // Store the currently focused element
    if (this.restoreFocus) {
      this.previouslyFocusedElement = document.activeElement as HTMLElement;
    }
    
    // Update focusable elements
    this.updateFocusableElements();
    
    // Set initial focus
    this.setInitialFocus();
    
    // Add keydown listener for trap logic
    this.renderer.listen(
      this.elementRef.nativeElement,
      'keydown',
      this.handleKeyDown.bind(this)
    );
    
    this.isTrapping = true;
    
    // Announce trap activation to screen readers
    this.announceToScreenReader('Dialogue ouvert. Utilisez Tab pour naviguer, Échap pour fermer.');
  }

  /**
   * Disable focus trap and restore previous focus
   */
  private disableFocusTrap(): void {
    if (!this.isTrapping) return;
    
    this.isTrapping = false;
    
    // Restore focus to previously focused element
    if (this.restoreFocus && this.previouslyFocusedElement) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (this.previouslyFocusedElement && this.isElementVisible(this.previouslyFocusedElement)) {
          this.previouslyFocusedElement.focus();
        }
      });
    }
    
    this.previouslyFocusedElement = null;
  }

  /**
   * Handle keydown events for focus trap
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isTrapping || event.key !== 'Tab') return;
    
    this.updateFocusableElements();
    
    if (this.focusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    
    const firstFocusable = this.focusableElements[0];
    const lastFocusable = this.focusableElements[this.focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;
    
    if (event.shiftKey) {
      // Shift + Tab (backward)
      if (activeElement === firstFocusable || !this.elementRef.nativeElement.contains(activeElement)) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab (forward)
      if (activeElement === lastFocusable || !this.elementRef.nativeElement.contains(activeElement)) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  /**
   * Update the list of focusable elements
   */
  private updateFocusableElements(): void {
    const elements = this.elementRef.nativeElement.querySelectorAll(this.focusableSelector);
    
    this.focusableElements = Array.from(elements)
      .filter((element): element is HTMLElement => {
        return element instanceof HTMLElement && this.isElementVisible(element);
      })
      .sort((a, b) => {
        const aIndex = parseInt(a.getAttribute('tabindex') || '0');
        const bIndex = parseInt(b.getAttribute('tabindex') || '0');
        
        // Elements with tabindex="0" or no tabindex come last
        if (aIndex === 0 && bIndex !== 0) return 1;
        if (bIndex === 0 && aIndex !== 0) return -1;
        
        // Sort by tabindex value
        if (aIndex !== bIndex) return aIndex - bIndex;
        
        // If tabindex values are the same, maintain DOM order
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
  }

  /**
   * Set initial focus within the trap
   */
  private setInitialFocus(): void {
    let initialElement: HTMLElement | null = null;
    
    // Try to focus specified initial element
    if (this.initialFocus) {
      initialElement = this.elementRef.nativeElement.querySelector(this.initialFocus);
    }
    
    // Fallback to first focusable element
    if (!initialElement && this.focusableElements.length > 0) {
      initialElement = this.focusableElements[0];
    }
    
    // Focus the element or the container itself
    if (initialElement) {
      requestAnimationFrame(() => {
        initialElement!.focus();
      });
    } else {
      // If no focusable elements, focus the container
      this.elementRef.nativeElement.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => {
        this.elementRef.nativeElement.focus();
      });
    }
  }

  /**
   * Check if element is visible and focusable
   */
  private isElementVisible(element: HTMLElement): boolean {
    if (!element.offsetParent) return false;
    
    const style = getComputedStyle(element);
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-hidden') === 'true'
    );
  }

  /**
   * Announce message to screen readers
   */
  private announceToScreenReader(message: string): void {
    const statusRegion = document.getElementById('status-announcements');
    if (statusRegion) {
      statusRegion.textContent = message;
      
      // Clear the message after announcement
      setTimeout(() => {
        statusRegion.textContent = '';
      }, 1000);
    }
  }

  /**
   * Public method to update trap when content changes
   */
  updateFocusTrap(): void {
    if (this.isTrapping) {
      this.updateFocusableElements();
    }
  }

  /**
   * Public method to manually enable trap
   */
  enableTrap(): void {
    if (!this.isTrapping) {
      this.appFocusTrap = true;
      this.enableFocusTrap();
    }
  }

  /**
   * Public method to manually disable trap
   */
  disableTrap(): void {
    if (this.isTrapping) {
      this.appFocusTrap = false;
      this.disableFocusTrap();
    }
  }
}