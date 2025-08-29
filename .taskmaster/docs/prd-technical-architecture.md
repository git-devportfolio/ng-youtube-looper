# PRD Technique - Architecture et Implémentation

## Vue d'ensemble Architecture

Cette spécification technique détaille l'implémentation de l'architecture Angular moderne pour ng-youtube-looper, en suivant les conventions définies dans le projet.

## Architecture des Services

### Core Services

#### YouTubeService (Data Access)
```typescript
interface YouTubeService {
  // API YouTube IFrame Player
  loadPlayer(elementId: string, videoId: string): Promise<YT.Player>;
  getVideoInfo(videoId: string): Promise<VideoInfo>;
  extractVideoId(url: string): string | null;
  
  // Contrôles player
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}
```

#### StorageService (Data Access)
```typescript
interface StorageService {
  // Sessions
  saveSessions(sessions: LooperSession[]): void;
  loadSessions(): LooperSession[];
  saveCurrentSession(session: LooperSession): void;
  loadCurrentSession(): LooperSession | null;
  
  // Settings
  saveSettings(settings: AppSettings): void;
  loadSettings(): AppSettings;
  
  // Historique
  addToHistory(videoInfo: VideoInfo): void;
  getHistory(): VideoInfo[];
  clearHistory(): void;
}
```

#### LoopService (Business Logic)
```typescript
interface LoopService {
  // Gestion des boucles
  createLoop(startTime: number, endTime: number): LoopSegment;
  validateLoop(loop: LoopSegment): boolean;
  calculateLoopDuration(loop: LoopSegment): number;
  
  // Utilitaires temps
  formatTime(seconds: number): string;
  parseTime(timeString: string): number;
  isValidTimeRange(start: number, end: number, duration: number): boolean;
}
```

## Pattern Façade Implementation

### VideoPlayerFacade
```typescript
@Injectable({ providedIn: 'root' })
export class VideoPlayerFacade {
  // État privé avec Signals
  private readonly _currentVideo = signal<VideoInfo | null>(null);
  private readonly _player = signal<YT.Player | null>(null);
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
    player: this._player(),
    isPlaying: this._isPlaying(),
    currentTime: this._currentTime(),
    playbackRate: this._playbackRate(),
    loading: this._loading(),
    error: this._error(),
    canPlay: this._player() !== null && this._currentVideo() !== null
  }));

  // Commandes publiques
  async loadVideo(url: string): Promise<void> { /* implementation */ }
  play(): void { /* implementation */ }
  pause(): void { /* implementation */ }
  seekTo(time: number): void { /* implementation */ }
  setPlaybackRate(rate: number): void { /* implementation */ }
}
```

### LoopManagerFacade
```typescript
@Injectable({ providedIn: 'root' })
export class LoopManagerFacade {
  // État privé
  private readonly _loops = signal<LoopSegment[]>([]);
  private readonly _activeLoop = signal<LoopSegment | null>(null);
  private readonly _isLooping = signal(false);
  private readonly _repeatCount = signal(0);
  private readonly _editingLoop = signal<LoopSegment | null>(null);

  // Signals publics
  readonly loops = this._loops.asReadonly();
  readonly activeLoop = this._activeLoop.asReadonly();
  readonly isLooping = this._isLooping.asReadonly();
  readonly repeatCount = this._repeatCount.asReadonly();

  // ViewModels computed
  readonly vm = computed(() => ({
    loops: this._loops(),
    activeLoop: this._activeLoop(),
    isLooping: this._isLooping(),
    repeatCount: this._repeatCount(),
    hasLoops: this._loops().length > 0,
    canStartLoop: this._activeLoop() !== null && !this._isLooping()
  }));

  readonly timelineVm = computed(() => ({
    loops: this._loops(),
    editingLoop: this._editingLoop(),
    videoDuration: this.playerFacade.vm().video?.duration || 0
  }));

  // Commandes
  createLoop(start: number, end: number, name?: string): void { /* implementation */ }
  deleteLoop(loopId: string): void { /* implementation */ }
  startLoop(loopId: string): void { /* implementation */ }
  stopLoop(): void { /* implementation */ }
  nextLoop(): void { /* implementation */ }
  previousLoop(): void { /* implementation */ }
}
```

