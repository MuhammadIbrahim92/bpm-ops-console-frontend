import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { describeError } from '../core/errors';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page">
      <form class="card login" (ngSubmit)="submit()">
        <h1>Sign in</h1>
        @if (message(); as m) {
          <p role="alert">{{ m }}</p>
        }
        <label>User name
          <input name="username" [(ngModel)]="username" autocomplete="username" required autofocus />
        </label>
        <label>Password
          <input name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="btn primary" [disabled]="busy() || !username || !password">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .login { max-width: 360px; margin: 48px auto; display: flex; flex-direction: column; gap: 12px; }
    label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
  `]
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  username = '';
  password = '';
  readonly busy = signal(false);
  private readonly failure = signal<string | null>(null);

  /** A failed attempt, or why a stored session was dropped. */
  message(): string | null {
    return this.failure() ?? this.auth.error();
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await this.auth.login(this.username.trim(), this.password);
      this.password = '';
    } catch (e) {
      this.failure.set(describeError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
