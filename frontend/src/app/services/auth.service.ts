import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User { id: string; name: string; email: string; }
interface AuthResponse { token: string; user: User; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<User | null>(this.loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  token(): string | null {
    return localStorage.getItem('auth_token');
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(r => this.store(r)));
  }

  register(name: string, email: string, password: string) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, { name, email, password })
      .pipe(tap(r => this.store(r)));
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private store(r: AuthResponse) {
    localStorage.setItem('auth_token', r.token);
    localStorage.setItem('auth_user', JSON.stringify(r.user));
    this._user.set(r.user);
  }
}
