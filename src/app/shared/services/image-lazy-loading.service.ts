import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ImageLazyLoadingService {
  private readonly document = inject(DOCUMENT);
  private observer?: IntersectionObserver;

  constructor() {
    this.initIntersectionObserver();
  }

  private initIntersectionObserver(): void {
    if (!this.isIntersectionObserverSupported()) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
            this.observer?.unobserve(img);
          }
        });
      },
      {
        // Start loading when image is 50px away from viewport
        rootMargin: '50px',
        threshold: 0
      }
    );
  }

  observeImage(img: HTMLImageElement): void {
    if (!this.observer || !img) {
      // Fallback: load immediately if observer not available
      this.loadImage(img);
      return;
    }

    this.observer.observe(img);
  }

  private loadImage(img: HTMLImageElement): void {
    const dataSrc = img.getAttribute('data-src');
    const dataSrcset = img.getAttribute('data-srcset');
    
    if (dataSrc) {
      img.src = dataSrc;
      img.removeAttribute('data-src');
    }
    
    if (dataSrcset) {
      img.srcset = dataSrcset;
      img.removeAttribute('data-srcset');
    }

    // Add loaded class for styling
    img.classList.add('lazy-loaded');
    
    // Remove lazy loading placeholder
    img.classList.remove('lazy-loading');
  }

  private isIntersectionObserverSupported(): boolean {
    return 'IntersectionObserver' in this.document.defaultView!;
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}