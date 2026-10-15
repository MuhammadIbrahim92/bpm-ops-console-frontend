import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ISSUE_INFO, ISSUE_ORDER, isIssueType } from '../../core/issue-info';
import { Issue, IssueType } from '../../core/models';
import { AgePipe, DateTimePipe } from '../../shared/pipes';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [RouterLink, MessageModule, TableModule, TabsModule, TagModule, AgePipe, DateTimePipe],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Issues</div>
      <p class="text-muted-color mb-4">Problems found in the engine's own tables, oldest first. The longer something has waited, the higher it sits.</p>

      <p-tabs [value]="type()" (valueChange)="choose($any($event))" [scrollable]="true">
        <p-tablist>
          @for (t of types(); track t) {
            <p-tab [value]="t">
              {{ info[t].title }}
              @if (counts()[t] !== undefined) { <span class="ml-2 text-muted-color">({{ counts()[t] }})</span> }
            </p-tab>
          }
        </p-tablist>
      </p-tabs>

      <p class="text-muted-color my-4">{{ info[type()].hint }}</p>
      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }

      <p-table [value]="items()" [loading]="loading()" [paginator]="items().length > 25" [rows]="25"
        [rowsPerPageOptions]="[25, 50, 100]" [rowHover]="true" [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #header>
          <tr>
            <th>Severity</th><th>Instance</th><th>Process</th><th>Step</th><th>Since</th><th>Detail</th>
            @if (auth.can('VIEW_REQUESTS')) { <th>Request</th> }
          </tr>
        </ng-template>
        <ng-template #body let-i>
          <tr>
            <td><p-tag [value]="i.severity" [severity]="severity(i.severity)" /></td>
            <td>@if (i.instanceId) { <a [routerLink]="['/instances', i.instanceId]">{{ i.instanceName || i.instanceId }}</a> <span class="text-muted-color">#{{ i.instanceId }}</span> }</td>
            <td>{{ i.processName }}</td>
            <td class="mono">{{ i.activityId }}</td>
            <td class="nowrap" [title]="i.since | dateTime">{{ i.since | age }}</td>
            <td>{{ i.detail }}</td>
            @if (auth.can('VIEW_REQUESTS')) {
              <td>@if (i.requestId) { <a [routerLink]="['/requests']" [queryParams]="{ text: i.requestId }">#{{ i.requestId }}</a> }</td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td [attr.colspan]="auth.can('VIEW_REQUESTS') ? 7 : 6">Nothing found. All clear for this check.</td></tr>
        </ng-template>
      </p-table>
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

  choose(t: string | number | undefined): void {
    if (isIssueType(String(t))) {
      this.router.navigate([], { queryParams: { type: t } });
    }
  }

  severity(s: string | undefined): 'danger' | 'warn' | 'info' | 'secondary' {
    switch ((s ?? '').toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return 'danger';
      case 'MEDIUM':
        return 'warn';
      case 'LOW':
        return 'info';
      default:
        return 'secondary';
    }
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
