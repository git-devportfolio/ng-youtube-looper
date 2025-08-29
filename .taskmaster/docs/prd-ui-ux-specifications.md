# PRD UI/UX - Interface et Expérience Utilisateur

## Vue d'ensemble Design

Cette spécification définit l'expérience utilisateur et l'interface de ng-youtube-looper, optimisée pour l'apprentissage musical avec une approche mobile-first et une ergonomie intuitive.

## Principes de Design

### Design System
- **Templates** : Toujours utiliser des fichiers HTML séparés pour tous les composants Angular
- **Palette de couleurs** : Thème sombre par défaut avec option claire
- **Typography** : Police system (San Francisco, Segoe UI, Roboto)
- **Iconographie** : Material Icons ou Feather Icons
- **Animations** : Transitions fluides 200-300ms ease-out
- **Accessibilité** : WCAG 2.1 AA compliance

### Mobile-First Approach
- Interface tactile optimisée
- Contrôles suffisamment larges (min 44px)
- Gestes intuitifs (swipe, pinch, drag)
- Orientation portrait/paysage adaptative

## Layouts Responsive

### Structure Générale
```
┌─────────────────────────────────┐
│           HEADER                │
├─────────────────────────────────┤
│                                 │
│        VIDEO PLAYER             │
│                                 │
├─────────────────────────────────┤
│      PLAYER CONTROLS            │
├─────────────────────────────────┤
│       TIMELINE/LOOPS            │
├─────────────────────────────────┤
│      LOOP CONTROLS              │
├─────────────────────────────────┤
│     SESSION MANAGER             │
└─────────────────────────────────┘
```

### Layout Mobile (320px - 767px)
- **Stacking vertical** de tous les composants
- **Player** : Aspect ratio 16:9, pleine largeur
- **Controls** : Boutons larges, disposition horizontale
- **Timeline** : Simplifiée, gestes tactiles
- **Loops** : Liste verticale avec actions swipe

### Layout Tablet (768px - 1023px)
- **Player** centré avec contrôles intégrés
- **Sidebar** dépliable pour loops et sessions
- **Timeline** plus détaillée avec zoom
- **Multi-colonnes** pour listes

### Layout Desktop (1024px+)
- **Layout en grille** : Player principal + panels latéraux
- **Raccourcis clavier** complets
- **Hover states** et tooltips
- **Drag & drop** pour réorganisation

## Composants UI Détaillés

### Header Component
```scss
.app-header {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
  
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .logo {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .url-input {
    flex: 1;
    max-width: 400px;
    margin: 0 1rem;
    
    input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 0.25rem;
      
      &:focus {
        outline: none;
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
      }
    }
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
  }
}
```

### Video Player Component
```scss
.video-player {
  position: relative;
  background: #000;
  border-radius: 0.5rem;
  overflow: hidden;
  
  // Responsive aspect ratio
  @include mobile {
    aspect-ratio: 16/9;
  }
  
  @include desktop {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .youtube-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  
  .overlay-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.7));
    padding: 1rem;
    opacity: 0;
    transition: opacity 0.3s ease;
    
    &:hover,
    &.visible {
      opacity: 1;
    }
  }
  
  .loading-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}
```

### Player Controls Component
```scss
.player-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  
  .play-pause-btn {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--accent-color);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    
    @include mobile {
      width: 3.5rem;
      height: 3.5rem;
    }
    
    &:hover {
      background: var(--accent-hover);
    }
    
    &:disabled {
      background: var(--bg-disabled);
      cursor: not-allowed;
    }
  }
  
  .time-progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    
    .time-slider {
      flex: 1;
      height: 0.25rem;
      background: var(--bg-tertiary);
      border-radius: 0.125rem;
      outline: none;
      cursor: pointer;
      
      &::-webkit-slider-thumb {
        appearance: none;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        background: var(--accent-color);
        cursor: pointer;
      }
    }
    
    .time-display {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.875rem;
      color: var(--text-secondary);
      min-width: 5rem;
    }
  }
  
  .speed-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    .speed-preset {
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 0.25rem;
      background: transparent;
      font-size: 0.75rem;
      
      &.active {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
      }
    }
  }
}
```

