import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { YouTubeService, VideoInfo as YouTubeVideoInfo, PlayerState } from '@core/services/youtube.service';

export interface VideoPlayerState {
  currentVideo: YouTubeVideoInfo | null;
  playerState: PlayerState;
  urlInput: string;
  isValidUrl: boolean;
  canPlay: boolean;
  canPause: boolean;
  hasError: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerFacade {
  private readonly youtubeService = inject(YouTubeService);

  // États privés avec Signals
  private readonly _urlInput = signal('');
  
  // Signals publics en lecture seule dérivés du service YouTube
  readonly currentVideo = this.youtubeService.currentVideo;
  readonly playerState = this.youtubeService.playerState;
  readonly urlInput = this._urlInput.asReadonly();

  // ViewModels computed
  readonly isValidUrl = computed(() => {
    const url = this._urlInput();
    return url.length > 0 ? this.youtubeService.isValidYouTubeUrl(url) : false;
  });

  readonly canPlay = computed(() => {
    const state = this.playerState();
    return state.isReady && !state.isPlaying && !state.error;
  });

  readonly canPause = computed(() => {
    const state = this.playerState();
    return state.isReady && state.isPlaying;
  });

  readonly hasError = computed(() => {
    const state = this.playerState();
    return state.error !== null;
  });

  readonly vm = computed<VideoPlayerState>(() => ({
    currentVideo: this.currentVideo(),
    playerState: this.playerState(),
    urlInput: this._urlInput(),
    isValidUrl: this.isValidUrl(),
    canPlay: this.canPlay(),
    canPause: this.canPause(),
    hasError: this.hasError()
  }));

  // Effet pour synchroniser l'état du player
  constructor() {
    // Effet pour logger les changements d'état (dev only)
    effect(() => {
      const state = this.playerState();
      if (state.error) {
        console.warn('YouTube Player Error:', state.error);
      }
    });
  }

  // Commandes publiques
  
  /**
   * Met à jour l'URL d'entrée
   */
  setUrlInput(url: string): void {
    this._urlInput.set(url);
  }

  /**
   * Valide et charge une vidéo YouTube
   */
  async loadVideo(url?: string): Promise<void> {
    const urlToLoad = url || this._urlInput();
    
    if (!urlToLoad) {
      console.warn('Aucune URL fournie pour charger la vidéo');
      return;
    }

    const videoId = this.youtubeService.extractVideoId(urlToLoad);
    if (!videoId) {
      console.warn('URL YouTube invalide:', urlToLoad);
      return;
    }

    try {
      await this.youtubeService.loadVideo(videoId);
      // Optionnel: clear l'input après chargement réussi
      this._urlInput.set('');
    } catch (error) {
      console.error('Erreur lors du chargement de la vidéo:', error);
    }
  }

  /**
   * Initialise le player avec une vidéo
   */
  async initializePlayer(elementId: string, videoUrl: string): Promise<void> {
    const videoId = this.youtubeService.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('URL YouTube invalide');
    }

    try {
      await this.youtubeService.initializePlayer(elementId, videoId);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du player:', error);
      throw error;
    }
  }

  /**
   * Contrôles de lecture
   */
  play(): void {
    if (this.canPlay()) {
      this.youtubeService.play();
    }
  }

  pause(): void {
    if (this.canPause()) {
      this.youtubeService.pause();
    }
  }

  stop(): void {
    this.youtubeService.stop();
  }

  togglePlayPause(): void {
    const state = this.playerState();
    if (state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Navigation temporelle
   */
  seekTo(seconds: number): void {
    this.youtubeService.seekTo(seconds);
  }

  seekBy(seconds: number): void {
    const currentTime = this.playerState().currentTime;
    this.seekTo(currentTime + seconds);
  }

  seekToPercent(percent: number): void {
    const duration = this.playerState().duration;
    if (duration > 0) {
      const targetTime = (percent / 100) * duration;
      this.seekTo(targetTime);
    }
  }

  /**
   * Contrôle de vitesse
   */
  setPlaybackRate(rate: number): void {
    // Validation de la plage supportée par YouTube
    const validRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const closestRate = validRates.reduce((prev, curr) => 
      Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
    );
    
    this.youtubeService.setPlaybackRate(closestRate);
  }

  increaseSpeed(): void {
    const currentRate = this.playerState().playbackRate;
    const validRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = validRates.indexOf(currentRate);
    
    if (currentIndex < validRates.length - 1) {
      this.setPlaybackRate(validRates[currentIndex + 1]);
    }
  }

  decreaseSpeed(): void {
    const currentRate = this.playerState().playbackRate;
    const validRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIndex = validRates.indexOf(currentRate);
    
    if (currentIndex > 0) {
      this.setPlaybackRate(validRates[currentIndex - 1]);
    }
  }

  /**
   * Contrôle du volume
   */
  setVolume(volume: number): void {
    this.youtubeService.setVolume(volume);
  }

  mute(): void {
    this.setVolume(0);
  }

  /**
   * Nettoyage
   */
  reset(): void {
    this.youtubeService.destroy();
    this._urlInput.set('');
  }

  /**
   * Utilitaires
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getProgressPercentage(): number {
    const state = this.playerState();
    if (state.duration === 0) return 0;
    return (state.currentTime / state.duration) * 100;
  }
}