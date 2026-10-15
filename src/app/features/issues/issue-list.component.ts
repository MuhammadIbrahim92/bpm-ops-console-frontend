import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ISSUE_INFO, ISSUE_ORDER, isIssueType } from '../../core/issue-info';
import { Issue, IssueType } from '../../core/models';
import { AgePipe, DateTimePipe } from '../../shared/pipes';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [RouterLink, AgePipe, DateTimePipe],
  template: `
    <div class="page">
      <h1>Issues</h1>
      <p class="sub">Problems found in the engine's own tables, oldest first. The longer something has waited, the higher it sits.</p>

      <div class="tabs" role="tablist">
        @for (t of types(); track t) {
          <button class="tab" role="tab" [attr.aria-selected]="t === type()" (click)="choose(t)">
            {{ info[t].title }}
            @if (counts()[t] !== undefined) { <span class="muted">({{ counts()[t] }})</span> }
          </button>
        }
      </div>

      <p class="muted">{{ info[type()].hint }}</p>
      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Severity</th><th>Instance</th><th>Process</th><th>Step</th><th>Since</th><th>Detail</th>@if (auth.can('VIEW_REQUESTS')) { <th>Request</th> }</tr></thead>
            <tbody>
              @for (i of items(); track $index) {
                <tr>
                  <td><span [class]="'sev-' + i.severity">{{ i.severity }}</span></td>
                  <td>@if (i.instanceId) { <a [routerLink]="['/instances', i.instanceId]">{{ i.instanceName || i.instanceId }}</a> <span class="muted">#{{ i.instanceId }}</span> }</td>
                  <td>{{ i.processName }}</td>
                  <td class="mono">{{ i.activityId }}</td>
                  <td class="nowrap" [title]="i.since | dateTime">{{ i.since | age }}</td>
                  <td>{{ i.detail }}</td>
                  @if (auth.can('VIEW_REQUESTS')) {
                    <td>@if (i.requestId) { <a [routerLink]="['/requests']" [queryParams]="{ text: i.requestId }">#{{ i.requestId }}</a> }</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (loading()) { <p class="empty" role="status">Loading&hellip;</p> }
        @else if (items().length === 0) { <p class="empty">Nothing found. All clear for this check.</p> }
      </div>
    </div>
  `
})
export class IssueListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly info = ISSUE_INFO;
  readonly types = signal<IssueType[]>(ISSUE_ORDER);
  readonly counts = signal<Record<string, number>>({});
  readonly type = signal<IssueType>('FAILED_ACTIVITY');
  readonly items = signal<Issue[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.issueSummary().subscribe({
      next: s => {
        this.counts.set(s);
        this.types.set(ISSUE_ORDER.filter(t => s[t] !== undefined));
      },
      error: e => this.error.set(describeError(e))
    });
    this.route.queryParamMap.subscribe(q => {
      const t = q.get('type');
      this.type.set(isIssueType(t) ? t : 'FAILED_ACTIVITY');
      this.load();
    });
  }

  choose(t: IssueType): void {
    this.router.navigate([], { queryParams: { type: t } });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.issues(this.type()).subscribe({
      next: list => { this.items.set(list); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.loading.set(false); }
    });
  }
}
