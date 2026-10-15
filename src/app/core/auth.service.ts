import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ConsoleFunction, Me } from './models';
import { describeError } from './errors';

const TOKEN_KEY = 'bpm-console-token';

/**
 * Who the signed-in person is and what they may do. Sign-in posts the user name and password to the backend, which
 * answers with a JWT. The token lives in sessionStorage (gone when the tab closes) and is sent as a Bearer header.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly me = signal<Me | null>(null);
  readonly error = signal<string | null>(null);
  readonly operations = computed(() => this.me()?.operations === true);

  private token: string | null = readToken();

  constructor(private readonly api: ApiService) {}

  getToken(): string | null {
    return this.token;
  }

  /** Called once at start-up. Never throws: without a token (or with a refused one) the sign-in form is shown. */
  async load(): Promise<void> {
    if (!this.token) {
      return;
    }
    try {
      this.me.set(await firstValueFrom(this.api.me()));
      this.error.set(null);
    } catch (e) {
      this.clear();
      this.error.set(describeError(e));
    }
  }

  /** Throws the HTTP error on a wrong password so the form can show its message. */
  async login(username: string, password: string): Promise<void> {
    this.error.set(null);
    const res = await firstValueFrom(this.api.login(username, password));
    this.token = res.token;
    storeToken(res.token);
    try {
      this.me.set(await firstValueFrom(this.api.me()));
    } catch (e) {
      this.clear();
      throw e;
    }
  }

  logout(): void {
    this.clear();
    this.error.set(null);
  }

  /** The backend refused the token (expired or revoked): back to the sign-in form. */
  sessionExpired(): void {
    if (this.token) {
      this.clear();
      this.error.set('Your session has ended. Please sign in again.');
    }
  }

  can(fn: ConsoleFunction): boolean {
    return this.me()?.functions.includes(fn) === true;
  }

  private clear(): void {
    this.token = null;
    storeToken(null);
    this.me.set(null);
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage unavailable: the person stays signed in until the page is reloaded
  }
}