### Timeline Component
```scss
.timeline {
  position: relative;
  height: 4rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  margin: 1rem 0;
  cursor: pointer;
  overflow: hidden;
  
  .timeline-track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 0.25rem;
    background: var(--bg-quaternary);
    transform: translateY(-50%);
  }
  
  .current-time-indicator {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--accent-color);
    z-index: 10;
    
    &::before {
      content: '';
      position: absolute;
      top: -0.25rem;
      left: -0.25rem;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      background: var(--accent-color);
    }
  }
  
  .loop-segment {
    position: absolute;
    top: 0.75rem;
    bottom: 0.75rem;
    background: rgba(var(--accent-rgb), 0.3);
    border: 2px solid var(--accent-color);
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(var(--accent-rgb), 0.5);
      transform: translateY(-2px);
    }
    
    &.active {
      background: rgba(var(--accent-rgb), 0.6);
      box-shadow: 0 0 0 2px var(--accent-color);
    }
    
    .loop-name {
      position: absolute;
      top: 50%;
      left: 0.5rem;
      transform: translateY(-50%);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
    }
    
    .resize-handles {
      .resize-start,
      .resize-end {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 0.5rem;
        background: var(--accent-color);
        cursor: ew-resize;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .resize-start { left: 0; }
      .resize-end { right: 0; }
    }
    
    &:hover .resize-handles {
      .resize-start,
      .resize-end {
        opacity: 1;
      }
    }
  }
  
  // Responsive adaptations
  @include mobile {
    height: 3rem;
    
    .loop-segment {
      top: 0.5rem;
      bottom: 0.5rem;
      
      .loop-name {
        display: none; // Masquer sur mobile si trop petit
      }
    }
  }
}
```

### Loop Manager Component
```scss
.loop-manager {
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  padding: 1rem;
  
  .loop-manager-header {
    display: flex;
    justify-content: between;
    align-items: center;
    margin-bottom: 1rem;
    
    h3 {
      margin: 0;
      color: var(--text-primary);
    }
    
    .add-loop-btn {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      cursor: pointer;
      
      &:hover {
        background: var(--accent-hover);
      }
    }
  }
  
  .loop-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    
    @include tablet-up {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }
  }
  
  .loop-item {
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
    padding: 0.75rem;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    
    &:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }
    
    &.active {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 1px var(--accent-color);
    }
    
    .loop-header {
      display: flex;
      justify-content: between;
      align-items: center;
      margin-bottom: 0.5rem;
      
      .loop-name {
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .loop-actions {
        display: flex;
        gap: 0.25rem;
        opacity: 0;
        transition: opacity 0.2s ease;
        
        button {
          width: 1.5rem;
          height: 1.5rem;
          border: none;
          border-radius: 0.25rem;
          background: var(--bg-quaternary);
          cursor: pointer;
          
          &:hover {
            background: var(--accent-color);
            color: white;
          }
        }
      }
    }
    
    &:hover .loop-actions {
      opacity: 1;
    }
    
    .loop-details {
      display: flex;
      justify-content: between;
      align-items: center;
      font-size: 0.875rem;
      color: var(--text-secondary);
      
      .loop-time {
        font-family: 'Monaco', 'Consolas', monospace;
      }
      
      .loop-duration {
        background: var(--bg-quaternary);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
      }
    }
    
    .loop-controls {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      
      .loop-play-btn {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--accent-color);
        border-radius: 0.25rem;
        background: transparent;
        color: var(--accent-color);
        cursor: pointer;
        
        &:hover,
        &.playing {
          background: var(--accent-color);
          color: white;
        }
      }
      
      .repeat-count {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
    }
  }
}
```

### Loop Creation Modal
```scss
.loop-creation-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  
  .modal-content {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    padding: 2rem;
    max-width: 500px;
    width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    
    .modal-header {
      display: flex;
      justify-content: between;
      align-items: center;
      margin-bottom: 1.5rem;
      
      h2 {
        margin: 0;
        color: var(--text-primary);
      }
      
      .close-btn {
        width: 2rem;
        height: 2rem;
        border: none;
        background: transparent;
        font-size: 1.25rem;
        cursor: pointer;
        color: var(--text-secondary);
        
        &:hover {
          color: var(--text-primary);
        }
      }
    }
    
    .form-group {
      margin-bottom: 1.5rem;
      
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-primary);
      }
      
      input[type="text"],
      input[type="number"] {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 0.375rem;
        background: var(--bg-secondary);
        color: var(--text-primary);
        
        &:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.2);
        }
      }
      
      .time-inputs {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 0.75rem;
        align-items: center;
        
        .separator {
          text-align: center;
          font-weight: 600;
          color: var(--text-secondary);
        }
      }
      
      .current-time-btn {
        padding: 0.375rem 0.75rem;
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        background: var(--bg-tertiary);
        font-size: 0.75rem;
        cursor: pointer;
        
        &:hover {
          background: var(--accent-color);
          color: white;
          border-color: var(--accent-color);
        }
      }
    }
    
    .modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      
      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        font-weight: 500;
        
        &.btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          
          &:hover {
            background: var(--bg-quaternary);
          }
        }
        
        &.btn-primary {
          background: var(--accent-color);
          color: white;
          
          &:hover {
            background: var(--accent-hover);
          }
          
          &:disabled {
            background: var(--bg-disabled);
            cursor: not-allowed;
          }
        }
      }
    }
  }
}
```