### SessionManagerFacade
```typescript
@Injectable({ providedIn: 'root' })
export class SessionManagerFacade {
  // État privé
  private readonly _sessions = signal<LooperSession[]>([]);
  private readonly _currentSession = signal<LooperSession | null>(null);
  private readonly _autoSave = signal(true);
  private readonly _lastSaved = signal<Date | null>(null);

  // Signals publics
  readonly sessions = this._sessions.asReadonly();
  readonly currentSession = this._currentSession.asReadonly();
  readonly lastSaved = this._lastSaved.asReadonly();

  // ViewModel
  readonly vm = computed(() => ({
    sessions: this._sessions(),
    currentSession: this._currentSession(),
    hasCurrentSession: this._currentSession() !== null,
    autoSave: this._autoSave(),
    lastSaved: this._lastSaved(),
    hasUnsavedChanges: this.hasUnsavedChanges()
  }));

  // Commandes
  createSession(videoUrl: string, name?: string): void { /* implementation */ }
  saveSession(): void { /* implementation */ }
  loadSession(sessionId: string): void { /* implementation */ }
  deleteSession(sessionId: string): void { /* implementation */ }
  exportSession(sessionId: string): string { /* implementation */ }
  importSession(jsonData: string): void { /* implementation */ }
}
```

## Composants UI Purs

### Principe de Composants UI
Les composants UI sont **sans état** et reçoivent toutes leurs données via `@Input()` et communiquent via `@Output()`.

**IMPORTANT** : Tous les composants Angular doivent utiliser des **fichiers HTML séparés** pour leurs templates, jamais de templates inline.

### PlayerControlsComponent
```typescript
@Component({
  selector: 'app-player-controls',
  templateUrl: './player-controls.component.html',
  styleUrls: ['./player-controls.component.scss']
})
export class PlayerControlsComponent {
  @Input() vm!: PlayerViewModel;
  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() seek = new EventEmitter<number>();

  onPlay() {
    if (this.vm.isPlaying) {
      this.pause.emit();
    } else {
      this.play.emit();
    }
  }

  onSeek(event: Event) {
    const target = event.target as HTMLInputElement;
    this.seek.emit(parseFloat(target.value));
  }

  formatTime(seconds: number): string {
    // Utilisation du service utilitaire
    return this.loopService.formatTime(seconds);
  }

  constructor(private loopService: LoopService) {}
}
```

### SpeedControlComponent
```typescript
@Component({
  selector: 'app-speed-control',
  templateUrl: './speed-control.component.html',
  styleUrls: ['./speed-control.component.scss']
})
export class SpeedControlComponent {
  @Input() currentSpeed = 1;
  @Output() speedChange = new EventEmitter<number>();

  readonly speedPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];

  onSpeedChange(speed: number) {
    this.speedChange.emit(speed);
  }

  onCustomSpeed(event: Event) {
    const target = event.target as HTMLInputElement;
    const speed = parseFloat(target.value);
    if (speed >= 0.25 && speed <= 2) {
      this.speedChange.emit(speed);
    }
  }
}
```

### TimelineComponent
```typescript
@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  @Input() vm!: TimelineViewModel;
  @Input() currentTime = 0;
  @Input() duration = 0;
  @Input() activeLoopId?: string;
  @Input() isCreating = false;
  
  @Output() timeSeek = new EventEmitter<number>();
  @Output() loopSelect = new EventEmitter<string>();
  @Output() loopCreate = new EventEmitter<{start: number, end: number}>();

  get currentTimePercentage() {
    return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
  }

  onTimelineClick(event: MouseEvent) {
    // Logique de calcul position et émission d'événements
  }

  getLoopStartPercentage(loop: LoopSegment): number {
    return this.duration > 0 ? (loop.startTime / this.duration) * 100 : 0;
  }

  getLoopWidthPercentage(loop: LoopSegment): number {
    const duration = loop.endTime - loop.startTime;
    return this.duration > 0 ? (duration / this.duration) * 100 : 0;
  }
}
```

## Gestion des Types TypeScript

### Types Core
```typescript
// types/youtube.types.ts
export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  channelTitle: string;
}

export interface PlayerState {
  state: YT.PlayerState;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
}

// types/loop.types.ts
export interface LoopSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  playbackSpeed: number;
  repeatCount?: number;
  isActive: boolean;
  color?: string;
  description?: string;
}

// types/session.types.ts
export interface LooperSession {
  id: string;
  name: string;
  videoId: string;
  videoTitle: string;
  loops: LoopSegment[];
  settings: SessionSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSettings {
  defaultSpeed: number;
  autoRepeat: boolean;
  showTimeline: boolean;
  compactMode: boolean;
  autoSave: boolean;
  theme: 'light' | 'dark';
}

// types/view-models.types.ts
export interface PlayerViewModel {
  video: VideoInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  loading: boolean;
  error: string | null;
  canPlay: boolean;
}

export interface LoopManagerViewModel {
  loops: LoopSegment[];
  activeLoop: LoopSegment | null;
  isLooping: boolean;
  repeatCount: number;
  hasLoops: boolean;
  canStartLoop: boolean;
}

export interface TimelineViewModel {
  loops: LoopSegment[];
  editingLoop: LoopSegment | null;
  videoDuration: number;
}
```

