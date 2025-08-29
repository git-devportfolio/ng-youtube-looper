# Services Documentation

## YouTubeService

Le `YouTubeService` est responsable de l'intégration avec l'API YouTube IFrame Player pour la lecture et le contrôle de vidéos YouTube.

### Fonctionnalités

#### Chargement et Initialisation
- **Chargement automatique de l'API YouTube** : Le service charge de manière asynchrone l'API YouTube IFrame
- **Initialisation du player** : Création d'un player YouTube dans un élément DOM spécifique
- **Gestion SSR** : Vérification de l'environnement browser avant l'initialisation

#### Validation d'URLs YouTube
- **Extraction d'ID vidéo** : Support de tous les formats d'URLs YouTube (standard, court, embed, mobile)
- **Validation d'URLs** : Vérification de la validité des URLs YouTube fournies

#### Contrôles de Lecture
- **Contrôles basiques** : Play, pause, stop
- **Navigation** : Seek vers une position spécifique
- **Vitesse de lecture** : Contrôle du taux de lecture (0.25x à 2x)
- **Volume** : Contrôle du volume (0-100)

#### État Réactif avec Signals
- **PlayerState** : État en temps réel du player (prêt, en cours, erreurs)
- **VideoInfo** : Informations de la vidéo courante (titre, durée, auteur)
- **Gestion d'erreurs** : Capture et signalement des erreurs du player

### Usage

```typescript
import { YouTubeService } from '@core/services/youtube.service';

@Component({...})
export class VideoPlayerComponent implements OnInit {
  private youtubeService = inject(YouTubeService);
  
  // Accès aux signals reactifs
  playerState = this.youtubeService.playerState;
  currentVideo = this.youtubeService.currentVideo;

  async ngOnInit() {
    // Initialiser le player dans un élément DOM
    await this.youtubeService.initializePlayer('player-container', 'VIDEO_ID');
  }

  // Contrôler la lecture
  playVideo() {
    this.youtubeService.play();
  }

  pauseVideo() {
    this.youtubeService.pause();
  }

  seekToPosition(seconds: number) {
    this.youtubeService.seekTo(seconds);
  }

  changeSpeed(rate: number) {
    this.youtubeService.setPlaybackRate(rate);
  }
}
```

### API

#### Méthodes Principales

| Méthode | Description | Paramètres | Retour |
|---------|-------------|------------|--------|
| `initializePlayer()` | Initialise le player YouTube | `elementId: string, videoId: string` | `Promise<void>` |
| `loadVideo()` | Charge une nouvelle vidéo | `videoId: string` | `Promise<void>` |
| `extractVideoId()` | Extrait l'ID d'une URL YouTube | `url: string` | `string \| null` |
| `isValidYouTubeUrl()` | Valide une URL YouTube | `url: string` | `boolean` |
| `getVideoInfo()` | Récupère les infos vidéo | `videoId: string` | `Promise<VideoInfo \| null>` |

#### Contrôles de Lecture

| Méthode | Description | Paramètres |
|---------|-------------|------------|
| `play()` | Lance la lecture | - |
| `pause()` | Met en pause | - |
| `stop()` | Arrête la lecture | - |
| `seekTo()` | Navigation temporelle | `seconds: number` |
| `setPlaybackRate()` | Vitesse de lecture | `rate: number` |
| `setVolume()` | Contrôle volume | `volume: number` |

#### Getters

| Méthode | Description | Retour |
|---------|-------------|--------|
| `getCurrentTime()` | Position courante | `number` |
| `getDuration()` | Durée totale | `number` |
| `getPlaybackRate()` | Vitesse courante | `number` |
| `getVolume()` | Volume courant | `number` |

#### Signals Réactifs

| Signal | Type | Description |
|--------|------|-------------|
| `playerState()` | `PlayerState` | État complet du player |
| `currentVideo()` | `VideoInfo \| null` | Informations de la vidéo courante |

### Types

```typescript
interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  error: string | null;
}

interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  author: string;
  thumbnail: string;
}
```

### Gestion d'Erreurs

Le service gère automatiquement les erreurs YouTube communes :
- **ID vidéo invalide** (erreur 2)
- **Erreur HTML5** (erreur 5)
- **Vidéo introuvable ou privée** (erreur 100)
- **Lecture non autorisée** (erreurs 101, 150)

Les erreurs sont exposées via le signal `playerState().error`.

### Tests

Le service est entièrement testé avec :
- ✅ Tests de validation d'URL YouTube
- ✅ Tests de gestion d'état
- ✅ Tests de contrôles sans player initialisé
- ✅ Tests de gestion d'erreurs
- ✅ Tests de compatibilité SSR

### Dépendances

- **Angular Platform** : Détection de l'environnement browser
- **Angular Signals** : Gestion d'état réactive
- **YouTube IFrame API** : Chargement dynamique depuis https://www.youtube.com/iframe_api