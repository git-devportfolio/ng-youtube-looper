import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VideoPlayerFacade } from '../../data-access/video-player.facade';
import { PlayerControlsComponent } from '../player-controls';
import { SpeedControlComponent } from '../speed-control';
import { KeyboardShortcutsService } from '@shared/services';

@Component({
  selector: 'app-video-player',
  imports: [CommonModule, ReactiveFormsModule, PlayerControlsComponent, SpeedControlComponent],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  readonly facade = inject(VideoPlayerFacade);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly keyboardShortcuts = inject(KeyboardShortcutsService);
  
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
  private currentTimePolling: number | null = null;

  constructor() {
    // Effect to start/stop currentTime polling based on playback state
    effect(() => {
      const isPlaying = this.facade.vm().isPlaying;
      if (isPlaying) {
        this.startCurrentTimePolling();
      } else {
        this.stopCurrentTimePolling();
      }
    });
  }

  ngOnInit() {
    // Sync URL input with facade
    this.urlControl.valueChanges.subscribe(value => {
      this.facade.setUrlInput(value || '');
    });

    // Detect touch device capability
    this.detectTouchDevice();

    // Set up iframe event listeners for YouTube API synchronization
    this.setupIFrameEventListeners();

    // Register keyboard shortcuts for video player
    this.registerVideoPlayerShortcuts();
  }

  ngOnDestroy() {
    this.facade.reset();
    if (this.overlayHideTimeout) {
      clearTimeout(this.overlayHideTimeout);
    }
    this.stopCurrentTimePolling();
    this.removeIFrameEventListeners();
    this.unregisterVideoPlayerShortcuts();
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
  getYouTubeEmbedUrl(): SafeResourceUrl {
    const currentVideo = this.facade.vm().currentVideo;
    if (!currentVideo || !currentVideo.videoId) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('');
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

    const url = `${baseUrl}/${videoId}?${params.toString()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * For testing purposes - returns the raw URL string without SafeResourceUrl wrapping
   */
  getYouTubeEmbedUrlString(): string {
    const currentVideo = this.facade.vm().currentVideo;
    if (!currentVideo || !currentVideo.videoId) {
      return '';
    }

    const baseUrl = 'https://www.youtube.com/embed';
    const videoId = currentVideo.videoId;
    
    const params = new URLSearchParams({
      autoplay: '0',
      controls: '0',
      enablejsapi: '1',
      origin: window.location.origin,
      rel: '0',
      modestbranding: '1',
      iv_load_policy: '3',
      fs: '1',
      playsinline: '1'
    });

    return `${baseUrl}/${videoId}?${params.toString()}`;
  }

  /**
   * Override facade play method to use iframe communication
   */
  playVideo(): void {
    this.sendYouTubeCommand('playVideo');
    this.facade.play(); // Also call facade for state management
  }

  /**
   * Override facade pause method to use iframe communication
   */
  pauseVideo(): void {
    this.sendYouTubeCommand('pauseVideo');
    this.facade.pause(); // Also call facade for state management
  }

  /**
   * Override facade seekTo method to use iframe communication
   */
  seekToTime(seconds: number): void {
    this.sendYouTubeCommand('seekTo', [seconds, true]);
    this.facade.seekTo(seconds); // Also call facade for state management
  }

  /**
   * Override facade setPlaybackRate method to use iframe communication
   */
  setVideoPlaybackRate(rate: number): void {
    this.sendYouTubeCommand('setPlaybackRate', [rate]);
    this.facade.setPlaybackRate(rate); // Also call facade for state management
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
   * Determines if the video is currently loading
   * Combines local loading state with facade loading states
   */
  isVideoLoading(): boolean {
    const vm = this.facade.vm();
    return this.loading() || (!vm.isPlayerReady && !!vm.currentVideo);
  }

  /**
   * Retry loading the current video after an error
   */
  async retryVideo(): Promise<void> {
    const currentVideo = this.facade.vm().currentVideo;
    if (!currentVideo) {
      return;
    }

    try {
      this.loading.set(true);
      await this.facade.loadVideo(currentVideo.url || '');
    } catch (error) {
      console.error('Erreur lors du rechargement de la vidéo:', error);
    } finally {
      this.loading.set(false);
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

  /**
   * Sets up event listeners for iframe-parent communication via postMessage API
   */
  private setupIFrameEventListeners(): void {
    window.addEventListener('message', this.handleIFrameMessage.bind(this));
  }

  /**
   * Removes iframe event listeners
   */
  private removeIFrameEventListeners(): void {
    window.removeEventListener('message', this.handleIFrameMessage.bind(this));
  }

  /**
   * Handles postMessage events from YouTube iframe
   */
  private handleIFrameMessage(event: MessageEvent): void {
    // Ensure message is from YouTube
    if (event.origin !== 'https://www.youtube.com') {
      return;
    }

    try {
      const data = JSON.parse(event.data);
      
      if (data.event === 'video-progress') {
        // Sync current time from iframe
        // Note: For now, we'll delegate to the existing facade implementation
        // In a real implementation, we'd need to expose updatePlayerState on the facade
        console.log('Video progress:', data.info?.currentTime);
      } else if (data.event === 'onStateChange') {
        // Sync playback state changes
        this.handleYouTubeStateChange(data.info);
      } else if (data.event === 'onReady') {
        // Video is ready
        this.handleYouTubeReady(data.info);
      } else if (data.event === 'onError') {
        // Handle YouTube errors
        this.handleYouTubeError(data.data);
      }
    } catch (error) {
      // Ignore non-JSON messages
    }
  }

  /**
   * Handles YouTube player ready event
   */
  private handleYouTubeReady(info: any): void {
    // For now, log the ready state - in real implementation would sync with facade
    console.log('YouTube player ready:', info);
    // TODO: Need facade method to expose updatePlayerState or use different sync approach
  }

  /**
   * Handles YouTube player state changes
   */
  private handleYouTubeStateChange(info: any): void {
    const isPlaying = info?.playerState === 1; // YT.PlayerState.PLAYING = 1
    
    // For now, log state changes - in real implementation would sync with facade
    console.log('YouTube state change:', { isPlaying, info });
    // TODO: Need facade method to expose updatePlayerState or use different sync approach
  }

  /**
   * Handles YouTube player errors
   */
  private handleYouTubeError(errorCode: number): void {
    const errorMessages: { [key: number]: string } = {
      2: 'ID vidéo invalide',
      5: 'Erreur de lecture HTML5',
      100: 'Vidéo introuvable ou privée',
      101: 'Lecture non autorisée par le propriétaire',
      150: 'Lecture non autorisée par le propriétaire'
    };

    const errorMessage = errorMessages[errorCode] || `Erreur YouTube inconnue (${errorCode})`;
    
    // For now, log errors - in real implementation would sync with facade
    console.error('YouTube player error:', errorMessage);
    // TODO: Need facade method to expose updatePlayerState or use different sync approach
  }

  /**
   * Starts polling for current time updates during video playback
   */
  private startCurrentTimePolling(): void {
    if (this.currentTimePolling) {
      return; // Already polling
    }

    this.currentTimePolling = window.setInterval(() => {
      if (this.youtubePlayerRef?.nativeElement) {
        // Send postMessage to iframe to get current time
        this.youtubePlayerRef.nativeElement.contentWindow?.postMessage(
          '{"event":"command","func":"getCurrentTime","args":""}',
          'https://www.youtube.com'
        );
      }
    }, 250); // Update every 250ms for smooth progress
  }

  /**
   * Stops current time polling
   */
  private stopCurrentTimePolling(): void {
    if (this.currentTimePolling) {
      clearInterval(this.currentTimePolling);
      this.currentTimePolling = null;
    }
  }

  /**
   * Sends commands to YouTube iframe via postMessage
   */
  private sendYouTubeCommand(command: string, args?: any[]): void {
    if (!this.youtubePlayerRef?.nativeElement) {
      return;
    }

    const message = {
      event: 'command',
      func: command,
      args: args ? JSON.stringify(args) : ''
    };

    this.youtubePlayerRef.nativeElement.contentWindow?.postMessage(
      JSON.stringify(message),
      'https://www.youtube.com'
    );
  }

  /**
   * Registers keyboard shortcuts for video player functionality
   */
  private registerVideoPlayerShortcuts(): void {
    // Space bar - Play/Pause
    this.keyboardShortcuts.registerShortcut({
      key: ' ',
      description: 'Lire/Mettre en pause la vidéo',
      category: 'video',
      action: () => {
        if (this.facade.vm().isPlaying) {
          this.pauseVideo();
        } else {
          this.playVideo();
        }
      },
      enabled: true
    });

    // Arrow keys - Seek
    this.keyboardShortcuts.registerShortcut({
      key: 'ArrowLeft',
      description: 'Reculer de 5 secondes',
      category: 'video',
      action: () => {
        const currentTime = this.facade.vm().currentTime;
        this.seekToTime(Math.max(0, currentTime - 5));
      },
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: 'ArrowRight',
      description: 'Avancer de 5 secondes',
      category: 'video',
      action: () => {
        const currentTime = this.facade.vm().currentTime;
        const duration = this.facade.vm().duration;
        this.seekToTime(Math.min(duration, currentTime + 5));
      },
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: 'ArrowLeft',
      shiftKey: true,
      description: 'Reculer de 10 secondes',
      category: 'video',
      action: () => {
        const currentTime = this.facade.vm().currentTime;
        this.seekToTime(Math.max(0, currentTime - 10));
      },
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: 'ArrowRight',
      shiftKey: true,
      description: 'Avancer de 10 secondes',
      category: 'video',
      action: () => {
        const currentTime = this.facade.vm().currentTime;
        const duration = this.facade.vm().duration;
        this.seekToTime(Math.min(duration, currentTime + 10));
      },
      enabled: true
    });

    // Number keys for playback speed
    this.keyboardShortcuts.registerShortcut({
      key: '1',
      description: 'Vitesse x0.25',
      category: 'video',
      action: () => this.setVideoPlaybackRate(0.25),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '2',
      description: 'Vitesse x0.5',
      category: 'video',
      action: () => this.setVideoPlaybackRate(0.5),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '3',
      description: 'Vitesse x0.75',
      category: 'video',
      action: () => this.setVideoPlaybackRate(0.75),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '4',
      description: 'Vitesse normale (x1)',
      category: 'video',
      action: () => this.setVideoPlaybackRate(1),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '5',
      description: 'Vitesse x1.25',
      category: 'video',
      action: () => this.setVideoPlaybackRate(1.25),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '6',
      description: 'Vitesse x1.5',
      category: 'video',
      action: () => this.setVideoPlaybackRate(1.5),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '7',
      description: 'Vitesse x1.75',
      category: 'video',
      action: () => this.setVideoPlaybackRate(1.75),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: '8',
      description: 'Vitesse x2',
      category: 'video',
      action: () => this.setVideoPlaybackRate(2),
      enabled: true
    });

    // Home/End keys - Jump to beginning/end
    this.keyboardShortcuts.registerShortcut({
      key: 'Home',
      description: 'Aller au début de la vidéo',
      category: 'video',
      action: () => this.seekToTime(0),
      enabled: true
    });

    this.keyboardShortcuts.registerShortcut({
      key: 'End',
      description: 'Aller à la fin de la vidéo',
      category: 'video',
      action: () => {
        const duration = this.facade.vm().duration;
        this.seekToTime(duration - 1);
      },
      enabled: true
    });
  }

  /**
   * Unregisters all video player keyboard shortcuts
   */
  private unregisterVideoPlayerShortcuts(): void {
    const shortcuts = [
      { key: ' ' },
      { key: 'ArrowLeft' },
      { key: 'ArrowRight' },
      { key: 'ArrowLeft', shiftKey: true },
      { key: 'ArrowRight', shiftKey: true },
      { key: '1' },
      { key: '2' },
      { key: '3' },
      { key: '4' },
      { key: '5' },
      { key: '6' },
      { key: '7' },
      { key: '8' },
      { key: 'Home' },
      { key: 'End' }
    ];

    shortcuts.forEach(shortcut => {
      this.keyboardShortcuts.unregisterShortcut(shortcut);
    });
  }
}