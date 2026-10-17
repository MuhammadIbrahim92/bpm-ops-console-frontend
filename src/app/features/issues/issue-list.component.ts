import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { Table, TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ISSUE_INFO, ISSUE_ORDER, isIssueType } from '../../core/issue-info';
import { BulkTarget, Issue, IssueType } from '../../core/models';
import { downloadCsv } from '../../shared/csv';
import { activityTypeLabel, engineActivityLook } from '../../core/status';
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { BulkRetryDialogComponent } from '../../shared/bulk-retry-dialog.component';
import { ButtonModule } from 'primeng/button';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';

@Component({
  selector: 'app-issue-list',
  standalone: true,
  imports: [RouterLink, MessageModule, TableModule, TabsModule, TagModule, ButtonModule, BulkRetryDialogComponent, TableToolsComponent, StatusBadgeComponent, AgePipe, DateTimePipe],
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

      <app-table-tools [columns]="columns" [visible]="visible()" (visibleChange)="visible.set($event)"
        (searchChange)="dt.filterGlobal($event, 'contains')" (exportCsv)="export(dt)" (clear)="clearAll(dt)" />

      @if (type() === 'FAILED_ACTIVITY' && !canBulkRetry()) {
        <p-message severity="info" styleClass="mb-3"
          text="Bulk retry of failed steps needs the retry permission (an operations role). Ask an administrator to grant it." />
      }
      @if (canBulkRetry()) {
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <p-button type="button" icon="pi pi-replay" [label]="'Retry latest request of selected (' + selected.length + ')'"
            [disabled]="selected.length === 0" (onClick)="retrySelected()" />
          <p-button type="button" icon="pi pi-file-excel" label="Import Excel / CSV" severity="secondary" [outlined]="true"
            [loading]="importing()" (onClick)="fileInput.click()" />
          <input #fileInput type="file" accept=".xlsx,.xlsm,.csv" class="hidden" (change)="onFile($event)" aria-label="Choose a sheet" />
          <p-button type="button" icon="pi pi-download" label="Template" severity="secondary" [text]="true" (onClick)="template()" />
          <span class="text-muted-color text-sm">Tick failed steps, or import a sheet with ACTIVITY_INSTANCE_ID and/or INSTANCE_ID. You review everything before anything is changed.</span>
        </div>
        @if (importError()) { <p-message severity="error" [text]="importError()!" styleClass="mb-3" /> }
      }

      <p-table #dt [value]="items()" dataKey="activityInstanceId" [(selection)]="selected" [loading]="loading()" [paginator]="items().length > 25" [rows]="25"
        [rowsPerPageOptions]="[25, 50, 100]" [rowHover]="true" [stripedRows]="true" [resizableColumns]="true"
        columnResizeMode="expand" [scrollable]="true" [sortField]="'since'" [sortOrder]="1"
        [globalFilterFields]="['severity', 'instanceName', 'instanceId', 'processName', 'activityId', 'activityName', 'activityType', 'activityStatus', 'detail']"
        [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #header>
          <tr>
            @if (canBulkRetry()) { <th style="width: 3rem"><p-tableHeaderCheckbox /></th> }
            @if (col('severity')) { <th pSortableColumn="severity" pResizableColumn>Severity <p-sortIcon field="severity" /><p-columnFilter type="text" field="severity" display="menu" /></th> }
            @if (col('instanceName')) { <th pSortableColumn="instanceName" pResizableColumn>Instance <p-sortIcon field="instanceName" /><p-columnFilter type="text" field="instanceName" display="menu" /></th> }
            @if (col('processName')) { <th pSortableColumn="processName" pResizableColumn>Process <p-sortIcon field="processName" /><p-columnFilter type="text" field="processName" display="menu" /></th> }
            @if (col('activityId')) { <th pSortableColumn="activityId" pResizableColumn>Step id <p-sortIcon field="activityId" /><p-columnFilter type="text" field="activityId" display="menu" /></th> }
            @if (col('activityName')) { <th pSortableColumn="activityName" pResizableColumn>Step name <p-sortIcon field="activityName" /><p-columnFilter type="text" field="activityName" display="menu" /></th> }
            @if (col('activityType')) { <th pSortableColumn="activityType" pResizableColumn>Step type <p-sortIcon field="activityType" /><p-columnFilter type="text" field="activityType" display="menu" /></th> }
            @if (col('activityStatus')) { <th pSortableColumn="activityStatus" pResizableColumn>Step status <p-sortIcon field="activityStatus" /><p-columnFilter type="text" field="activityStatus" display="menu" /></th> }
            @if (col('since')) { <th pSortableColumn="since" pResizableColumn>Since <p-sortIcon field="since" /></th> }
            @if (col('detail')) { <th pSortableColumn="detail" pResizableColumn>Detail <p-sortIcon field="detail" /><p-columnFilter type="text" field="detail" display="menu" /></th> }
            @if (col('requestId') && auth.can('VIEW_REQUESTS')) { <th pSortableColumn="requestId" pResizableColumn>Request <p-sortIcon field="requestId" /></th> }
          </tr>
        </ng-template>
        <ng-template #body let-i>
          <tr>
            @if (canBulkRetry()) { <td><p-tableCheckbox [value]="i" /></td> }
            @if (col('severity')) { <td><p-tag [value]="i.severity" [severity]="severity(i.severity)" /></td> }
            @if (col('instanceName')) { <td>@if (i.instanceId) { <a [routerLink]="['/instances', i.instanceId]">{{ i.instanceName || i.instanceId }}</a> <span class="text-muted-color">#{{ i.instanceId }}</span> }</td> }
            @if (col('processName')) { <td>{{ i.processName }}</td> }
            @if (col('activityId')) { <td class="mono">{{ i.activityId }}</td> }
            @if (col('activityName')) { <td>{{ i.activityName }}</td> }
            @if (col('activityType')) { <td>@if (i.activityType) { <p-tag [value]="typeLabel(i.activityType)" severity="secondary" /> }</td> }
            @if (col('activityStatus')) { <td>@if (i.activityStatus) { <app-status-badge [look]="statusLook(i.activityStatus)" [text]="i.activityStatus" /> }</td> }
            @if (col('since')) { <td class="nowrap" [title]="i.since | dateTime">{{ i.since | age }}</td> }
            @if (col('detail')) { <td>{{ i.detail }}</td> }
            @if (col('requestId') && auth.can('VIEW_REQUESTS')) {
              <td>@if (i.requestId) { <a [routerLink]="['/requests']" [queryParams]="{ text: i.requestId }">#{{ i.requestId }}</a> }</td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td [attr.colspan]="(visible().length || 1) + 1">Nothing found. All clear for this check.</td></tr>
        </ng-template>
      </p-table>
      <app-bulk-retry-dialog [targets]="bulkTargets()" [warnings]="importWarnings()" (closed)="closeBulk()" (changed)="afterRetry()" />
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
  selected: Issue[] = [];
  readonly bulkTargets = signal<BulkTarget[] | null>(null);
  readonly importWarnings = signal<string[]>([]);
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly columns: ToolColumn[] = [
    { field: 'severity', header: 'Severity' },
    { field: 'instanceName', header: 'Instance' },
    { field: 'processName', header: 'Process' },
    { field: 'activityId', header: 'Step id' },
    { field: 'activityName', header: 'Step name' },
    { field: 'activityType', header: 'Step type' },
    { field: 'activityStatus', header: 'Step status' },
    { field: 'since', header: 'Since' },
    { field: 'detail', header: 'Detail' },
    { field: 'requestId', header: 'Request' }
  ];
  readonly visible = signal<string[]>(this.columns.map(c => c.field));

  /** Bulk retry is offered on the failed-steps tab, to people who may retry requests. */
  canBulkRetry(): boolean {
    return this.type() === 'FAILED_ACTIVITY' && this.auth.can('RETRY_REQUEST');
  }

  retrySelected(): void {
    const targets = this.selected
      .filter(i => i.activityInstanceId != null)
      .map(i => ({ activityInstanceId: i.activityInstanceId }));
    if (targets.length > 0) {
      this.importWarnings.set([]);
      this.bulkTargets.set(targets);
    }
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.importError.set(null);
    this.importing.set(true);
    this.api.bulkImport(file).subscribe({
      next: r => {
        this.importWarnings.set(r.warnings);
        this.bulkTargets.set(r.targets);
        this.importing.set(false);
      },
      error: e => { this.importError.set(describeError(e)); this.importing.set(false); }
    });
  }

  template(): void {
    downloadCsv('bulk-retry-template', [
      { field: 'ACTIVITY_INSTANCE_ID', header: 'ACTIVITY_INSTANCE_ID' },
      { field: 'INSTANCE_ID', header: 'INSTANCE_ID' }
    ], []);
  }

  closeBulk(): void {
    this.bulkTargets.set(null);
    this.importWarnings.set([]);
  }

  /** Something was re-queued: reload the list and the counts, and drop the ticks. */
  afterRetry(): void {
    this.selected = [];
    this.load();
    this.api.issueSummary().subscribe({ next: s => this.counts.set(s), error: () => undefined });
  }

  col(field: string): boolean {
    return this.visible().includes(field);
  }

  typeLabel = activityTypeLabel;
  statusLook = engineActivityLook;

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
      this.selected = [];
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

  clearAll(dt: Table): void {
    dt.clear();
    dt.reset();
  }

  /** Exports the rows that pass the current filters, in the current order. */
  export(dt: Table): void {
    const rows = (dt.filteredValue ?? this.items()) as Issue[];
    downloadCsv(`issues-${this.type().toLowerCase()}`, [
      { field: 'severity', header: 'Severity' }, { field: 'instanceId', header: 'Instance id' },
      { field: 'instanceName', header: 'Instance' }, { field: 'processName', header: 'Process' },
      { field: 'activityId', header: 'Step id' }, { field: 'activityName', header: 'Step name' },
      { field: 'activityType', header: 'Step type' }, { field: 'activityStatus', header: 'Step status' },
      { field: 'since', header: 'Since' },
      { field: 'detail', header: 'Detail' }, { field: 'requestId', header: 'Request' }
    ], rows);
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
