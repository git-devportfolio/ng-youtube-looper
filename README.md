# 🎸 ng-youtube-looper

Une application web moderne pour boucler des segments spécifiques de vidéos YouTube, conçue pour les musiciens souhaitant travailler des parties complexes avec contrôle de vitesse et gestion de sessions.

![Angular](https://img.shields.io/badge/Angular-19.2-DD0031?style=flat-square&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)
![SCSS](https://img.shields.io/badge/SCSS-hotpink?style=flat-square&logo=sass)

## ✨ Fonctionnalités

### 🎵 Lecture et contrôle vidéo
- **Intégration YouTube IFrame API** : Lecture fluide des vidéos YouTube
- **Contrôle de vitesse avancé** : 0.25x à 2.0x avec presets optimisés pour l'apprentissage musical
- **Navigation temporelle précise** : Contrôles de saut (±10s) et recherche par glissement

### 🔄 Gestion des boucles
- **Boucles personnalisées** : Création de segments avec nom, couleur et répétition
- **Gestion multi-boucles** : Support de plusieurs boucles par vidéo
- **Validation intelligente** : Détection des conflits et résolution automatique

### 💾 Sessions et persistance
- **Sessions sauvegardées** : Stockage automatique dans localStorage
- **Historique des vidéos** : Accès rapide aux sessions récentes
- **Import/Export JSON** : Partage et sauvegarde externe des configurations

### 🎨 Interface responsive
- **Design mobile-first** : Optimisé pour tous les écrans
- **Thème adaptatif** : Mode sombre/clair avec détection système
- **Contrôles tactiles** : Interactions optimisées pour mobile et tablette

## 🚀 Installation et développement

### Prérequis
- **Node.js** 18+ avec npm
- **Angular CLI** 19.2+

### Installation
```bash
# Cloner le repository
git clone <repository-url>
cd ng-youtube-looper

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm start
```

L'application sera disponible sur `http://localhost:4200/`

### Scripts disponibles
```bash
# Développement
npm start              # Serveur de développement
npm run build          # Build de production
npm run build:mobile   # Build optimisé mobile (500KB)

# Tests
npm test               # Tests unitaires avec Karma
npm run lint           # Vérification du code avec ESLint

# Production
npm run build:prod     # Build optimisé pour production
```

## 🏗️ Architecture technique

### Structure du projet
```
src/
├── app/
│   ├── core/                 # Services globaux et utilitaires
│   │   ├── services/         # Services métier (YouTube, validation, storage)
│   │   └── utils/           # Fonctions utilitaires (time, youtube)
│   ├── features/            # Modules fonctionnels
│   │   ├── video-player/    # Lecture vidéo et contrôles
│   │   ├── loop-manager/    # Gestion des boucles
│   │   └── session-manager/ # Sessions et persistance
│   └── shared/              # Composants réutilisables
│       ├── components/      # UI components partagés
│       └── services/        # Services utilitaires
└── styles/                  # Styles globaux SCSS
```

### Technologies utilisées

#### Frontend
- **Angular 19.2** : Framework principal avec standalone components
- **TypeScript 5.0** : Typage strict avec configuration optimisée
- **SCSS** : Styles avec variables CSS et mixins responsives
- **RxJS** : Programmation réactive pour la gestion d'état

#### APIs et intégrations
- **YouTube IFrame API** : Intégration vidéo native
- **Web Storage API** : Persistance localStorage
- **Intersection Observer** : Lazy loading optimisé

### Optimisations de performance

#### Bundle et lazy loading
- **Code splitting** : Modules chargés à la demande
- **Lazy loading** : Composants non-critiques avec `@defer`
- **Tree shaking** : Élimination du code mort
- **Bundle mobile** : Limite stricte 500KB pour mobile

#### Techniques d'optimisation
- **Preload critique** : CSS et ressources prioritaires
- **Service Workers** : Cache intelligent (futur)
- **Compression** : Assets optimisés et minifiés

## 🌐 Compatibilité navigateurs

### Navigateurs supportés
| Navigateur | Version minimale | Statut |
|------------|------------------|---------|
| Chrome     | 90+              | ✅ Complet |
| Firefox    | 88+              | ✅ Complet |
| Safari     | 14+              | ✅ Complet |
| Edge       | 90+              | ✅ Complet |

### APIs requises
- **YouTube IFrame API** : Intégration vidéo
- **Web Storage** : localStorage pour persistance
- **CSS Grid** : Layout responsive
- **ES2022** : Modules et syntaxe moderne

### Fonctionnalités mobiles
- **Touch events** : Contrôles tactiles optimisés
- **Viewport meta** : Adaptation écran mobile
- **PWA ready** : Préparé pour l'installation

## 📱 Guide utilisateur

### 1. Charger une vidéo
1. Collez l'URL YouTube dans le champ de saisie
2. Cliquez sur "Charger" ou appuyez sur Entrée
3. La vidéo s'affiche avec les contrôles intégrés

### 2. Créer des boucles
1. Lisez la vidéo jusqu'au point de début souhaité
2. Cliquez sur "Marquer début" ou utilisez le raccourci
3. Continuez jusqu'à la fin du segment
4. Cliquez sur "Marquer fin" et nommez votre boucle
5. La boucle se répète automatiquement

### 3. Contrôler la vitesse
- **Presets rapides** : Boutons 0.5x, 0.75x, 1x, 1.25x, 1.5x
- **Vitesse custom** : Saisie manuelle avec validation
- **Raccourcis** : +/- pour incrémenter par pas de 0.25x

### 4. Gestion des sessions
- **Sauvegarde auto** : Sessions sauvées en temps réel
- **Historique** : Accès aux 10 dernières vidéos
- **Export/Import** : Partage de configurations JSON

## ⚙️ Configuration

### Variables d'environnement
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  youtubeApiKey: '', // Optionnel pour APIs avancées
  storagePrefix: 'ng-youtube-looper'
};
```

### Personnalisation des thèmes
```scss
// src/styles/_variables.scss
:root {
  --primary-color: #3b82f6;
  --secondary-color: #1e40af;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
}
```

## 🐛 Limitations connues

### YouTube API
- **Vidéos privées** : Non accessibles via l'API
- **Contenu géo-bloqué** : Dépend de la localisation
- **Limitation de débit** : Quota API YouTube si clé utilisée

### Fonctionnalités navigateurs
- **Safari iOS** : Lecture automatique limitée
- **Firefox** : Parfois lent sur les gros bundles
- **Mode privé** : localStorage peut être limité

### Performance
- **Timeline complexe** : Désactivée temporairement (problèmes TypeScript)
- **Gros historiques** : Nettoyage manuel nécessaire

## 🛠️ Développement avancé

### Commandes de build
```bash
# Build avec analyse de bundle
ng build --stats-json
npx webpack-bundle-analyzer dist/ng-youtube-looper/stats.json

# Build mobile optimisé
ng build --configuration=mobile

# Serveur local avec HTTPS
ng serve --ssl --host=0.0.0.0
```

### Structure des tests
```bash
# Tests unitaires
ng test --code-coverage
# Rapport de couverture dans coverage/

# Tests de composants
ng test --include='**/*.component.spec.ts'
```

### Debugging
```bash
# Mode debug avec source maps
ng build --configuration=development --source-map

# Profiling de performance
ng build --configuration=production --build-optimizer=false
```

## 📈 Métriques de performance

### Objectifs de performance
- **Initial Bundle** : < 500KB (mobile), < 1MB (desktop)
- **First Contentful Paint** : < 2s
- **Time to Interactive** : < 3.5s
- **Cumulative Layout Shift** : < 0.1

### Bundle actuel (estimation)
- **Main bundle** : ~400KB (compressé)
- **Lazy chunks** : ~50-100KB chacun
- **Assets** : ~20KB (styles, fonts)

## 🚀 Déploiement

### Build de production
```bash
# Build optimisé
npm run build:prod

# Vérification pré-déploiement
npm run lint
npm test
```

### Hosting recommandé
- **Netlify** : Déploiement automatique avec CI/CD
- **Vercel** : Optimisé pour les frameworks JS
- **Firebase Hosting** : Intégration Google native
- **GitHub Pages** : Hébergement gratuit

### Configuration serveur
```nginx
# nginx.conf pour SPA
location / {
  try_files $uri $uri/ /index.html;
}

# Headers de sécurité
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options SAMEORIGIN;
add_header X-XSS-Protection "1; mode=block";
```

## 🤝 Contribution

### Workflow de développement
1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changes (`git commit -am 'Ajouter nouvelle fonctionnalité'`)
4. Push la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Créer une Pull Request

### Standards de code
- **ESLint** : Configuration Angular recommandée
- **Prettier** : Formatage automatique
- **TypeScript strict** : Typage obligatoire
- **Tests unitaires** : Couverture > 80%

## 📄 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **Angular Team** : Framework et outils de développement
- **YouTube** : API IFrame pour l'intégration vidéo
- **Communauté open-source** : Bibliothèques et inspiration

---

**Développé avec ❤️ pour les musiciens par [Claude Code](https://claude.ai/code)**

*Version actuelle : 1.0.0 - Dernière mise à jour : Janvier 2025*