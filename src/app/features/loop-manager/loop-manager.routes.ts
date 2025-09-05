import { Routes } from '@angular/router';

export const LOOP_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/loop-manager/loop-manager.component').then(m => m.LoopManagerComponent)
  },
  {
    path: 'manager',
    loadComponent: () => import('./ui/loop-manager/loop-manager.component').then(m => m.LoopManagerComponent)
  },
  {
    path: 'list',
    loadComponent: () => import('./ui/loop-list/loop-list.component').then(m => m.LoopListComponent)
  },
  {
    path: 'create',
    loadComponent: () => import('./ui/loop-form/loop-form.component').then(m => m.LoopFormComponent)
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./ui/loop-form/loop-form.component').then(m => m.LoopFormComponent)
  }
];