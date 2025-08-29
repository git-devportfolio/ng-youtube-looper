# Product Requirements Document - YouTube Looper

## Vue d'ensemble du Projet

**ng-youtube-looper** est une application web responsive développée en Angular pour permettre aux guitaristes de travailler efficacement les parties complexes en bouclant des segments spécifiques de vidéos YouTube avec contrôle de la vitesse de lecture.

## Objectifs

### Objectif Principal
Créer un outil d'apprentissage musical permettant de :
- Intégrer et lire des vidéos YouTube
- Définir et boucler des segments précis
- Contrôler la vitesse de lecture
- Sauvegarder les sessions de travail

### Objectifs Techniques
- Application Angular 19.2 avec architecture moderne
- Interface responsive pour tous les appareils
- Pas de backend requis (client-side only)
- Persistance des données via localStorage

## Public Cible

- **Guitaristes** débutants à avancés
- **Musiciens** voulant analyser des morceaux
- **Professeurs de musique** pour créer des exercices
- **Étudiants** en conservatoire ou autodidactes

## Fonctionnalités Principales

### 1. Intégration Vidéo YouTube
- **Saisie URL** : Champ pour coller l'URL d'une vidéo YouTube
- **Validation URL** : Vérification format YouTube valide
- **Lecteur intégré** : Utilisation de l'API YouTube IFrame Player
- **Contrôles natifs** : Play/Pause/Stop via interface personnalisée

### 2. Système de Boucles
- **Création de segments** : Définir point de début et fin avec précision (au dixième de seconde)
- **Sélection graphique** : Interface de timeline avec curseurs draggables
- **Sélection numérique** : Saisie manuelle des temps (mm:ss.d)
- **Aperçu segment** : Prévisualisation avant validation
- **Gestion multiple** : Création et stockage de plusieurs boucles par vidéo

### 3. Contrôle de Vitesse
- **Plage de vitesse** : 0.25x à 2x par pas de 0.1x
- **Presets rapides** : Boutons 0.5x, 0.75x, 1x, 1.25x, 1.5x
- **Saisie manuelle** : Champ numérique avec validation
- **Mémorisation** : Vitesse sauvée par boucle

### 4. Interface de Contrôle
- **Lecture en boucle** : Bouton Play/Stop spécifique aux segments
- **Navigation** : Boutons précédent/suivant entre boucles
- **Répétition automatique** : Configuration nombre de répétitions
- **Compteur** : Affichage du nombre de boucles effectuées

### 5. Gestion des Sessions
- **Sauvegarde automatique** : État de l'application en localStorage
- **Sessions nommées** : Possibilité de nommer et organiser les sessions
- **Historique vidéos** : Liste des vidéos récemment travaillées
- **Export/Import** : Fonctionnalités d'échange de sessions (JSON)

### 6. Interface Responsive
- **Mobile First** : Optimisation prioritaire mobile/tablette
- **Adaptabilité** : Interface s'adaptant à toutes tailles d'écran
- **Touch-friendly** : Contrôles tactiles optimisés
- **Mode portrait/paysage** : Layouts adaptés selon orientation

## Spécifications Techniques

### Architecture Angular
- **Version** : Angular 19.2
- **Architecture** : Standalone Components (pas de NgModules)
- **Gestion d'état** : Signals natifs Angular
- **Styling** : SCSS exclusivement
- **Forms** : Reactive Forms uniquement
- **Control Flow** : Syntaxe moderne (@if, @for, @switch)
- **Injection** : Fonction inject() préférée au constructeur

### Pattern Architectural
- **Pattern Façade** : Une façade par feature pour orchestrer l'état
- **Services métier** : Services purs pour logique YouTube et stockage
- **Composants UI** : Composants focalisés sur l'affichage uniquement
- **Signals** : Gestion réactive de l'état sans abonnements manuels

### API et Intégrations
- **YouTube IFrame Player API** : Intégration officielle Google
- **localStorage API** : Persistance côté client
- **Web Audio API** : Pour analyse audio avancée (optionnel v2)

### Persistance de Données
- **Format** : JSON dans localStorage
- **Clés de stockage** :
  - `yl_sessions` : Sessions sauvegardées
  - `yl_current` : Session en cours
  - `yl_settings` : Préférences utilisateur
  - `yl_history` : Historique des vidéos

## Structure des Données

### Session
```typescript
interface LooperSession {
  id: string;
  name: string;
  videoId: string;
  videoTitle: string;
  loops: LoopSegment[];
  settings: SessionSettings;
  createdAt: Date;
  updatedAt: Date;
}
```