### Session Manager Component
```scss
.session-manager {
  .session-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1rem;
    
    .tab {
      padding: 0.75rem 1rem;
      border: none;
      background: transparent;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      
      &.active {
        border-bottom-color: var(--accent-color);
        color: var(--accent-color);
      }
    }
  }
  
  .session-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    
    .session-item {
      background: var(--bg-secondary);
      border-radius: 0.5rem;
      padding: 1rem;
      border: 1px solid var(--border-color);
      
      .session-header {
        display: flex;
        justify-content: between;
        align-items: start;
        margin-bottom: 0.5rem;
        
        .session-info {
          flex: 1;
          
          .session-name {
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 0.25rem;
          }
          
          .session-video {
            color: var(--text-secondary);
            font-size: 0.875rem;
          }
          
          .session-meta {
            display: flex;
            gap: 1rem;
            margin-top: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-tertiary);
            
            .loop-count,
            .last-modified {
              display: flex;
              align-items: center;
              gap: 0.25rem;
            }
          }
        }
        
        .session-actions {
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
      }
      
      &:hover .session-actions {
        opacity: 1;
      }
      
      .session-preview {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
        
        .loop-chip {
          background: var(--bg-tertiary);
          padding: 0.25rem 0.5rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
      }
    }
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
    
    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }
    
    .empty-message {
      margin-bottom: 1rem;
    }
    
    .create-session-btn {
      background: var(--accent-color);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.375rem;
      cursor: pointer;
      
      &:hover {
        background: var(--accent-hover);
      }
    }
  }
}
```

## Thématisation et Variables CSS

### CSS Custom Properties
```scss
:root {
  // Couleurs principales
  --accent-color: #6366f1;
  --accent-hover: #5855eb;
  --accent-rgb: 99, 102, 241;
  
  // Backgrounds
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-quaternary: #e2e8f0;
  --bg-disabled: #94a3b8;
  
  // Texte
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #64748b;
  
  // Bordures
  --border-color: #e2e8f0;
  --border-hover: #cbd5e1;
  
  // Ombres
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  // Backgrounds
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --bg-quaternary: #475569;
  
  // Texte
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-tertiary: #94a3b8;
  
  // Bordures
  --border-color: #334155;
  --border-hover: #475569;
}
```

## Interactions et Animations

### États Interactifs
```scss
.interactive-element {
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 2px;
  }
}
```

### Micro-interactions
- **Boutons** : Hover lift + color transition
- **Cards** : Hover elevation + border color
- **Inputs** : Focus glow + border transition
- **Timeline** : Drag feedback + snap indicators

### Loading States
```scss
.loading-skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--bg-quaternary) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: loading-shimmer 1.5s infinite;
}

@keyframes loading-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

## Accessibilité et Usabilité

### Guidelines d'Accessibilité
- **Contraste** : Ratio minimum 4.5:1 pour texte normal
- **Focus** : Indicateurs visibles et logiques
- **Keyboard** : Navigation complète au clavier
- **Screen readers** : Labels et descriptions appropriées
- **Motion** : Respect préférence `prefers-reduced-motion`

### Gestes Tactiles
- **Timeline** : Drag horizontal pour navigation
- **Loops** : Tap pour sélection, long press pour menu
- **Speed** : Swipe vertical pour ajustement rapide
- **Volume** : Pinch pour contrôle précis

### Raccourcis Clavier
- **Space** : Play/Pause
- **←/→** : Seek -5s/+5s
- **↑/↓** : Volume +/-
- **1-9** : Sélection loop 1-9
- **L** : Créer nouvelle loop
- **Échap** : Fermer modales

## Feedback Utilisateur

### Messages d'État
```scss
.toast-notification {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  
  &.success { border-left: 4px solid #10b981; }
  &.error { border-left: 4px solid #ef4444; }
  &.warning { border-left: 4px solid #f59e0b; }
  &.info { border-left: 4px solid #3b82f6; }
  
  animation: toast-slide-in 0.3s ease;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### États de Chargement
- **Player** : Spinner centré sur fond noir
- **Sessions** : Skeleton cards avec shimmer
- **Timeline** : Barre de progression indéterminée
- **Saves** : Toast avec indicateur

## Performance UI

### Optimisations
- **Virtual scrolling** pour longues listes
- **Lazy loading** des composants non critiques  
- **Debounced inputs** pour recherche/filtres
- **Memoization** des calculs coûteux
- **CSS containment** pour isolation des styles

### Métriques Cibles
- **FCP** : < 1.5s
- **LCP** : < 2.5s
- **CLS** : < 0.1
- **FID** : < 100ms
- **TTI** : < 3s