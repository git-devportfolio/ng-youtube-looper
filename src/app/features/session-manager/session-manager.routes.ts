import { Routes } from '@angular/router';

export const SESSION_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/session-manager/session-manager.component').then(m => m.SessionManagerComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./ui/session-manager/session-manager.component').then(m => m.SessionManagerComponent)
  },
  {
    path: 'sessions',
    loadComponent: () => import('./ui/session-list/session-list.component').then(m => m.SessionListComponent)
  },
  {
    path: 'create',
    loadComponent: () => import('./ui/session-form/session-form.component').then(m => m.SessionFormComponent)
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./ui/session-form/session-form.component').then(m => m.SessionFormComponent)
  },
  {
    path: 'import-export',
    loadComponent: () => import('./ui/import-export/import-export.component').then(m => m.ImportExportComponent)
  }
];