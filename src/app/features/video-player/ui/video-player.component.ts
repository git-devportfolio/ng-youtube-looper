import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { VideoPlayerFacade } from '../data-access/video-player.facade';
import { PlayerControlsComponent } from './player-controls.component';
import { SpeedControlComponent } from './speed-control.component';

@Component({
  selector: 'app-video-player',
  imports: [CommonModule, ReactiveFormsModule, PlayerControlsComponent, SpeedControlComponent],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  readonly facade = inject(VideoPlayerFacade);
  
  @ViewChild('youtubePlayer', { static: false }) 
  youtubePlayerRef?: ElementRef<HTMLIFrameElement>;

  // Form control for URL input
  readonly urlControl = new FormControl('', [Validators.required]);
  
  // Loading state
  readonly loading = signal(false);

  // Overlay interaction states
  readonly isOverlayVisible = signal(false);
  readonly isHoveringPlayer = signal(false);
  readonly isTouchDevice = signal(false);

  // Subscription cleanup
  private playerInitialized = false;
  private overlayHideTimeout: number | null = null;

  ngOnInit() {
    // Sync URL input with facade
    this.urlControl.valueChanges.subscribe(value => {
      this.facade.setUrlInput(value || '');
    });

    // Detect touch device capability
    this.detectTouchDevice();

    // Auto-initialize player when video changes
    // Note: For signals, we would use effect() instead of subscribe()
    // For now, we'll initialize the player manually in loadVideo()
  }

  ngOnDestroy() {
    this.facade.reset();
    if (this.overlayHideTimeout) {
      clearTimeout(this.overlayHideTimeout);
    }
  }

  async loadVideo() {
    if (!this.facade.isValidUrl() || this.loading()) {
      return;
    }

    this.loading.set(true);
    
    try {
      const url = this.urlControl.value || '';
      
      if (!this.playerInitialized && this.youtubePlayerRef) {
        // Initialize player with first video
        await this.facade.initializePlayer('youtube-player', url);
        this.playerInitialized = true;
      } else {
        // Load new video in existing player
        await this.facade.loadVideo(url);
      }
      
      // Clear input on successful load
      this.urlControl.setValue('');
    } catch (error) {
      console.error('Erreur lors du chargement de la vidéo:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Generates the YouTube embed URL with appropriate parameters for programmatic control
   */
  getYouTubeEmbedUrl(): string {
    const currentVideo = this.facade.vm().currentVideo;
    if (!currentVideo || !currentVideo.videoId) {
      return '';
    }

    const baseUrl = 'https://www.youtube.com/embed';
    const videoId = currentVideo.videoId;
    
    // YouTube embed parameters for programmatic control
    const params = new URLSearchParams({
      autoplay: '0',           // Don't autoplay
      controls: '0',           // Hide default YouTube controls
      enablejsapi: '1',        // Enable JavaScript API
      origin: window.location.origin, // Set origin for security
      rel: '0',                // Don't show related videos
      modestbranding: '1',     // Modest YouTube branding
      iv_load_policy: '3',     // Hide video annotations
      fs: '1',                 // Allow fullscreen
      playsinline: '1'         // Play inline on mobile
    });

    return `${baseUrl}/${videoId}?${params.toString()}`;
  }

  /**
   * Detects if the current device supports touch interactions
   */
  private detectTouchDevice(): void {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isTouchDevice.set(hasTouch);
  }

  /**
   * Determines if the overlay should be visible
   * Desktop: Show on hover, Touch: Show on tap and auto-hide
   */
  shouldShowOverlay(): boolean {
    const currentVideo = this.facade.vm().currentVideo;
    if (!currentVideo) {
      return false;
    }

    if (this.isTouchDevice()) {
      return this.isOverlayVisible();
    } else {
      return this.isHoveringPlayer();
    }
  }

  /**
   * Handles mouse enter on player wrapper (desktop hover)
   */
  onPlayerMouseEnter(): void {
    if (!this.isTouchDevice()) {
      this.isHoveringPlayer.set(true);
    }
  }

  /**
   * Handles mouse leave on player wrapper (desktop hover)
   */
  onPlayerMouseLeave(): void {
    if (!this.isTouchDevice()) {
      this.isHoveringPlayer.set(false);
    }
  }

  /**
   * Handles touch/click on player wrapper (mobile/tablet touch)
   */
  onPlayerTouch(): void {
    if (this.isTouchDevice()) {
      const isVisible = this.isOverlayVisible();
      this.isOverlayVisible.set(!isVisible);

      // Auto-hide overlay after 3 seconds on touch devices
      if (!isVisible) {
        if (this.overlayHideTimeout) {
          clearTimeout(this.overlayHideTimeout);
        }
        this.overlayHideTimeout = window.setTimeout(() => {
          this.isOverlayVisible.set(false);
        }, 3000);
      }
    }
  }

}