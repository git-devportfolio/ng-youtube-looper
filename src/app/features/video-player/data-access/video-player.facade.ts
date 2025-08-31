import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { YouTubeService, VideoInfo as YouTubeVideoInfo, PlayerState } from '@core/services/youtube.service';
import { SecureStorageService } from '@core/services/storage.service';
import { VideoSession, SessionLoop } from '@core/services/storage.types';
import { LoopService, Loop } from '@core/services/loop.service';

export interface VideoPlayerState {
  currentVideo: YouTubeVideoInfo | null;
  playerState: PlayerState;
  urlInput: string;
  isValidUrl: boolean;
  canPlay: boolean;
  canPause: boolean;
  hasError: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  loops: Loop[];
  isPlayerReady: boolean;
}

export interface VideoPlayerViewModel {
  // Core video information
  currentVideo: YouTubeVideoInfo | null;
  isVideoLoaded: boolean;
  
  // Player state
  isPlayerReady: boolean;
  isPlaying: boolean;
  loading: boolean;
  error: string | null;
  
  // Time information
  currentTime: number;
  duration: number;
  currentTimeFormatted: string;
  durationFormatted: string;
  progress: number;
  
  // Playback controls
  playbackRate: number;
  volume: number;
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  
  // Loop information
  loops: Loop[];
  currentLoop: Loop | null;
  isLooping: boolean;
  
