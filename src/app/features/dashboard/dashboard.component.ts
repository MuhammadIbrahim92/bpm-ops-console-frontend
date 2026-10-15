import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
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
  imports: [RouterLink, MessageModule, TableModule, AgePipe],
  template: `
    <div class="mb-4">
      <div class="font-semibold text-2xl">What needs attention</div>
      <p class="text-muted-color mt-1">
        @if (auth.operations()) { Every instance in the engine. } @else { Instances you are involved in. }
      </p>
    </div>

    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }

    @if (auth.can('VIEW_ISSUES')) {
      <div class="grid grid-cols-12 gap-4">
        @for (t of tiles(); track t.type) {
          <a class="col-span-12 md:col-span-6 xl:col-span-3 tile" [routerLink]="['/issues']" [queryParams]="{ type: t.type }">
            <div class="card mb-0 h-full">
              <div class="flex justify-between items-start">
                <div>
                  <span class="block text-muted-color font-medium mb-2">{{ t.title }}</span>
                  <div class="text-4xl font-semibold" [class.hot]="t.count > 0">{{ t.count }}</div>
                </div>
                <div class="flex items-center justify-center bg-surface-100 dark:bg-surface-800 rounded-border" style="width: 2.5rem; height: 2.5rem">
                  <i class="pi pi-exclamation-triangle" [class.hot]="t.count > 0"></i>
                </div>
              </div>
              <span class="text-muted-color text-sm block mt-3">{{ t.hint }}</span>
            </div>
          </a>
        }
      </div>

      <div class="card mt-4">
        <div class="font-semibold text-xl mb-4">Oldest failed steps</div>
        <p-table [value]="failures()" [loading]="loading()" [rowHover]="true" [stripedRows]="true"
          [resizableColumns]="true" columnResizeMode="expand" [tableStyle]="{ 'min-width': '40rem' }">
          <ng-template #header>
            <tr>
              <th pSortableColumn="instanceName" pResizableColumn>Instance <p-sortIcon field="instanceName" /><p-columnFilter type="text" field="instanceName" display="menu" /></th>
              <th pSortableColumn="processName" pResizableColumn>Process <p-sortIcon field="processName" /><p-columnFilter type="text" field="processName" display="menu" /></th>
              <th pSortableColumn="activityId" pResizableColumn>Step <p-sortIcon field="activityId" /><p-columnFilter type="text" field="activityId" display="menu" /></th>
              <th pSortableColumn="since" pResizableColumn>Since <p-sortIcon field="since" /></th>
              <th pSortableColumn="detail" pResizableColumn>What happened <p-sortIcon field="detail" /><p-columnFilter type="text" field="detail" display="menu" /></th>
            </tr>
          </ng-template>
          <ng-template #body let-i>
            <tr>
              <td>@if (i.instanceId) { <a [routerLink]="['/instances', i.instanceId]">{{ i.instanceName || i.instanceId }}</a> }</td>
              <td>{{ i.processName }}</td>
              <td class="mono">{{ i.activityId }}</td>
              <td class="nowrap">{{ i.since | age }}</td>
              <td>{{ i.detail }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="5">No failed steps. Nothing is waiting on you here.</td></tr>
          </ng-template>
        </p-table>
      </div>
    } @else {
      <p-message severity="info" text="Your account can open instances but has no permission to see issues." styleClass="mb-4" />
    }

    @if (auth.can('VIEW_INSTANCES')) {
      <p class="mt-4">
        <a routerLink="/instances">Browse all instances</a>
        &middot; <a routerLink="/instances" [queryParams]="{ olderThanHours: 24, includeTest: 'true' }">Open for more than a day</a>
        @if (longOpen() !== null) { <span class="text-muted-color">({{ longOpen() }})</span> }
      </p>
    }
  `,
  styles: [`
    .tile { color: inherit; text-decoration: none; }
    .tile:hover .card { border-color: var(--primary-color); }
    .hot { color: var(--c-failed); }
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
      this.api.instances({ olderThanHours: 24, size: 1, includeTest: true }).subscribe({
        next: page => this.longOpen.set(page.total),
        error: () => this.longOpen.set(null)
      });
    }
  }
}
