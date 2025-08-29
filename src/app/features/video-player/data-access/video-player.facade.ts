import { Injectable, computed, signal, inject } from '@angular/core';
import { ValidationService } from '@core/services/validation.service';

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerFacade {
  private readonly validationService = inject(ValidationService);

  // États privés avec Signals
  private readonly _currentVideo = signal<VideoInfo | null>(null);
  private readonly _isPlaying = signal(false);
  private readonly _currentTime = signal(0);
  private readonly _playbackRate = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Signals publics en lecture seule
  readonly currentVideo = this._currentVideo.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly playbackRate = this._playbackRate.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // ViewModel computed
  readonly vm = computed(() => ({
    video: this._currentVideo(),
    isPlaying: this._isPlaying(),
    currentTime: this._currentTime(),
    playbackRate: this._playbackRate(),
    loading: this._loading(),
    error: this._error(),
    canPlay: this._currentVideo() !== null && !this._loading()
  }));

  // Commandes publiques
  validateAndLoadVideo(url: string): void {
    this._loading.set(true);
    this._error.set(null);
    
    const videoId = this.validationService.validateYouTubeUrl(url);
    if (!videoId) {
      this._error.set('URL YouTube invalide');
      this._loading.set(false);
      return;
    }

    // TODO: Implémenter le chargement réel avec l'API YouTube
    // Pour l'instant, simulation
    setTimeout(() => {
      this._currentVideo.set({
        id: videoId,
        title: 'Vidéo de démonstration',
        duration: 180,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      });
      this._loading.set(false);
    }, 1000);
  }

  play(): void {
    if (this._currentVideo()) {
      this._isPlaying.set(true);
    }
  }

  pause(): void {
    this._isPlaying.set(false);
  }

  seekTo(time: number): void {
    if (this._currentVideo()) {
      this._currentTime.set(Math.max(0, Math.min(time, this._currentVideo()!.duration)));
    }
  }

  setPlaybackRate(rate: number): void {
    if (this.validationService.isValidPlaybackSpeed(rate)) {
      this._playbackRate.set(rate);
    }
  }

  reset(): void {
    this._currentVideo.set(null);
    this._isPlaying.set(false);
    this._currentTime.set(0);
    this._playbackRate.set(1);
    this._loading.set(false);
    this._error.set(null);
  }
}