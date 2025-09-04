import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { ImageLazyLoadingService } from '../services/image-lazy-loading.service';

@Directive({
  selector: 'img[appLazyImg]'
})
export class LazyImgDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLImageElement>);
  private readonly lazyLoadingService = inject(ImageLazyLoadingService);

  @Input() appLazyImg!: string; // The lazy image source
  @Input() lazyPlaceholder?: string; // Optional placeholder image
  @Input() lazySrcset?: string; // Optional responsive image srcset

  ngOnInit(): void {
    const img = this.el.nativeElement;
    
    // Set up lazy loading attributes
    img.setAttribute('data-src', this.appLazyImg);
    
    if (this.lazySrcset) {
      img.setAttribute('data-srcset', this.lazySrcset);
    }
    
    // Set placeholder if provided
    if (this.lazyPlaceholder) {
      img.src = this.lazyPlaceholder;
    }
    
    // Add loading classes for styling
    img.classList.add('lazy-loading');
    
    // Add loading attribute for browser-level lazy loading support
    img.loading = 'lazy';
    
    // Add decode attribute for better performance
    img.decoding = 'async';
    
    // Start observing the image
    this.lazyLoadingService.observeImage(img);
  }

  ngOnDestroy(): void {
    // Cleanup is handled by the service
  }
}