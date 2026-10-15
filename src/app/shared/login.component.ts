import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../core/auth.service';
import { describeError } from '../core/errors';
import { AppFloatingConfigurator } from '../layout/component/app.floatingconfigurator';

/** Sign-in page in the Sakai style. The password is the one configured in the backend. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, MessageModule, AppFloatingConfigurator],
  template: `
    <app-floating-configurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-screen overflow-hidden">
      <div class="flex flex-col items-center justify-center">
        <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
          <form class="w-full bg-surface-0 dark:bg-surface-900 py-16 px-8 sm:px-16" style="border-radius: 53px" (ngSubmit)="submit()">
            <div class="text-center mb-8">
              <i class="pi pi-sitemap mb-4" style="font-size: 3rem; color: var(--primary-color)"></i>
              <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-2">BPM Operations Console</div>
              <span class="text-muted-color font-medium">Sign in to continue</span>
            </div>

            @if (message(); as m) {
              <p-message severity="error" styleClass="mb-4" [text]="m" />
            }

            <label for="username" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">User name</label>
            <input pInputText id="username" name="username" type="text" placeholder="User name" class="w-full md:w-120 mb-6"
              autocomplete="username" [(ngModel)]="username" required />

            <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
            <p-password inputId="password" name="password" [(ngModel)]="password" placeholder="Password" [toggleMask]="true"
              styleClass="mb-8" [fluid]="true" [feedback]="false" autocomplete="current-password" />

            <p-button type="submit" [label]="busy() ? 'Signing in…' : 'Sign in'" styleClass="w-full"
              [disabled]="busy() || !username || !password" />
          </form>
        </div>
      </div>
    </div>
  `
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
