# 🔧 Documentation Technique - ng-youtube-looper

## Architecture et Design Patterns

### Standalone Components Architecture
L'application utilise l'architecture moderne Angular avec des composants autonomes (standalone components) :

```typescript
@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, /* ... */],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent { }
```

### Facade Pattern avec Angular Signals
Les facades orchestrent la logique métier en utilisant les Signals Angular 19 :

```typescript
@Injectable({ providedIn: 'root' })
export class VideoPlayerFacade {
  private readonly _currentVideo = signal<VideoInfo | null>(null);
  private readonly _isPlaying = signal(false);
  
  readonly vm = computed(() => ({
    currentVideo: this._currentVideo(),
    isPlaying: this._isPlaying(),
    // ... autres propriétés computed
  }));
}
```

### Service Layer Architecture
- **Core Services** : Services métier globaux (YouTubeService, ValidationService)
- **Feature Services** : Services spécifiques aux modules (LoopService, SessionService)  
- **Utility Services** : Helpers et utilitaires (StorageService, ThemeService)

## Gestion d'État et Flux de Données

### Signals vs RxJS
- **Signals** : État local des composants et computed values
- **RxJS** : Flux de données asynchrones et side effects
- **Hybrid approach** : Conversion signals ↔ observables quand nécessaire

```typescript
// Signal -> Observable
readonly currentVideo$ = toObservable(this._currentVideo);

// Observable -> Signal
readonly playerState = toSignal(this.youtubeService.playerState$, { initialValue: null });
```

### State Management Pattern
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Component     │───▶│     Facade       │───▶│    Service      │
│   (View Model)  │    │   (Orchestrator) │    │   (Data Layer)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       │                       │
         │                       ▼                       ▼
         │              ┌──────────────────┐    ┌─────────────────┐
         └──────────────│   Computed       │    │   External APIs │
                        │   (Derived State)│    │   (YouTube, etc)│
                        └──────────────────┘    └─────────────────┘
```

## Intégrations APIs

### YouTube IFrame API
Wrapper TypeScript pour l'API YouTube :

```typescript
interface YouTubePlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setPlaybackRate(rate: number): void;
  // ... autres méthodes
}

@Injectable({ providedIn: 'root' })
export class YouTubeService {
  private player: YouTubePlayer | null = null;
  private readonly playerState = signal<PlayerState>(this.initialState);
  
  async initializePlayer(elementId: string, videoId: string): Promise<void> {
    // Initialisation avec gestion d'erreurs
  }
}
```

### Error Handling Strategy
Gestion d'erreurs centralisée avec codes spécifiques :

```typescript
export enum YouTubeErrorCode {
  PRIVATE_VIDEO = 100,
  GEO_BLOCKED = 101,
  CONTENT_WARNING = 150,
  NOT_FOUND = 404,
  NETWORK_ERROR = 500,
}

export interface YouTubeError {
  code: YouTubeErrorCode;
  message: string;
  suggestion: string;
  recoverable: boolean;
}
```

## Optimisations de Performance

### Lazy Loading Strategy
1. **Route Level** : Modules features chargés à la demande
2. **Component Level** : Composants non-critiques avec @defer
3. **Data Level** : Pagination et chargement incrémental

```typescript
// Route lazy loading
{
  path: 'video-player',
  loadChildren: () => import('./features/video-player/video-player.routes')
    .then(m => m.VIDEO_PLAYER_ROUTES)
}

