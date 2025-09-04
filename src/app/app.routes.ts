import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/video-player',
    pathMatch: 'full'
  },
  {
    path: 'video-player',
    loadChildren: () => import('./features/video-player/video-player.routes').then(m => m.VIDEO_PLAYER_ROUTES)
  },
  {
    path: 'loop-manager',
    loadChildren: () => import('./features/loop-manager/loop-manager.routes').then(m => m.LOOP_MANAGER_ROUTES)
  },
  {
    path: 'session-manager',
    loadChildren: () => import('./features/session-manager/session-manager.routes').then(m => m.SESSION_MANAGER_ROUTES)
  },
  {
    path: '**',
    redirectTo: '/video-player'
  }
];
