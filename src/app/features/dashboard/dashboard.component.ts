import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ISSUE_INFO, ISSUE_ORDER } from '../../core/issue-info';
import { Issue, IssueType } from '../../core/models';
import { AgePipe } from '../../shared/pipes';

interface Tile {
  type: IssueType;
  title: string;
  hint: string;
  count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, AgePipe],
  template: `
    <div class="page">
      <h1>What needs attention</h1>
      <p class="sub">
        @if (auth.operations()) { Every instance in the engine. } @else { Instances you are involved in. }
      </p>

      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      @if (auth.can('VIEW_ISSUES')) {
        <div class="tiles">
          @for (t of tiles(); track t.type) {
            <a class="tile card" [class.hot]="t.count > 0" [routerLink]="['/issues']" [queryParams]="{ type: t.type }">
              <span class="count">{{ t.count }}</span>
              <span class="title">{{ t.title }}</span>
              <span class="hint">{{ t.hint }}</span>
            </a>
          }
        </div>

        <section class="card">
          <h2>Oldest failed steps</h2>
          @if (failures().length === 0 && !loading()) {
            <p class="empty">No failed steps. Nothing is waiting on you here.</p>
          } @else {
            <div class="table-wrap">
              <table>
                <thead><tr><th>Instance</th><th>Process</th><th>Step</th><th>Since</th><th>What happened</th></tr></thead>
                <tbody>
                  @for (i of failures(); track $index) {
                    <tr>
                      <td>@if (i.instanceId) { <a [routerLink]="['/instances', i.instanceId]">{{ i.instanceName || i.instanceId }}</a> }</td>
                      <td>{{ i.processName }}</td>
                      <td class="mono">{{ i.activityId }}</td>
                      <td class="nowrap">{{ i.since | age }}</td>
                      <td>{{ i.detail }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      } @else {
        <p class="note">Your account can open instances but has no permission to see issues.</p>
      }

      @if (auth.can('VIEW_INSTANCES')) {
        <p><a routerLink="/instances">Browse all instances</a>
          &middot; <a routerLink="/instances" [queryParams]="{ olderThanHours: 24 }">Open for more than a day</a>
          @if (longOpen() !== null) { <span class="muted">({{ longOpen() }})</span> }
        </p>
      }
    </div>
  `,
  styles: [`
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .tile { display: flex; flex-direction: column; gap: 2px; color: var(--text); }
    .tile:hover { text-decoration: none; border-color: var(--accent); }
    .count { font-size: 30px; font-weight: 700; line-height: 1.1; }
    .tile.hot .count { color: var(--c-failed); }
    .title { font-weight: 600; }
    .hint { color: var(--muted); font-size: 12.5px; }
  `]
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  readonly tiles = signal<Tile[]>([]);
  readonly failures = signal<Issue[]>([]);
  readonly longOpen = signal<number | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.auth.can('VIEW_ISSUES')) {
      this.api.issueSummary().subscribe({
        next: summary => {
          this.tiles.set(
            ISSUE_ORDER.filter(t => summary[t] !== undefined).map(t => ({
              type: t, title: ISSUE_INFO[t].title, hint: ISSUE_INFO[t].hint, count: summary[t]
            }))
          );
        },
        error: e => this.error.set(describeError(e))
      });
      this.api.issues('FAILED_ACTIVITY', 8).subscribe({
        next: list => { this.failures.set(list); this.loading.set(false); },
        error: e => { this.error.set(describeError(e)); this.loading.set(false); }
      });
    } else {
      this.loading.set(false);
    }
    if (this.auth.can('VIEW_INSTANCES')) {
      this.api.instances({ olderThanHours: 24, size: 1 }).subscribe({
        next: page => this.longOpen.set(page.total),
        error: () => this.longOpen.set(null)
      });
    }
  }
}