// Component lazy loading  
@defer (on timer(100ms)) {
  <app-theme-demo></app-theme-demo>
} @loading {
  <div class="loading-placeholder">Chargement...</div>
}
```

### Bundle Optimization
Configuration optimisée pour différents environnements :

```json
// angular.json
"configurations": {
  "production": {
    "budgets": [
      { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
    ],
    "optimization": { "scripts": true, "styles": true, "fonts": true }
  },
  "mobile": {
    "budgets": [
      { "type": "initial", "maximumWarning": "300kB", "maximumError": "500kB" }
    ]
  }
}
```

### Memory Management
- **Subscription Management** : Unsubscribe automatique avec takeUntilDestroyed()
- **Signal Cleanup** : Destruction automatique des computed signals
- **Cache Strategies** : LRU cache pour les sessions et métadonnées vidéo

## Architecture de Test

### Test Strategy
```
├── Unit Tests (Jasmine + Karma)
│   ├── Components : Logique métier et rendus
│   ├── Services : Méthodes et intégrations
│   └── Utilities : Fonctions pures
├── Integration Tests
│   ├── Feature flows : Scénarios utilisateur complets
│   └── API interactions : Mocks et stubs
└── E2E Tests (Playwright - futur)
    ├── Critical user journeys
    └── Cross-browser validation
```

### Mock Strategies
```typescript
// Service mock example
class MockYouTubeService {
  playerState = signal<PlayerState>(mockPlayerState);
  
  loadVideo = jasmine.createSpy('loadVideo')
    .and.returnValue(Promise.resolve());
}

// Component testing
describe('VideoPlayerComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VideoPlayerComponent],
      providers: [
        { provide: YouTubeService, useClass: MockYouTubeService }
      ]
    });
  });
});
```

## Sécurité et Conformité

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' https://www.youtube.com;
               frame-src https://www.youtube.com;
               img-src 'self' https://img.youtube.com;">
```

### Data Privacy
- **Aucune donnée personnelle** collectée
- **localStorage uniquement** pour les préférences utilisateur
- **Pas de cookies tiers** (sauf YouTube embed)
- **RGPD compliant** par design

### XSS Protection
- **DomSanitizer** pour les URLs dynamiques
- **Validation stricte** des entrées utilisateur
- **CSP headers** contre l'injection de scripts

## Internationalization (i18n)

### Structure i18n (préparée pour le futur)
```
src/
├── assets/
│   └── i18n/
│       ├── fr.json    # Français (défaut)
│       ├── en.json    # Anglais
│       └── es.json    # Espagnol
└── app/
    └── core/
        └── i18n/
            ├── translate.service.ts
            └── locale.config.ts
```

### Key Features for i18n
- **Messages d'erreur** localisés
- **Labels UI** dynamiques  
- **Formats date/heure** régionaux
- **Nombres et devises** selon locale

## Monitoring et Analytics

### Performance Monitoring
```typescript
// Core Web Vitals tracking
interface PerformanceMetrics {
  fcp: number;  // First Contentful Paint
  lcp: number;  // Largest Contentful Paint
  fid: number;  // First Input Delay
  cls: number;  // Cumulative Layout Shift
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  trackMetrics(): void {
    // Implementation avec Performance Observer API
  }
}
```

### Error Tracking
```typescript
@Injectable({ providedIn: 'root' })
export class ErrorService {
  logError(error: Error, context?: string): void {
    // Log local + envoi vers service externe (futur)
    console.error('[ErrorService]', { error, context, timestamp: new Date() });
  }
}
```

## Déploiement et CI/CD

### Build Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build:prod
      - run: npm run deploy
```

### Environment Management
```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  youtubeApiKey: process.env['YOUTUBE_API_KEY'],
  storagePrefix: 'ng-youtube-looper-prod',
  enableAnalytics: true,
  logLevel: 'error'
};
```

## Migration et Versioning

### Version Strategy
- **Semantic Versioning** : MAJOR.MINOR.PATCH
- **Breaking changes** : Increment MAJOR
- **New features** : Increment MINOR  
- **Bug fixes** : Increment PATCH

### Data Migration
```typescript
interface MigrationPlan {
  version: string;
  migrate: (data: any) => any;
}

const migrations: MigrationPlan[] = [
  {
    version: '2.0.0',
    migrate: (data) => {
      // Migration logic for v2.0.0
      return transformedData;
    }
  }
];
```

## Troubleshooting Common Issues

### YouTube API Issues
1. **Player not loading** : Vérifier CSP et network connectivity
2. **Video not playing** : Géo-restrictions ou vidéo privée
3. **Slow loading** : Bundle trop gros, activer lazy loading

### Performance Issues
1. **Slow initial load** : Analyser bundle avec webpack-bundle-analyzer
2. **Memory leaks** : Vérifier les subscriptions non fermées
3. **Layout shifts** : Réserver l'espace pour le contenu dynamique

### Browser Compatibility
1. **Safari issues** : Polyfills pour features manquantes
2. **IE/Edge legacy** : Transpilation ES5 si nécessaire
3. **Mobile quirks** : Viewport et touch events

---

*Documentation technique v1.0 - Dernière mise à jour : Janvier 2025*