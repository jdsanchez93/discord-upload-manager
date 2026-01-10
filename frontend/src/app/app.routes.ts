import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'files',
    pathMatch: 'full'
  },
  {
    path: 'files',
    loadComponent: () => import('./features/files/files.component').then(m => m.FilesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'upload',
    loadComponent: () => import('./features/upload/upload.component').then(m => m.UploadComponent),
    canActivate: [authGuard]
  },
  {
    path: 'webhooks',
    loadComponent: () => import('./features/webhooks/webhooks.component').then(m => m.WebhooksComponent),
    canActivate: [authGuard]
  },
  {
    path: 'callback',
    loadComponent: () => import('./core/auth/callback.component').then(m => m.CallbackComponent)
  }
];
