import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ActivityStat, Lookups } from '../../core/models';
import { downloadCsv } from '../../shared/csv';
import { DurationPipe } from '../../shared/pipes';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';

@Component({
  selector: 'app-process-health',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, CheckboxModule, InputTextModule, MessageModule, ProgressBarModule, SelectModule, TableModule, TableToolsComponent, DurationPipe],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Process health</div>
      <p class="text-muted-color mb-4">Where a process loses time. Steps are ranked by how long they take on average, over the chosen period.</p>

      <form class="grid grid-cols-12 gap-4 items-end" (ngSubmit)="load()">
        <div class="col-span-12 md:col-span-5 flex flex-col gap-2">
          <label for="process">Process</label>
          <p-select inputId="process" name="process" [(ngModel)]="processId" [options]="lookups()?.processes ?? []"
            optionLabel="name" optionValue="id" placeholder="Choose a process" [filter]="true" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="version">Version (optional)</label>
          <input pInputText id="version" name="version" [(ngModel)]="version" placeholder="all versions" fluid />
        </div>
        <div class="col-span-6 md:col-span-2 flex flex-col gap-2">
          <label for="days">Period</label>
          <p-select inputId="days" name="days" [(ngModel)]="days" [options]="periods" optionLabel="label" optionValue="value" fluid />
        </div>
        <div class="col-span-12 md:col-span-3 flex items-center gap-2 pb-2">
          <p-checkbox inputId="test" name="test" [(ngModel)]="includeTest" [binary]="true" />
          <label for="test">Include test instances</label>
        </div>
        <div class="col-span-12 md:col-span-2">
          <p-button type="submit" label="Show" icon="pi pi-chart-bar" [disabled]="processId === null || loading()" />
          @if (auth.can('VIEW_DEFINITIONS') && processId !== null) {
            <a class="ml-3 text-primary" routerLink="/definitions" [queryParams]="definitionLink()">View definition</a>
          }
        </div>
      </form>
    </div>

    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }

    @if (loaded()) {
      <div class="card">
        <app-table-tools [columns]="columns" [visible]="visible()" (visibleChange)="visible.set($event)"
          (searchChange)="dt.filterGlobal($event, 'contains')" (exportCsv)="export(dt)" (clear)="clearAll(dt)" />
        <p-table #dt [value]="stats()" [loading]="loading()" [paginator]="stats().length > 25" [rows]="25" [rowHover]="true"
          [stripedRows]="true" [resizableColumns]="true" columnResizeMode="expand" [scrollable]="true"
          [rowsPerPageOptions]="[25, 50, 100]" [globalFilterFields]="['activityId']"
          [sortField]="'avgSeconds'" [sortOrder]="-1" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              @if (col('activityId')) { <th pSortableColumn="activityId" pResizableColumn>Step <p-sortIcon field="activityId" /><p-columnFilter type="text" field="activityId" display="menu" /></th> }
              @if (col('executions')) { <th pSortableColumn="executions" pResizableColumn class="text-right">Runs <p-sortIcon field="executions" /><p-columnFilter type="numeric" field="executions" display="menu" /></th> }
              @if (col('running')) { <th pSortableColumn="running" pResizableColumn class="text-right">Running now <p-sortIcon field="running" /><p-columnFilter type="numeric" field="running" display="menu" /></th> }
              @if (col('failed')) { <th pSortableColumn="failed" pResizableColumn class="text-right">Failed <p-sortIcon field="failed" /><p-columnFilter type="numeric" field="failed" display="menu" /></th> }
              @if (col('avgSeconds')) { <th pSortableColumn="avgSeconds" pResizableColumn>Average time <p-sortIcon field="avgSeconds" /><p-columnFilter type="numeric" field="avgSeconds" display="menu" /></th> }
              @if (col('maxSeconds')) { <th pSortableColumn="maxSeconds" pResizableColumn class="text-right">Slowest <p-sortIcon field="maxSeconds" /></th> }
              @if (col('longestRunningSeconds')) { <th pSortableColumn="longestRunningSeconds" pResizableColumn class="text-right">Longest wait now <p-sortIcon field="longestRunningSeconds" /></th> }
            </tr>
          </ng-template>
          <ng-template #body let-s>
            <tr>
              @if (col('activityId')) { <td class="mono">{{ s.activityId }}</td> }
              @if (col('executions')) { <td class="text-right">{{ s.executions }}</td> }
              @if (col('running')) { <td class="text-right">{{ s.running }}</td> }
              @if (col('failed')) { <td class="text-right">@if (s.failed > 0) { <strong class="bad">{{ s.failed }}</strong> } @else { 0 }</td> }
              @if (col('avgSeconds')) {
                <td style="min-width: 12rem">
                  <p-progressbar [value]="width(s.avgSeconds)" [showValue]="false" [style]="{ height: '8px' }" />
                  <span class="text-sm">{{ s.avgSeconds | duration }}</span>
                </td>
              }
              @if (col('maxSeconds')) { <td class="text-right">{{ s.maxSeconds | duration }}</td> }
              @if (col('longestRunningSeconds')) { <td class="text-right">{{ s.longestRunningSeconds | duration }}</td> }
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td [attr.colspan]="visible().length || 1">No activity was recorded for this process in the period.</td></tr>
          </ng-template>
        </p-table>
      </div>
    }
  `,
  styles: [`
    .bad { color: var(--c-failed); }
  `]
})
export class ProcessHealthComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly lookups = signal<Lookups | null>(null);
  readonly stats = signal<ActivityStat[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

  readonly periods = [
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 }
  ];

  readonly columns: ToolColumn[] = [
    { field: 'activityId', header: 'Step' },
    { field: 'executions', header: 'Runs' },
    { field: 'running', header: 'Running now' },
    { field: 'failed', header: 'Failed' },
    { field: 'avgSeconds', header: 'Average time' },
    { field: 'maxSeconds', header: 'Slowest' },
    { field: 'longestRunningSeconds', header: 'Longest wait now' }
  ];
  readonly visible = signal<string[]>(this.columns.map(c => c.field));

  col(field: string): boolean {
    return this.visible().includes(field);
  }

  clearAll(dt: Table): void {
    dt.clear();
    dt.reset();
  }

  export(dt: Table): void {
    const rows = (dt.filteredValue ?? this.stats()) as ActivityStat[];
    downloadCsv('process-health', [
      { field: 'activityId', header: 'Step' }, { field: 'executions', header: 'Runs' },
      { field: 'running', header: 'Running now' }, { field: 'failed', header: 'Failed' },
      { field: 'avgSeconds', header: 'Average seconds' }, { field: 'maxSeconds', header: 'Slowest seconds' },
      { field: 'longestRunningSeconds', header: 'Longest wait now (seconds)' }
    ], rows);
  }

  readonly auth = inject(AuthService);

  processId: number | null = null;
  version = '';
  days = 30;
  includeTest = false;

  private readonly maxAvg = computed(() => Math.max(1, ...this.stats().map(s => s.avgSeconds ?? 0)));

  ngOnInit(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: e => this.error.set(describeError(e)) });
  }

  /** Opens the process explorer on this process (and version, when one is typed in). */
  definitionLink(): Record<string, string | number> {
    const q: Record<string, string | number> = { source: 'repository', processId: this.processId! };
    if (this.version.trim()) {
      q['version'] = this.version.trim();
    }
    return q;
  }

  width(avg: number | undefined): number {
    return avg ? Math.max(2, Math.round((avg / this.maxAvg()) * 100)) : 0;
  }

  load(): void {
    if (this.processId === null) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.bottlenecks(this.processId, this.days, this.version.trim() || undefined, this.includeTest).subscribe({
      next: s => { this.stats.set(s); this.loaded.set(true); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.loading.set(false); }
    });
  }
}