  // UI state
  urlInput: string;
  isValidUrl: boolean;
  hasError: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VideoPlayerFacade {
  private readonly youtubeService = inject(YouTubeService);
  private readonly storageService = inject(SecureStorageService);
  private readonly loopService = inject(LoopService);

  // Private signals pour l'état interne
  private readonly _currentVideo = signal<YouTubeVideoInfo | null>(null);
  private readonly _player = signal<any>(null);
  private readonly _isPlaying = signal(false);
  private readonly _currentTime = signal(0);
  private readonly _playbackRate = signal(1);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _urlInput = signal('');
  private readonly _loops = signal<Loop[]>([]);
  private readonly _currentLoop = signal<Loop | null>(null);
  
  // Signals publics en lecture seule
  readonly currentVideo = this._currentVideo.asReadonly();
  readonly player = this._player.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly playbackRate = this._playbackRate.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly urlInput = this._urlInput.asReadonly();
  readonly loops = this._loops.asReadonly();
  readonly currentLoop = this._currentLoop.asReadonly();
  
  // Signals dérivés du YouTubeService pour compatibilité
  readonly playerState = this.youtubeService.playerState;

  // ViewModels computed
  readonly isValidUrl = computed(() => {
    const url = this._urlInput();
    return url.length > 0 ? this.youtubeService.isValidYouTubeUrl(url) : false;
  });

  readonly isPlayerReady = computed(() => {
    const state = this.playerState();
    return state.isReady && !this._loading() && this._error() === null;
  });

  readonly canPlay = computed(() => {
    const state = this.playerState();
    return this.isPlayerReady() && !this._isPlaying() && !state.error;
  });

  readonly canPause = computed(() => {
    return this.isPlayerReady() && this._isPlaying();
  });

  readonly canSeek = computed(() => {
    const state = this.playerState();
    return this.isPlayerReady() && state.duration > 0;
  });

  readonly hasError = computed(() => {
    const state = this.playerState();
    return this._error() !== null || state.error !== null;
  });

  readonly currentTimeFormatted = computed(() => {
    return this.loopService.formatTime(this._currentTime());
  });

  readonly durationFormatted = computed(() => {
    const state = this.playerState();
    return this.loopService.formatTime(state.duration);
  });

  readonly progress = computed(() => {
    const state = this.playerState();
    if (state.duration === 0) return 0;
    return (this._currentTime() / state.duration) * 100;
  });

  readonly isLooping = computed(() => {
    return this._currentLoop() !== null;
  });

  readonly isVideoLoaded = computed(() => {
    return this._currentVideo() !== null && this.isPlayerReady();
  });

  // ViewModel principal pour l'interface
  readonly vm = computed<VideoPlayerViewModel>(() => {
    const state = this.playerState();
    return {
      // Core video information
      currentVideo: this._currentVideo(),
      isVideoLoaded: this.isVideoLoaded(),
      
      // Player state
      isPlayerReady: this.isPlayerReady(),
      isPlaying: this._isPlaying(),
      loading: this._loading(),
      error: this._error() || state.error,
      
      // Time information
      currentTime: this._currentTime(),
      duration: state.duration,
      currentTimeFormatted: this.currentTimeFormatted(),
      durationFormatted: this.durationFormatted(),
      progress: this.progress(),
      
      // Playback controls
      playbackRate: this._playbackRate(),
      volume: state.volume,
      canPlay: this.canPlay(),
      canPause: this.canPause(),
      canSeek: this.canSeek(),
      
      // Loop information
      loops: this._loops(),
      currentLoop: this._currentLoop(),
      isLooping: this.isLooping(),
      
      // UI state
      urlInput: this._urlInput(),
      isValidUrl: this.isValidUrl(),
      hasError: this.hasError()
    };
  });

  // ViewModel legacy pour compatibilité
  readonly vmLegacy = computed<VideoPlayerState>(() => ({
    currentVideo: this._currentVideo(),
    playerState: this.playerState(),
    urlInput: this._urlInput(),
    isValidUrl: this.isValidUrl(),
    canPlay: this.canPlay(),
    canPause: this.canPause(),
    hasError: this.hasError(),
    loading: this._loading(),
    currentTime: this._currentTime(),
    duration: this.playerState().duration,
    playbackRate: this._playbackRate(),
    volume: this.playerState().volume,
    loops: this._loops(),
    isPlayerReady: this.isPlayerReady()
  }));

  /**
   * === UTILITAIRES DE CONVERSION ===
   */
  
  /**
   * Convertit SessionLoop vers Loop
   */
  private convertSessionLoopToLoop(sessionLoop: SessionLoop): Loop {
    return {
      id: sessionLoop.id,
      name: sessionLoop.name || 'Boucle sans nom',
      startTime: sessionLoop.startTime,
      endTime: sessionLoop.endTime,
      color: sessionLoop.color || '#3B82F6',
      playCount: sessionLoop.playCount,
      isActive: sessionLoop.isActive,
      playbackSpeed: 1.0, // Default value for Loop interface
      repeatCount: 1 // Default value for Loop interface
    };
  }

  /**
   * Convertit Loop vers SessionLoop
   */
  private convertLoopToSessionLoop(loop: Loop): SessionLoop {
    return {
      id: loop.id,
      name: loop.name,
      startTime: loop.startTime,
      endTime: loop.endTime,
      color: loop.color || '#3B82F6',
      playCount: loop.playCount,
      isActive: loop.isActive
    };
  }

  // Effets pour synchroniser l'état du player
  constructor() {
    // Effet pour synchroniser l'état du YouTube player avec les signals privés
    effect(() => {
      const state = this.playerState();
      const video = this.youtubeService.currentVideo();
      
      // Synchroniser l'état de lecture
      this._isPlaying.set(state.isPlaying);
      this._currentTime.set(state.currentTime);
      this._playbackRate.set(state.playbackRate);
      
      // Synchroniser la vidéo courante
      this._currentVideo.set(video);
      
      // Gérer les erreurs
      if (state.error) {
        this._error.set(state.error);
        this._loading.set(false);
      } else {
        this._error.set(null);
      }
    });

    // Effet pour détecter la boucle courante
    effect(() => {
      const currentTime = this._currentTime();
      const loops = this._loops();
      const currentLoop = this.loopService.getCurrentLoop(currentTime, loops);
      this._currentLoop.set(currentLoop);
    });

    // Effet pour la gestion automatique des boucles
    effect(() => {
      const currentLoop = this._currentLoop();
      const isPlaying = this._isPlaying();
      const currentTime = this._currentTime();
      
      if (currentLoop && isPlaying && currentTime >= currentLoop.endTime) {
        // Redémarrer la boucle si on a atteint la fin
        this.seekTo(currentLoop.startTime);
      }
    });

    // Effet pour logger les changements d'état (dev only)
    effect(() => {
      const error = this._error();
      if (error) {
        console.warn('VideoPlayerFacade Error:', error);
      }
    });

    // Effet pour la persistance automatique (debounced)
    effect(() => {
      const video = this._currentVideo();
      // Track changes to trigger auto-save, but don't use the values directly
      this._loops();
      this._currentTime();
      this._playbackRate();
      
      if (video) {
        // Sauvegarder la session automatiquement avec debounce
        this.scheduleAutoSave();
      }
    });
  }

  // Commandes publiques
  
  /**
   * Met à jour l'URL d'entrée
   */
  setUrlInput(url: string): void {
    this._urlInput.set(url);
    this._error.set(null); // Clear errors when setting new URL
  }

  /**
   * Valide et charge une vidéo YouTube avec gestion d'état complète
   */
  async loadVideo(url?: string): Promise<void> {
    const urlToLoad = url || this._urlInput();
    
    if (!urlToLoad) {
      this._error.set('Aucune URL fournie pour charger la vidéo');
      return;
    }

    const videoId = this.youtubeService.extractVideoId(urlToLoad);
    if (!videoId) {
      this._error.set('URL YouTube invalide');
      return;
    }

    try {
      this._loading.set(true);
      this._error.set(null);
      
      await this.youtubeService.loadVideo(videoId);
      
      // Charger les boucles sauvegardées pour cette vidéo
      await this.loadLoopsForVideo(videoId);
      
      // Clear l'input après chargement réussi
      this._urlInput.set('');
      this._loading.set(false);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement de la vidéo';
      this._error.set(errorMessage);
      this._loading.set(false);
      console.error('Erreur lors du chargement de la vidéo:', error);
    }
  }

  /**
   * Initialise le player avec une vidéo et gestion d'état complète
   */
  async initializePlayer(elementId: string, videoUrl: string): Promise<void> {
    const videoId = this.youtubeService.extractVideoId(videoUrl);
    if (!videoId) {
      this._error.set('URL YouTube invalide');
      throw new Error('URL YouTube invalide');
    }

    try {
      this._loading.set(true);
      this._error.set(null);
      
      await this.youtubeService.initializePlayer(elementId, videoId);
      this._player.set(this.youtubeService);
      
      // Charger les boucles pour cette vidéo
      await this.loadLoopsForVideo(videoId);
      
      this._loading.set(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'initialisation du player';
      this._error.set(errorMessage);
      this._loading.set(false);
      console.error('Erreur lors de l\'initialisation du player:', error);
      throw error;
    }
  }

  /**
   * Contrôles de lecture améliorés avec gestion d'état
   */
  play(): void {
    if (this.canPlay()) {
      this.youtubeService.play();
      this._error.set(null);
    }
  }

  pause(): void {
    if (this.canPause()) {
      this.youtubeService.pause();
      this._error.set(null);
    }
  }

  stop(): void {
    this.youtubeService.stop();
    this._currentTime.set(0);
    this._isPlaying.set(false);
    this._currentLoop.set(null);
  }

  togglePlayPause(): void {
    if (this._isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Navigation temporelle améliorée
   */
  seekTo(seconds: number): void {
    const duration = this.playerState().duration;
    const clampedTime = Math.max(0, Math.min(seconds, duration));
    
    this.youtubeService.seekTo(clampedTime);
    this._currentTime.set(clampedTime);
    this._error.set(null);
  }

  seekBy(seconds: number): void {
    const currentTime = this._currentTime();
    this.seekTo(currentTime + seconds);
  }

  seekToPercent(percent: number): void {
    const duration = this.playerState().duration;
    if (duration > 0) {
      const targetTime = (Math.max(0, Math.min(100, percent)) / 100) * duration;
      this.seekTo(targetTime);
    }
  }

  /**
   * Contrôle de vitesse amélioré avec gestion d'état
   */
  setPlaybackRate(rate: number): void {
    // Validation de la plage supportée par YouTube
    const validRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const closestRate = validRates.reduce((prev, curr) => 
      Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
    );
    
    this.youtubeService.setPlaybackRate(closestRate);
    this._playbackRate.set(closestRate);
    this._error.set(null);
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
   * === GESTION DES BOUCLES ===
   */
  
  /**
   * Charge les boucles sauvegardées pour une vidéo
   */
  private async loadLoopsForVideo(videoId: string): Promise<void> {
    try {
      const sessions = this.storageService.getVideoSessions(videoId);
      if (sessions.length > 0) {
        // Prendre la session la plus récente
        const latestSession = sessions.sort((a, b) => 
          new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
        )[0];
        
        // Convertir SessionLoop vers Loop
        const loops = (latestSession.loops || []).map(sessionLoop => 
          this.convertSessionLoopToLoop(sessionLoop)
        );
        this._loops.set(loops);
      } else {
        this._loops.set([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des boucles:', error);
      this._loops.set([]);
    }
  }

  /**
   * Ajoute une nouvelle boucle
   */
  addLoop(name: string, startTime: number, endTime: number, options: Partial<Loop> = {}): boolean {
    try {
      const videoDuration = this.playerState().duration;
      const existingLoops = this._loops();
      
      const { loop, validation } = this.loopService.createValidatedLoop(
        name, 
        startTime, 
        endTime, 
        options, 
        videoDuration, 
        existingLoops
      );

      if (!validation.isValid) {
        this._error.set(`Impossible de créer la boucle: ${validation.errors.join(', ')}`);
        return false;
      }

      this._loops.update(loops => [...loops, loop]);
      this._error.set(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la création de la boucle';
      this._error.set(errorMessage);
      return false;
    }
  }

  /**
   * Supprime une boucle
   */
  removeLoop(loopId: string): boolean {
    try {
      const currentLoops = this._loops();
      const updatedLoops = currentLoops.filter(loop => loop.id !== loopId);
      
      if (updatedLoops.length === currentLoops.length) {
        this._error.set('Boucle non trouvée');
        return false;
      }

      this._loops.set(updatedLoops);
      
      // Si c'était la boucle courante, la désactiver
      const currentLoop = this._currentLoop();
      if (currentLoop && currentLoop.id === loopId) {
        this._currentLoop.set(null);
      }
      
      this._error.set(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression de la boucle';
      this._error.set(errorMessage);
      return false;
    }
  }

  /**
   * Active/désactive une boucle
   */
  toggleLoop(loopId: string): boolean {
    try {
      this._loops.update(loops => 
        loops.map(loop => 
          loop.id === loopId 
            ? { ...loop, isActive: !loop.isActive }
            : loop
        )
      );
      this._error.set(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la modification de la boucle';
      this._error.set(errorMessage);
      return false;
    }
  }

  /**
   * Démarre la lecture d'une boucle spécifique
   */
  startLoop(loopId: string): void {
    try {
      const loops = this._loops();
      const loop = loops.find(l => l.id === loopId);
      
      if (!loop) {
        this._error.set('Boucle non trouvée');
        return;
      }

      // Activer la boucle si elle ne l'est pas
      if (!loop.isActive) {
        this.toggleLoop(loopId);
      }

      // Se positionner au début de la boucle
      this.seekTo(loop.startTime);
      
      // Démarrer la lecture
      this.play();
      
      this._error.set(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du démarrage de la boucle';
      this._error.set(errorMessage);
    }
  }

  /**
   * === PERSISTANCE DES SESSIONS ===
   */
  
  private autoSaveTimeout: any = null;
  
  /**
   * Programme une sauvegarde automatique avec debounce
   */
  private scheduleAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(() => {
      this.autoSaveSession();
    }, 2000); // Debounce de 2 secondes
  }
  
  /**
   * Sauvegarde automatique de la session courante
   */
  private autoSaveSession(): void {
    try {
      const video = this._currentVideo();
      if (!video) return;

      // Convertir les boucles Loop vers SessionLoop
      const sessionLoops = this._loops().map(loop => this.convertLoopToSessionLoop(loop));

      const session: VideoSession = {
        id: `session-${video.videoId}-${Date.now()}`,
        videoId: video.videoId,
        videoTitle: video.title,
        videoUrl: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
        loops: sessionLoops,
        playbackSpeed: this._playbackRate(),
        currentTime: this._currentTime(),
        lastPlayed: new Date(),
        totalPlayTime: 0, // Could be tracked separately
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.storageService.saveSession(session);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde automatique:', error);
    }
  }

  /**
   * Sauvegarde manuelle de la session
   */
  saveCurrentSession(): boolean {
    try {
      const video = this._currentVideo();
      if (!video) {
        this._error.set('Aucune vidéo chargée pour sauvegarder');
        return false;
      }

      this.autoSaveSession();
      this._error.set(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la sauvegarde';
      this._error.set(errorMessage);
      return false;
    }
  }

  /**
   * Charge une session sauvegardée
   */
  async loadSession(sessionId: string): Promise<boolean> {
    try {
      this._loading.set(true);
      this._error.set(null);

      const session = this.storageService.getSession(sessionId);
      if (!session) {
        this._error.set('Session non trouvée');
        this._loading.set(false);
        return false;
      }

      // Charger la vidéo
      await this.loadVideo(session.videoUrl);
      
      // Restaurer l'état de la session avec conversion des types
      const loops = (session.loops || []).map(sessionLoop => 
        this.convertSessionLoopToLoop(sessionLoop)
      );
      this._loops.set(loops);
      this.setPlaybackRate(session.playbackSpeed);
      this.seekTo(session.currentTime);
      
      this._loading.set(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement de la session';
      this._error.set(errorMessage);
      this._loading.set(false);
      return false;
    }
  }

  /**
   * Nettoyage complet
   */
  reset(): void {
    // Nettoyer les services externes
    this.youtubeService.destroy();
    
    // Réinitialiser les signals privés
    this._currentVideo.set(null);
    this._player.set(null);
    this._isPlaying.set(false);
    this._currentTime.set(0);
    this._playbackRate.set(1);
    this._loading.set(false);
    this._error.set(null);
    this._urlInput.set('');
    this._loops.set([]);
    this._currentLoop.set(null);
  }

  /**
   * === UTILITAIRES ET MÉTHODES D'AIDE ===
   */
  
  formatTime(seconds: number): string {
    return this.loopService.formatTime(seconds);
  }

  getProgressPercentage(): number {
    return this.progress();
  }

  /**
   * Obtient des statistiques sur les boucles courantes
   */
  getLoopsStatistics(): {
    totalCount: number;
    activeCount: number;
    totalDuration: number;
    averageDuration: number;
  } {
    const loops = this._loops();
    return this.loopService.getLoopStatistics(loops);
  }

  /**
   * Valide toutes les boucles courantes
   */
  validateCurrentLoops(): {
    isValid: boolean;
    criticalIssues: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const loops = this._loops();
    const duration = this.playerState().duration;
    return this.loopService.validateLoopCollection(loops, duration);
  }

  /**
   * Résout automatiquement les conflits de boucles
   */
  resolveLoopConflicts(): boolean {
    try {
      const loops = this._loops();
      const duration = this.playerState().duration;
      
      const { resolvedLoops, modifications } = this.loopService.resolveLoopConflicts(
        loops,
        duration,
        {
          adjustOverlaps: true,
          trimToVideoDuration: true,
          renameDuplicates: true,
          removeInvalid: true
        }
      );

      this._loops.set(resolvedLoops);
      
      if (modifications.length > 0) {
        console.log('Résolution des conflits de boucles:', modifications);
      }
      
      this._error.set(null);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la résolution des conflits';
      this._error.set(errorMessage);
      return false;
    }
  }

  /**
   * Obtient les sessions disponibles pour la vidéo courante
   */
  getAvailableSessions(): Array<{
    id: string;
    title: string;
    lastPlayed: Date;
    loopCount: number;
  }> {
    try {
      const video = this._currentVideo();
      if (!video) return [];

      const sessions = this.storageService.getVideoSessions(video.videoId);
      return sessions.map(session => ({
        id: session.id,
        title: session.videoTitle || 'Session sans titre',
        lastPlayed: new Date(session.lastPlayed),
        loopCount: session.loops?.length || 0
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des sessions:', error);
      return [];
    }
  }

  /**
   * Obtient l'historique des vidéos récentes
   */
  getRecentVideos(limit: number = 10): Array<{
    videoId: string;
    title: string;
    thumbnailUrl?: string;
    lastWatched: Date;
    url: string;
  }> {
    try {
      const history = this.storageService.getRecentHistory(limit);
      return history.map(entry => ({
        videoId: entry.videoId,
        title: entry.videoTitle || 'Titre non disponible',
        ...(entry.thumbnailUrl && { thumbnailUrl: entry.thumbnailUrl }),
        lastWatched: new Date(entry.lastWatched),
        url: entry.videoUrl
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  /**
   * Obtient l'état de santé global du player
   */
  getPlayerHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Vérifier l'état du player
    if (this._error()) {
      issues.push(`Erreur active: ${this._error()}`);
    }
    
    if (this._loading()) {
      issues.push('Player en cours de chargement');
    }
    
    if (!this.isPlayerReady()) {
      issues.push('Player non prêt');
      recommendations.push('Attendre l\'initialisation du player');
    }
    
    // Vérifier les boucles
    const loopValidation = this.validateCurrentLoops();
    if (!loopValidation.isValid) {
      issues.push(...loopValidation.criticalIssues);
      recommendations.push(...loopValidation.suggestions);
    }
    
    // Vérifier le stockage
    const storageInfo = this.storageService.getStorageInfo();
    if (!storageInfo.available) {
      issues.push('Stockage local non disponible');
      recommendations.push('Activer le stockage local dans le navigateur');
    } else if (storageInfo.utilizationPercentage > 90) {
      issues.push('Stockage local presque plein');
      recommendations.push('Nettoyer les anciennes sessions');
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Exporte la configuration courante pour le partage
   */
  exportCurrentConfiguration(): {
    videoInfo: YouTubeVideoInfo | null;
    loops: Loop[];
    playbackRate: number;
    currentTime: number;
    timestamp: Date;
  } {
    return {
      videoInfo: this._currentVideo(),
      loops: this._loops(),
      playbackRate: this._playbackRate(),
      currentTime: this._currentTime(),
      timestamp: new Date()
    };
  }

  /**
   * Importe une configuration
   */
  async importConfiguration(config: {
    videoInfo: YouTubeVideoInfo;
    loops: Loop[];
    playbackRate?: number;
    currentTime?: number;
  }): Promise<boolean> {
    try {
      this._loading.set(true);
      this._error.set(null);

      // Charger la vidéo
      const videoUrl = config.videoInfo.url || `https://www.youtube.com/watch?v=${config.videoInfo.videoId}`;
      await this.loadVideo(videoUrl);
      
      // Appliquer la configuration
      this._loops.set(config.loops || []);
      
      if (config.playbackRate) {
        this.setPlaybackRate(config.playbackRate);
      }
      
      if (config.currentTime) {
        this.seekTo(config.currentTime);
      }
      
      this._loading.set(false);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'importation';
      this._error.set(errorMessage);
      this._loading.set(false);
      return false;
    }
  }
}