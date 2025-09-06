import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skip-links',
  imports: [],
  templateUrl: './skip-links.component.html',
  styleUrl: './skip-links.component.scss'
})
export class SkipLinksComponent {
  @Input() showPlayerSkipLinks = false;
  @Input() showLoopSkipLinks = false;

  /**
   * Focus on the target element and provide smooth scrolling
   */
  focusTarget(event: Event, targetId: string): void {
    event.preventDefault();
    
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      // Set focus on the target element
      targetElement.focus();
      
      // If the element isn't naturally focusable, set tabindex temporarily
      if (!this.isNaturallyFocusable(targetElement)) {
        targetElement.setAttribute('tabindex', '-1');
        targetElement.focus();
        
        // Remove tabindex after losing focus to avoid tab order issues
        const removeTempTabindex = () => {
          targetElement.removeAttribute('tabindex');
          targetElement.removeEventListener('blur', removeTempTabindex);
        };
        targetElement.addEventListener('blur', removeTempTabindex);
      }
      
      // Smooth scroll to the element
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });

      // Announce the navigation to screen readers
      this.announceNavigation(targetId);
    }
  }

  /**
   * Check if an element is naturally focusable
   */
  private isNaturallyFocusable(element: HTMLElement): boolean {
    const focusableSelectors = [
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    return focusableSelectors.some(selector => element.matches(selector));
  }

  /**
   * Announce navigation to screen readers
   */
  private announceNavigation(targetId: string): void {
    const announcements: { [key: string]: string } = {
      'main-content': 'Navigation vers le contenu principal',
      'video-player': 'Navigation vers le lecteur vidéo',
      'player-controls': 'Navigation vers les contrôles de lecture',
      'timeline': 'Navigation vers la timeline vidéo',
      'loop-list': 'Navigation vers la liste des boucles',
      'loop-controls': 'Navigation vers les contrôles de boucles'
    };

    const message = announcements[targetId] || `Navigation vers ${targetId}`;
    
    // Find the status announcements live region
    const statusRegion = document.getElementById('status-announcements');
    if (statusRegion) {
      statusRegion.textContent = message;
      
      // Clear the message after a short delay
      setTimeout(() => {
        statusRegion.textContent = '';
      }, 1000);
    }
  }
}