### Segment de Boucle
```typescript
interface LoopSegment {
  id: string;
  name: string;
  startTime: number; // en secondes
  endTime: number;   // en secondes
  playbackSpeed: number;
  repeatCount?: number;
  isActive: boolean;
}
```

### Paramètres de Session
```typescript
interface SessionSettings {
  defaultSpeed: number;
  autoRepeat: boolean;
  showTimeline: boolean;
  compactMode: boolean;
}
```

## Composants Angular

### Structure des Composants
```
src/app/
├── core/
│   ├── services/
│   │   ├── youtube.service.ts      # API YouTube
│   │   ├── storage.service.ts      # localStorage
│   │   └── loop.service.ts         # Logique de boucles
├── features/
│   ├── video-player/
│   │   ├── data-access/
│   │   │   └── video-player.service.ts
│   │   ├── feature/
│   │   │   ├── video-player.facade.ts
│   │   │   └── video-player.component.ts
│   │   └── ui/
│   │       ├── player-controls.component.ts
│   │       └── speed-control.component.ts
│   ├── loop-manager/
│   │   ├── feature/
│   │   │   ├── loop-manager.facade.ts
│   │   │   └── loop-manager.component.ts
│   │   └── ui/
│   │       ├── timeline.component.ts
│   │       ├── loop-list.component.ts
│   │       └── loop-form.component.ts
│   └── session-manager/
│       ├── feature/
│       │   ├── session.facade.ts
│       │   └── session-manager.component.ts
│       └── ui/
│           ├── session-list.component.ts
│           └── session-form.component.ts
└── shared/
    ├── components/
    │   ├── header.component.ts
    │   └── footer.component.ts
    └── utils/
        ├── time.utils.ts
        └── youtube.utils.ts
```

## Contraintes et Exigences

### Contraintes Techniques
- **Compatibilité** : Navigateurs modernes (Chrome 90+, Firefox 90+, Safari 14+)
- **Performance** : Bundle initial < 500KB (warning Angular CLI)
- **Responsive** : Breakpoints 320px, 768px, 1024px, 1440px
- **Offline** : Fonctionnement sans internet (vidéos déjà chargées)

### Contraintes UX
- **Temps de chargement** : < 3s pour premier affichage
- **Réactivité** : < 100ms pour actions utilisateur
- **Accessibilité** : Support clavier et lecteurs d'écran
- **Ergonomie** : Maximum 3 clics pour créer une boucle

### Contraintes YouTube
- **Limitations API** : Respect des quotas Google
- **Restrictions vidéo** : Gestion des vidéos privées/indisponibles
- **Géo-blocking** : Affichage d'erreurs appropriées

## Critères d'Acceptance

### MVP (Version 1.0)
- ✅ Intégration d'une vidéo YouTube par URL
- ✅ Création d'au moins 3 boucles par vidéo
- ✅ Contrôle vitesse 0.5x à 2x
- ✅ Sauvegarde session en localStorage
- ✅ Interface responsive mobile/desktop
- ✅ Navigation entre boucles

### Version 1.1 (Extensions)
- Export/Import des sessions
- Historique des vidéos récentes
- Presets de vitesse personnalisés
- Mode sombre/clair
- Raccourcis clavier

### Version 1.2 (Avancé)
- Timeline graphique avec waveform
- Annotations sur segments
- Partage de sessions (URL)
- Support playlists YouTube
- Métronome intégré

## Risques et Mitigation

### Risques Techniques
1. **API YouTube instable** → Cache local + fallback iframe
2. **Performance mobile** → Lazy loading + optimisations bundle
3. **localStorage limité** → Compression JSON + nettoyage auto

### Risques Utilisateur
1. **Interface complexe** → Tests utilisateur + itérations UX
2. **Courbe apprentissage** → Tutoriel intégré + tooltips
3. **Perte de données** → Sauvegarde auto + export facilité

## Planning et Phases

### Phase 1 : Core (2-3 semaines)
- Setup projet Angular + architecture
- Intégration YouTube Player API
- Composants de base (player, controls)
- Système de boucles basique

### Phase 2 : Features (2 semaines)
- Interface loop management
- Persistance localStorage
- Responsive design
- Tests et optimisations

### Phase 3 : Polish (1 semaine)
- UX/UI finalisées
- Gestion d'erreurs
- Documentation
- Déploiement

## Success Metrics

### Métriques Techniques
- Bundle size < 500KB
- Performance Lighthouse > 90
- Tests coverage > 80%
- Zero erreurs console

### Métriques Utilisateur
- Temps création première boucle < 1min
- Taux de sauvegarde sessions > 70%
- Support 95% navigateurs cibles
- Feedback utilisateur > 4/5