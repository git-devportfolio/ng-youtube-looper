/**
 * Types pour l'API YouTube IFrame
 */

export interface YouTubePlayerConfig {
  height?: string | number;
  width?: string | number;
  videoId: string;
  playerVars?: YouTubePlayerVars;
  events?: YouTubePlayerEvents;
}

export interface YouTubePlayerVars {
  autoplay?: 0 | 1;
  cc_lang_pref?: string;
  cc_load_policy?: 0 | 1;
  color?: 'red' | 'white';
  controls?: 0 | 1 | 2;
  disablekb?: 0 | 1;
  enablejsapi?: 0 | 1;
  end?: number;
  fs?: 0 | 1;
  hl?: string;
  iv_load_policy?: 1 | 3;
  list?: string;
  listType?: 'playlist' | 'search' | 'user_uploads';
  loop?: 0 | 1;
  modestbranding?: 0 | 1;
  origin?: string;
  playlist?: string;
  playsinline?: 0 | 1;
  rel?: 0 | 1;
  start?: number;
  widget_referrer?: string;
}

export interface YouTubePlayerEvents {
  onReady?: (event: YouTubePlayerReadyEvent) => void;
  onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
  onPlaybackQualityChange?: (event: YouTubePlayerQualityChangeEvent) => void;
  onPlaybackRateChange?: (event: YouTubePlayerRateChangeEvent) => void;
  onError?: (event: YouTubePlayerErrorEvent) => void;
  onApiChange?: (event: YouTubePlayerApiChangeEvent) => void;
}

export interface YouTubePlayerReadyEvent {
  target: YouTubePlayer;
}

export interface YouTubePlayerStateChangeEvent {
  target: YouTubePlayer;
  data: PlayerState;
}

export interface YouTubePlayerQualityChangeEvent {
  target: YouTubePlayer;
  data: PlaybackQuality;
}

export interface YouTubePlayerRateChangeEvent {
  target: YouTubePlayer;
  data: number;
}

export interface YouTubePlayerErrorEvent {
  target: YouTubePlayer;
  data: PlayerError;
}

export interface YouTubePlayerApiChangeEvent {
  target: YouTubePlayer;
}

export enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5
}

export enum PlayerError {
  INVALID_PARAM = 2,
  HTML5_ERROR = 5,
  VIDEO_NOT_FOUND = 100,
  EMBED_NOT_ALLOWED = 101,
  EMBED_NOT_ALLOWED_DISGUISE = 150
}

export enum PlaybackQuality {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  HD720 = 'hd720',
  HD1080 = 'hd1080',
  HIGHRES = 'highres',
  DEFAULT = 'default'
}

export interface YouTubePlayer {
  // Lecture
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  clearVideo(): void;

  // Chargement de vidéos
  loadVideoById(videoId: string, startSeconds?: number, suggestedQuality?: PlaybackQuality): void;
  loadVideoById(config: {
    videoId: string;
    startSeconds?: number;
    endSeconds?: number;
    suggestedQuality?: PlaybackQuality;
  }): void;
  loadVideoByUrl(mediaContentUrl: string, startSeconds?: number, suggestedQuality?: PlaybackQuality): void;
  cueVideoById(videoId: string, startSeconds?: number, suggestedQuality?: PlaybackQuality): void;
  cueVideoByUrl(mediaContentUrl: string, startSeconds?: number, suggestedQuality?: PlaybackQuality): void;

  // Contrôles de playlist
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(index: number): void;

  // Volume et taux de lecture
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  setPlaybackRate(suggestedRate: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];

  // Informations sur la vidéo
  getDuration(): number;
  getCurrentTime(): number;
  getVideoLoadedFraction(): number;
  getPlayerState(): PlayerState;
  getVideoStartBytes(): number;
  getVideoBytesLoaded(): number;
  getVideoBytesTotal(): number;

  // Qualité de lecture
  setPlaybackQuality(suggestedQuality: PlaybackQuality): void;
  getPlaybackQuality(): PlaybackQuality;
  getAvailableQualityLevels(): PlaybackQuality[];

  // Informations sur la vidéo
  getVideoData(): {
    video_id: string;
    title: string;
    author: string;
  };

  // Playlist
  getPlaylist(): string[];
  getPlaylistIndex(): number;

  // Gestion de l'iframe
  getIframe(): HTMLIFrameElement;
  destroy(): void;

  // Options d'affichage
  setSize(width: number, height: number): void;

  // Événements
  addEventListener(event: string, listener: (event: any) => void): void;
  removeEventListener(event: string, listener: (event: any) => void): void;
}

export interface YouTubeNamespace {
  Player: new (elementId: string | HTMLElement, config: YouTubePlayerConfig) => YouTubePlayer;
  PlayerState: typeof PlayerState;
  ready: (callback: () => void) => void;
  get: (elementId: string) => YouTubePlayer | null;
  scan: () => void;
}

declare global {
  interface Window {
    YT: YouTubeNamespace;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}