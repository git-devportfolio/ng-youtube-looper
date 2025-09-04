import { Component, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent implements OnInit {
  private document = inject(DOCUMENT);

  // App information
  appVersion = '1.0.0';
  angularVersion = '19.2';
  currentYear = new Date().getFullYear();
  connectionStatus = 'En ligne';
  currentTheme = 'light';

  ngOnInit(): void {
    this.detectTheme();
    this.setupThemeListener();
  }

  /**
   * Scroll to top of the page
   */
  scrollToTop(event: Event): void {
    event.preventDefault();
    this.document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  /**
   * Open external link in new tab
   */
  openExternalLink(event: Event, url: string): void {
    event.preventDefault();
    this.document.defaultView?.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme(): void {
    const body = this.document.body;
    const currentTheme = body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    body.setAttribute('data-theme', newTheme);
    this.currentTheme = newTheme;
    
    // Save theme preference
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (error) {
      console.warn('Could not save theme preference:', error);
    }
  }

  /**
   * Detect current theme from document or localStorage
   */
  private detectTheme(): void {
    try {
      // Try to get theme from localStorage first
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        this.currentTheme = savedTheme;
        this.document.body.setAttribute('data-theme', savedTheme);
        return;
      }
    } catch (error) {
      console.warn('Could not access localStorage:', error);
    }

    // Fallback to document attribute or default
    const bodyTheme = this.document.body.getAttribute('data-theme');
    this.currentTheme = bodyTheme === 'dark' ? 'dark' : 'light';
  }

  /**
   * Listen for theme changes (e.g., from other components)
   */
  private setupThemeListener(): void {
    // Listen for storage changes (when theme is changed in another tab)
    this.document.defaultView?.addEventListener('storage', (event) => {
      if (event.key === 'app-theme' && event.newValue) {
        this.currentTheme = event.newValue;
        this.document.body.setAttribute('data-theme', event.newValue);
      }
    });

    // Listen for theme changes via MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = this.document.body.getAttribute('data-theme') || 'light';
          if (newTheme !== this.currentTheme) {
            this.currentTheme = newTheme;
          }
        }
      });
    });

    observer.observe(this.document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }


  /**
   * Navigate to internal section (smooth scroll)
   */
  navigateToSection(sectionId: string, event: Event): void {
    event.preventDefault();
    const element = this.document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  onKeydown(event: KeyboardEvent, action: () => void): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }
}
