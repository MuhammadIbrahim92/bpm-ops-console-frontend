import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ConsoleFunction, Me } from './models';
import { describeError } from './errors';

/** Who the signed-in person is and what they may do. Sign-in itself is done by WebLogic. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly me = signal<Me | null>(null);
  readonly error = signal<string | null>(null);
  readonly operations = computed(() => this.me()?.operations === true);

  constructor(private readonly api: ApiService) {}

  /** Called once at start-up. Never throws: a refusal is shown by the shell instead of blocking the app. */
  async load(): Promise<void> {
    try {
      this.me.set(await firstValueFrom(this.api.me()));
      this.error.set(null);
    } catch (e) {
      this.me.set(null);
      this.error.set(describeError(e));
    }
  }

  can(fn: ConsoleFunction): boolean {
    return this.me()?.functions.includes(fn) === true;
  }
}
