import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
  },
  {
    path: 'finances',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/finances/finances.component').then(m => m.FinancesComponent),
  },
  {
    path: 'assistant',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/assistant/assistant.component').then(m => m.AssistantComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
