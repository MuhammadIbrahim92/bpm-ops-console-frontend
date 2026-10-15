import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="top">
      <div class="top-inner">
        <a class="brand" routerLink="/">BPM Operations Console</a>
        @if (auth.me(); as me) {
          <nav aria-label="Main">
            <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
            @if (auth.can('VIEW_INSTANCES')) {
              <a routerLink="/instances" routerLinkActive="on">Instances</a>
            }
            @if (auth.can('VIEW_ISSUES')) {
              <a routerLink="/issues" routerLinkActive="on">Issues</a>
              <a routerLink="/processes" routerLinkActive="on">Process health</a>
            }
            @if (auth.can('VIEW_REQUESTS')) {
              <a routerLink="/requests" routerLinkActive="on">Request queue</a>
            }
          </nav>
          <span class="spacer"></span>
          <span class="who" [title]="me.roles.join(', ')">
            {{ me.displayName }}
            @if (me.operations) {
              <span class="ops">Operations</span>
            }
          </span>
        }
      </div>
    </header>
    <main>
      @if (auth.me()) {
        <router-outlet />
      } @else {
        <div class="page">
          <div class="card" role="alert">
            <h1>You can't use the console yet</h1>
            <p>{{ auth.error() ?? 'Loading…' }}</p>
            <p class="muted">If you expected access, ask the platform team to give your account a console role.</p>
          </div>
        </div>
      }
    </main>
  `,
  styles: [`
    .top { background: var(--surface); border-bottom: 1px solid var(--border); }
    .top-inner { max-width: 1280px; margin: 0 auto; padding: 0 16px; display: flex; align-items: center; gap: 20px; min-height: 52px; flex-wrap: wrap; }
    .brand { font-weight: 700; color: var(--text); }
    nav { display: flex; gap: 4px; flex-wrap: wrap; }
    nav a { color: var(--muted); padding: 14px 10px; border-bottom: 2px solid transparent; font-weight: 600; }
    nav a:hover { color: var(--text); text-decoration: none; }
    nav a.on { color: var(--text); border-bottom-color: var(--accent); }
    .spacer { flex: 1 1 auto; }
    .who { color: var(--muted); }
    .ops { margin-left: 6px; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: var(--accent); color: var(--accent-contrast); }
  `]
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
