import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface YouTubeWindow extends Window {
  YT?: any;
  onYouTubeIframeAPIReady?: () => void;
}

declare let window: YouTubeWindow;

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  author: string;
  thumbnail: string;
}

export interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class YouTubeService {
  private platformId = inject(PLATFORM_ID);
  private player: any = null;
  private apiLoaded = signal(false);
  
  // Signals pour l'état du player
  readonly playerState = signal<PlayerState>({
    isReady: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    volume: 100,
    error: null
  });

  readonly currentVideo = signal<VideoInfo | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadYouTubeAPI();
    }
  }

  /**
   * Charge l'API YouTube IFrame de manière asynchrone
   */
  private async loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Vérifier si l'API est déjà chargée
      if (window.YT && window.YT.Player) {
        this.apiLoaded.set(true);
        resolve();
        return;
      }

      // Vérifier si le script est déjà en cours de chargement
      if (document.getElementById('youtube-api-script')) {
        // Attendre que l'API soit prête
        const checkAPI = () => {
          if (window.YT && window.YT.Player) {
            this.apiLoaded.set(true);
            resolve();
          } else {
            setTimeout(checkAPI, 100);
          }
        };
        checkAPI();
        return;
      }

      // Callback global pour l'API YouTube
      window.onYouTubeIframeAPIReady = () => {
        this.apiLoaded.set(true);
        resolve();
      };

      // Charger le script de l'API
      const script = document.createElement('script');
      script.id = 'youtube-api-script';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.defer = true;
      
      script.onerror = () => {
        this.updatePlayerState({ error: 'Erreur lors du chargement de l\'API YouTube' });
        reject(new Error('Failed to load YouTube API'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialise le player YouTube dans un élément DOM
   */
  async initializePlayer(elementId: string, videoId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('YouTube player can only be initialized in browser environment');
    }

    // Attendre que l'API soit chargée
    await this.loadYouTubeAPI();

    return new Promise((resolve, reject) => {
      try {
        this.player = new window.YT.Player(elementId, {
          height: '360',
          width: '640',
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0
          },
          events: {
            onReady: (event: any) => {
              this.onPlayerReady(event);
              resolve();
            },
            onStateChange: (event: any) => {
              this.onPlayerStateChange(event);
            },
            onError: (event: any) => {
              this.onPlayerError(event);
              reject(new Error(`YouTube player error: ${event.data}`));
            }
          }
        });
      } catch (error) {
        this.updatePlayerState({ error: 'Erreur lors de l\'initialisation du player' });
        reject(error);
      }
    });
  }

  /**
   * Extrait l'ID vidéo d'une URL YouTube
   */
  extractVideoId(url: string): string | null {
    if (!url) return null;

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([^#&?]*)/,
      /^([a-zA-Z0-9_-]{11})$/ // ID direct
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Valide une URL YouTube
   */
  isValidYouTubeUrl(url: string): boolean {
    return this.extractVideoId(url) !== null;
  }

  /**
   * Récupère les informations d'une vidéo
   */
  async getVideoInfo(videoId: string): Promise<VideoInfo | null> {
    if (!this.player || !this.playerState().isReady) {
      return null;
    }

    try {
      const videoData = this.player.getVideoData();
      const duration = this.player.getDuration();
      
      return {
        id: videoId,
        title: videoData.title || 'Titre non disponible',
        duration: duration || 0,
        author: videoData.author || 'Auteur non disponible',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des informations vidéo:', error);
      return null;
    }
  }

  /**
   * Charge une nouvelle vidéo
   */
  async loadVideo(videoId: string): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    try {
      this.player.loadVideoById(videoId);
      
      // Attendre que la vidéo soit chargée
      await new Promise<void>((resolve) => {
        const checkLoaded = () => {
          if (this.player.getDuration() > 0) {
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });

      // Mettre à jour les informations de la vidéo
      const videoInfo = await this.getVideoInfo(videoId);
      this.currentVideo.set(videoInfo);
      
    } catch (error) {
      this.updatePlayerState({ error: 'Erreur lors du chargement de la vidéo' });
      throw error;
    }
  }

  /**
   * Contrôles de lecture
   */
  play(): void {
    if (this.player) {
      this.player.playVideo();
    }
  }

  pause(): void {
    if (this.player) {
      this.player.pauseVideo();
    }
  }

  stop(): void {
    if (this.player) {
      this.player.stopVideo();
    }
  }

  seekTo(seconds: number): void {
    if (this.player) {
      this.player.seekTo(seconds, true);
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.player) {
      this.player.setPlaybackRate(rate);
      this.updatePlayerState({ playbackRate: rate });
    }
  }

  setVolume(volume: number): void {
    if (this.player) {
      this.player.setVolume(Math.max(0, Math.min(100, volume)));
      this.updatePlayerState({ volume });
    }
  }

  /**
   * Getters pour l'état actuel
   */
  getCurrentTime(): number {
    return this.player ? this.player.getCurrentTime() : 0;
  }

  getDuration(): number {
    return this.player ? this.player.getDuration() : 0;
  }

  getPlaybackRate(): number {
    return this.player ? this.player.getPlaybackRate() : 1;
  }

  getVolume(): number {
    return this.player ? this.player.getVolume() : 100;
  }

  /**
   * Callbacks des événements YouTube
   */
  private onPlayerReady(_event: any): void {
    this.updatePlayerState({
      isReady: true,
      duration: this.player.getDuration(),
      volume: this.player.getVolume(),
      playbackRate: this.player.getPlaybackRate(),
      error: null
    });
  }

  private onPlayerStateChange(event: any): void {
    const YT = window.YT;
    let isPlaying = false;

    switch (event.data) {
      case YT.PlayerState.PLAYING:
        isPlaying = true;
        break;
      case YT.PlayerState.PAUSED:
      case YT.PlayerState.ENDED:
      case YT.PlayerState.BUFFERING:
      case YT.PlayerState.CUED:
        isPlaying = false;
        break;
    }

    this.updatePlayerState({
      isPlaying,
      currentTime: this.getCurrentTime(),
      error: null
    });
  }

  private onPlayerError(event: any): void {
    const errorMessages: { [key: number]: string } = {
      2: 'ID vidéo invalide',
      5: 'Erreur de lecture HTML5',
      100: 'Vidéo introuvable ou privée',
      101: 'Lecture non autorisée par le propriétaire',
      150: 'Lecture non autorisée par le propriétaire'
    };

    const errorMessage = errorMessages[event.data] || `Erreur inconnue (${event.data})`;
    
    this.updatePlayerState({
      error: errorMessage,
      isPlaying: false
    });
  }

  /**
   * Met à jour l'état du player
   */
  private updatePlayerState(updates: Partial<PlayerState>): void {
    this.playerState.update(current => ({ ...current, ...updates }));
  }

  /**
   * Nettoyage des ressources
   */
  destroy(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    
    this.playerState.set({
      isReady: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      volume: 100,
      error: null
    });
    
    this.currentVideo.set(null);
  }
}