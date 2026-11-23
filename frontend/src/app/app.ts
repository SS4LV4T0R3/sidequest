import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AccountService, UserProfile } from './account.service';
import { QuestService, Quest } from './quest.service'; // [R02/R03] Importiamo il servizio missioni

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private accounts = inject(AccountService);
  private questService = inject(QuestService); // Iniezione del servizio

  protected user = signal<UserProfile | null>(null);
  protected view = signal<'login' | 'register' | 'profile' | 'admin' | 'quests'>('login');
  protected busy = signal(false);
  protected restoringSession = signal(true);
  private sessionRequest: Subscription;
  protected message = signal('');
  protected failed = signal(false);
  
  protected users = signal<UserProfile[]>([]);
  protected page = signal(1);
  protected total = signal(0);

  protected quests = signal<Quest[]>([]); // [R03] Stato per memorizzare le missioni

  constructor() {
    this.sessionRequest = this.accounts.me().subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.view.set('profile');
        this.restoringSession.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.restoringSession.set(false);
        if (error.status !== 401) this.showError(error);
      }
    });
  }

  protected navigate(view: 'login' | 'register' | 'profile' | 'admin' | 'quests') {
    if (this.busy()) return;
    this.view.set(view);
    this.message.set('');
    if (view === 'admin') this.loadUsers(1);
    if (view === 'quests') this.loadQuests(); // [R03] Carica le missioni quando si apre la schermata
  }

  protected register(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (this.busy() || !this.validateForm(form)) return;
    const values = new FormData(form);
    const password = String(values.get('password'));
    if (password !== values.get('confirmation')) {
      this.failed.set(true);
      this.message.set('Le password non coincidono.');
      return;
    }
    this.startRequest();
    this.accounts.register(String(values.get('email')), String(values.get('nickname')), password, String(values.get('role'))).subscribe({
      next: () => {
        form.reset();
        this.view.set('login');
        this.busy.set(false);
        this.message.set('Account creato. Ora puoi accedere.');
      },
      error: (error) => this.showError(error)
    });
  }

  protected login(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (this.busy() || !this.validateForm(form)) return;
    const values = new FormData(form);
    this.startRequest();
    this.accounts.login(String(values.get('email')), String(values.get('password'))).subscribe({
      next: ({ user }) => {
        form.reset();
        this.user.set(user);
        this.view.set('profile');
        this.busy.set(false);
      },
      error: (error) => this.showError(error)
    });
  }

  protected saveProfile(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (this.busy() || !this.validateForm(form)) return;
    const values = new FormData(form);
    this.startRequest();
    this.accounts.updateProfile(String(values.get('nickname')), String(values.get('bio'))).subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.busy.set(false);
        this.message.set('Profilo aggiornato.');
      },
      error: (error) => this.showError(error)
    });
  }

  protected logout() {
    if (this.busy()) return;
    this.startRequest();
    this.accounts.logout().subscribe({
      next: () => {
        this.user.set(null);
        this.view.set('login');
        this.busy.set(false);
        this.message.set('Hai effettuato l’uscita.');
      },
      error: (error) => this.showError(error)
    });
  }

  protected loadUsers(page: number) {
    this.startRequest();
    this.accounts.users(page).subscribe({
      next: (result) => {
        this.users.set(result.users);
        this.total.set(result.total);
        this.page.set(result.page);
        this.busy.set(false);
      },
      error: (error) => this.showError(error)
    });
  }

  protected changeStatus(user: UserProfile) {
    if (this.busy()) return;
    this.startRequest();
    this.accounts.setActive(user.id, !user.isActive).subscribe({
      next: ({ user: updated }) => {
        this.users.update((users) => users.map((item) => item.id === updated.id ? updated : item));
        this.busy.set(false);
        this.message.set(`Stato di ${updated.nickname} aggiornato.`);
      },
      error: (error) => this.showError(error)
    });
  }

  // [R03] Lettura Missioni dal database
  protected loadQuests() {
    this.startRequest();
    this.questService.getQuests().subscribe({
      next: (quests) => {
        this.quests.set(quests);
        this.busy.set(false);
      },
      error: (error) => this.showError(error)
    });
  }

  // [R02] Invio form Creazione Missione
  protected createQuest(event: Event, form: HTMLFormElement) {
    event.preventDefault();
    if (this.busy() || !form.reportValidity()) return;
    const values = new FormData(form);
    
    const questData = {
      title: String(values.get('title')),
      presentation: String(values.get('presentation')),
      category: String(values.get('category')),
      type: values.get('type') as 'ORDINARY' | 'SECRET_TIMED',
      timeLimitSeconds: values.get('timeLimitSeconds') ? Number(values.get('timeLimitSeconds')) : null,
      latitude: values.get('latitude') ? Number(values.get('latitude')) : null,
      longitude: values.get('longitude') ? Number(values.get('longitude')) : null
    };

    this.startRequest();
    this.questService.createQuest(questData).subscribe({
      next: () => {
        form.reset();
        this.message.set('Missione creata con successo!');
        this.loadQuests(); // Ricarica la tabella dopo la creazione
      },
      error: (error) => this.showError(error)
    });
  }

  private startRequest() {
    this.sessionRequest.unsubscribe();
    this.restoringSession.set(false);
    this.busy.set(true);
    this.failed.set(false);
    this.message.set('');
  }

  private validateForm(form: HTMLFormElement): boolean {
    if (!form.reportValidity()) return false;
    const nickname = form.elements.namedItem('nickname') as HTMLInputElement | null;
    const password = form.elements.namedItem('password') as HTMLInputElement | null;
    const bio = form.elements.namedItem('bio') as HTMLTextAreaElement | null;
    let message = '';
    if (nickname && !/^[\p{L}\p{N}._-]{3,50}$/u.test(nickname.value.trim())) {
      message = 'Il nickname deve contenere da 3 a 50 lettere, numeri, punti, trattini o underscore.';
    }
    if (password) {
      // Conteggio Unicode coerente con il backend.
      const length = [...password.value].length;
      const minimum = this.view() === 'register' ? 12 : 1;
      if (!message && (length < minimum || length > 128)) {
        message = `La password deve contenere da ${minimum} a 128 caratteri.`;
      }
    }
    if (!message && bio && [...bio.value].length > 500) {
      message = 'La biografia può contenere al massimo 500 caratteri.';
    }
    if (message) {
      this.failed.set(true);
      this.message.set(message);
      return false;
    }
    return true;
  }

  private showError(error: HttpErrorResponse) {
    this.busy.set(false);
    this.failed.set(true);
    this.message.set(error.error?.error?.message ?? 'Il server non è raggiungibile. Riprova tra poco.');
    if (error.status === 401 && this.user()) {
      this.user.set(null);
      this.view.set('login');
      this.message.set('La sessione è terminata. Accedi di nuovo.');
    }
  }
}