## Responsive Design Architecture

### Breakpoints SCSS
```scss
// styles/breakpoints.scss
$breakpoints: (
  mobile: 320px,
  tablet: 768px,
  desktop: 1024px,
  large: 1440px
);

@mixin mobile {
  @media (max-width: #{map-get($breakpoints, tablet) - 1px}) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: #{map-get($breakpoints, tablet)}) and (max-width: #{map-get($breakpoints, desktop) - 1px}) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: #{map-get($breakpoints, desktop)}) {
    @content;
  }
}
```

### Layout Components
```scss
// Grille responsive adaptative
.app-layout {
  display: grid;
  min-height: 100vh;
  
  @include mobile {
    grid-template-rows: auto 1fr auto;
    grid-template-areas: 
      "header"
      "main"
      "footer";
  }
  
  @include desktop {
    grid-template-columns: 300px 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas: 
      "sidebar header"
      "sidebar main"
      "sidebar footer";
  }
}

.video-player-section {
  @include mobile {
    aspect-ratio: 16/9;
    width: 100%;
  }
  
  @include desktop {
    max-width: 800px;
    margin: 0 auto;
  }
}
```

## Intégration YouTube IFrame API

### YouTubePlayerService Implementation
```typescript
@Injectable({ providedIn: 'root' })
export class YouTubePlayerService {
  private player: YT.Player | null = null;
  private playerReady = signal(false);
  
  async initializePlayer(elementId: string, videoId: string): Promise<YT.Player> {
    // Chargement dynamique de l'API YouTube si nécessaire
    await this.loadYouTubeAPI();
    
    return new Promise((resolve, reject) => {
      this.player = new YT.Player(elementId, {
        height: '390',
        width: '640',
        videoId: videoId,
        events: {
          'onReady': (event) => {
            this.playerReady.set(true);
            resolve(event.target);
          },
          'onStateChange': (event) => this.onPlayerStateChange(event),
          'onError': (event) => reject(event.data)
        }
      });
    });
  }

  private async loadYouTubeAPI(): Promise<void> {
    if (typeof YT !== 'undefined' && YT.Player) {
      return;
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      
      (window as any).onYouTubeIframeAPIReady = () => {
        resolve();
      };
      
      document.head.appendChild(script);
    });
  }

  private onPlayerStateChange(event: YT.OnStateChangeEvent): void {
    // Émettre les changements d'état via signals ou events
  }
}
```

## Tests et Qualité Code

### Tests Unitaires Architecture
```typescript
// Exemple test de façade
describe('VideoPlayerFacade', () => {
  let facade: VideoPlayerFacade;
  let youtubeService: jasmine.SpyObj<YouTubeService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('YouTubeService', ['loadPlayer', 'play', 'pause']);
    
    TestBed.configureTestingModule({
      providers: [
        VideoPlayerFacade,
        { provide: YouTubeService, useValue: spy }
      ]
    });
    
    facade = TestBed.inject(VideoPlayerFacade);
    youtubeService = TestBed.inject(YouTubeService) as jasmine.SpyObj<YouTubeService>;
  });

  it('should load video and update state', async () => {
    const mockVideoInfo = { id: 'test123', title: 'Test Video', duration: 180 };
    youtubeService.loadPlayer.and.returnValue(Promise.resolve(mockPlayer));
    
    await facade.loadVideo('https://youtube.com/watch?v=test123');
    
    expect(facade.vm().video).toEqual(mockVideoInfo);
    expect(facade.vm().loading).toBeFalse();
  });
});
```

### Performance Considerations
- **Lazy Loading**: Composants chargés à la demande
- **OnPush Strategy**: Optionnelle selon préférence utilisateur
- **Bundle Splitting**: Séparation vendor/app bundles
- **Service Workers**: Cache des ressources statiques (futur)

## Sécurité et Validation

### Validation d'URL YouTube
```typescript
export class YouTubeValidator {
  private static readonly YOUTUBE_URL_REGEX = 
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  static validateYouTubeUrl(url: string): string | null {
    const match = url.match(this.YOUTUBE_URL_REGEX);
    return match ? match[1] : null;
  }

  static sanitizeVideoId(videoId: string): string {
    return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
```

### Sécurisation localStorage
```typescript
export class SecureStorageService {
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  
  saveData<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify(data);
      
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        console.warn('Data too large for localStorage');
        return false;
      }
      
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  loadData<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
}
```