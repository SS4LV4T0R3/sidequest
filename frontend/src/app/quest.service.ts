import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface Quest {
  id: string;
  title: string;
  presentation: string;
  category: string;
  type: 'ORDINARY' | 'SECRET_TIMED';
  timeLimitSeconds: number | null;
  latitude: number | null;
  longitude: number | null;
  status: 'DRAFT' | 'PUBLISHED';
  creatorId: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class QuestService {
  private http = inject(HttpClient);

  // [R03] Lettura di tutte le missioni dal backend
  getQuests() {
    return this.http.get<Quest[]>('/api/quests');
  }

  // [R02] Invio dei dati per creare una nuova missione
  createQuest(questData: Partial<Quest>) {
    return this.http.post<Quest>('/api/quests', questData, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
  }
}