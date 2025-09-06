import { Component, HostListener } from '@angular/core';
import { FocusTrapDirective } from '../../directives';

@Component({
  selector: 'app-accessibility-help',
  imports: [FocusTrapDirective],
  templateUrl: './accessibility-help.component.html',
  styleUrl: './accessibility-help.component.scss'
})
export class AccessibilityHelpComponent {
  isVisible = false;

  /**
   * Open the accessibility help modal
   */
  open(): void {
    this.isVisible = true;
    this.announceToScreenReader('Guide d\'accessibilité ouvert');
  }

  /**
   * Close the accessibility help modal
   */
  close(): void {
    this.isVisible = false;
    this.announceToScreenReader('Guide d\'accessibilité fermé');
  }

  /**
   * Handle escape key to close modal
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isVisible) {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * Handle help shortcut (F1 or ?)
   */
  @HostListener('document:keydown', ['$event'])
  onHelpShortcut(event: KeyboardEvent): void {
    // F1 key or Shift + ? for help
    if (event.key === 'F1' || (event.shiftKey && event.key === '?')) {
      event.preventDefault();
      if (this.isVisible) {
        this.close();
      } else {
        this.open();
      }
    }
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
}