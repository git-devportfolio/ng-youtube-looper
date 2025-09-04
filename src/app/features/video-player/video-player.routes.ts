import { Routes } from '@angular/router';

export const VIDEO_PLAYER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/video-player-page/video-player-page.component').then(m => m.VideoPlayerPageComponent)
  },
  {
    path: 'player',
    loadComponent: () => import('./ui/video-player/video-player.component').then(m => m.VideoPlayerComponent)
  },
  {
    path: 'timeline',
    loadComponent: () => import('./ui/timeline/timeline.component').then(m => m.TimelineComponent)
  },
  {
    path: 'controls',
    loadComponent: () => import('./ui/player-controls/player-controls.component').then(m => m.PlayerControlsComponent)
  }
];