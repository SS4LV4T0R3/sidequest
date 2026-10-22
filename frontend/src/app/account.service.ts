import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface UserProfile {
  id: number;
  email: string;
  nickname: string;
  bio: string | null;
  role: 'USER' | 'ADMIN';
  score: number;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private writeOptions = {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  };

  me() {
    return this.http.get<{ user: UserProfile }>('/api/users/me');
  }

  register(email: string, nickname: string, password: string, role: string) {
    return this.http.post<{ user: UserProfile }>('/api/auth/register', { email, nickname, password, role }, this.writeOptions);
  }

  login(email: string, password: string) {
    return this.http.post<{ user: UserProfile }>('/api/auth/login', { email, password }, this.writeOptions);
  }

  logout() {
    return this.http.post<void>('/api/auth/logout', {}, this.writeOptions);
  }

  updateProfile(nickname: string, bio: string) {
    return this.http.patch<{ user: UserProfile }>('/api/users/me', { nickname, bio }, this.writeOptions);
  }

  users(page: number) {
    return this.http.get<{ users: UserProfile[]; total: number; page: number; pageSize: number }>(
      `/api/admin/users?page=${page}&pageSize=10`
    );
  }

  setActive(id: number, isActive: boolean) {
    return this.http.patch<{ user: UserProfile }>(`/api/admin/users/${id}/status`, { isActive }, this.writeOptions);
  }
}
