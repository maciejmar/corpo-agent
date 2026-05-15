import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'tasks',
    loadComponent: () => import('./pages/tasks/tasks.component').then(m => m.TasksComponent),
  },
  {
    path: 'finances',
    loadComponent: () => import('./pages/finances/finances.component').then(m => m.FinancesComponent),
  },
  {
    path: 'assistant',
    loadComponent: () => import('./pages/assistant/assistant.component').then(m => m.AssistantComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
