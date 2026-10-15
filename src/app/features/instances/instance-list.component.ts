import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { ApiService, InstanceQuery } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { InstanceSummary, Lookups } from '../../core/models';
import { instanceLook } from '../../core/status';
import { downloadCsv } from '../../shared/csv';
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';

@Component({
  selector: 'app-instance-list',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, CheckboxModule, InputTextModule, MessageModule, SelectModule,
    TableModule, StatusBadgeComponent, TableToolsComponent, DateTimePipe, AgePipe],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Instances</div>
      <p class="text-muted-color mb-4">Search running and finished process instances. Open one to see where it is on the diagram.</p>

      <form class="grid grid-cols-12 gap-4 items-end" (ngSubmit)="search()">
        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
          <label for="text">Instance id or name</label>
          <input pInputText id="text" name="text" [(ngModel)]="f.text" placeholder="e.g. 10442 or Survey" fluid />
        </div>
        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
          <label for="status">Status</label>
          <p-select inputId="status" name="status" [(ngModel)]="f.status" [options]="statusOptions()" optionLabel="label"
            optionValue="value" placeholder="Any" [showClear]="true" fluid />
        </div>
        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
          <label for="processId">Process</label>
          <p-select inputId="processId" name="processId" [(ngModel)]="f.processId" [options]="lookups()?.processes ?? []"
            optionLabel="name" optionValue="id" placeholder="All processes" [showClear]="true" [filter]="true" fluid />
        </div>
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="createdBy">Created by</label>
          <input pInputText id="createdBy" name="createdBy" [(ngModel)]="f.createdBy" placeholder="login" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="from">Created from</label>
          <input pInputText id="from" name="from" type="date" [(ngModel)]="f.from" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="to">Created to</label>
          <input pInputText id="to" name="to" type="date" [(ngModel)]="f.to" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="older">Open longer than (hours)</label>
          <input pInputText id="older" name="older" type="number" min="1" [(ngModel)]="f.olderThanHours" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex items-center gap-2 pb-2">
          <p-checkbox inputId="test" name="test" [(ngModel)]="f.includeTest" [binary]="true" />
          <label for="test">Include test instances</label>
        </div>
        <div class="col-span-12 flex gap-2">
          <p-button type="submit" label="Search" icon="pi pi-search" />
          <p-button type="button" label="Clear" severity="secondary" [outlined]="true" (onClick)="reset()" />
        </div>
      </form>
    </div>

    <div class="card">
      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }
      <app-table-tools [columns]="columns" [visible]="visible()" (visibleChange)="visible.set($event)" [search]="false"
        note="Click a column title to sort the whole result. Export covers this page." (exportCsv)="export()" (clear)="reset()" />
      <p-table [value]="items()" dataKey="id" [lazy]="true" [loading]="loading()" [paginator]="true" [rows]="size()"
        [first]="page() * size()" [totalRecords]="total()" [rowsPerPageOptions]="[25, 50, 100, 200]"
        [showCurrentPageReport]="true" currentPageReportTemplate="{first} to {last} of {totalRecords} instances"
        [sortField]="sortField() ?? undefined" [sortOrder]="sortOrder()" [resizableColumns]="true" columnResizeMode="expand"
        [stripedRows]="true" [rowHover]="true" [scrollable]="true" [tableStyle]="{ 'min-width': '60rem' }"
        (onPage)="onPage($event)" (onSort)="onSort($event)">
        <ng-template #header>
          <tr>
            @if (show('id')) { <th pSortableColumn="id" pResizableColumn>Id <p-sortIcon field="id" /></th> }
            @if (show('name')) { <th pSortableColumn="name" pResizableColumn>Name <p-sortIcon field="name" /></th> }
            @if (show('processName')) { <th pSortableColumn="process" pResizableColumn>Process <p-sortIcon field="process" /></th> }
            @if (show('status')) { <th pSortableColumn="status" pResizableColumn>Status <p-sortIcon field="status" /></th> }
            @if (show('runningActivities')) { <th class="text-right" pResizableColumn>Running</th> }
            @if (show('failedActivities')) { <th class="text-right" pResizableColumn>Failed</th> }
            @if (show('created')) { <th pSortableColumn="created" pResizableColumn>Created <p-sortIcon field="created" /></th> }
            @if (show('finished')) { <th pSortableColumn="finished" pResizableColumn>Finished <p-sortIcon field="finished" /></th> }
            @if (show('openFor')) { <th pResizableColumn>Open for</th> }
            @if (show('createdBy')) { <th pSortableColumn="createdBy" pResizableColumn>By <p-sortIcon field="createdBy" /></th> }
          </tr>
        </ng-template>
        <ng-template #body let-i>
          <tr>
            @if (show('id')) { <td class="nowrap"><a [routerLink]="['/instances', i.id]">{{ i.id }}</a></td> }
            @if (show('name')) { <td>{{ i.name }} @if (i.test) { <span class="text-muted-color">(test)</span> }</td> }
            @if (show('processName')) { <td>{{ i.processName }} <span class="text-muted-color">v{{ i.version }}</span></td> }
            @if (show('status')) { <td><app-status-badge [look]="look(i.status)" [text]="i.status" /></td> }
            @if (show('runningActivities')) { <td class="text-right">{{ i.runningActivities }}</td> }
            @if (show('failedActivities')) { <td class="text-right">@if (i.failedActivities > 0) { <strong class="bad">{{ i.failedActivities }}</strong> } @else { 0 }</td> }
            @if (show('created')) { <td class="nowrap">{{ i.created | dateTime }}</td> }
            @if (show('finished')) { <td class="nowrap">{{ i.finished | dateTime }}</td> }
            @if (show('openFor')) { <td class="nowrap">@if (!i.finished) { {{ i.created | age }} } @else { <span class="text-muted-color">finished</span> }</td> }
            @if (show('createdBy')) { <td>{{ i.createdBy }}</td> }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td [attr.colspan]="visible().length || 1">No instances match.</td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    .bad { color: var(--c-failed); }
  `]
})
export class InstanceListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ToolColumn[] = [
    { field: 'id', header: 'Id' },
    { field: 'name', header: 'Name' },
    { field: 'processName', header: 'Process' },
    { field: 'status', header: 'Status' },
    { field: 'runningActivities', header: 'Running' },
    { field: 'failedActivities', header: 'Failed' },
    { field: 'created', header: 'Created' },
    { field: 'finished', header: 'Finished' },
    { field: 'openFor', header: 'Open for' },
    { field: 'createdBy', header: 'By' }
  ];
  readonly visible = signal<string[]>(
    this.columns.map(c => c.field).filter(f => f !== 'finished')
  );

  readonly size = signal(50);
  readonly lookups = signal<Lookups | null>(null);
  readonly items = signal<InstanceSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  f = this.blank();

  look = instanceLook;

  show(field: string): boolean {
    return this.visible().includes(field);
  }

  statusOptions(): { label: string; value: string }[] {
    return (this.lookups()?.instanceStatuses ?? []).map(s => ({ label: s, value: s }));
  }

  ngOnInit(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
    this.route.queryParamMap.subscribe(q => {
      this.f = {
        text: q.get('text') ?? '',
        status: q.get('status') ?? '',
        processId: q.get('processId') ? Number(q.get('processId')) : null,
        createdBy: q.get('createdBy') ?? '',
        from: q.get('from') ?? '',
        to: q.get('to') ?? '',
        olderThanHours: q.get('olderThanHours') ? Number(q.get('olderThanHours')) : null,
        includeTest: q.get('includeTest') === 'true'
      };
      this.page.set(q.get('page') ? Math.max(0, Number(q.get('page'))) : 0);
      const sz = Number(q.get('size'));
      this.size.set(sz >= 1 && sz <= 200 ? sz : 50);
      this.sortField.set(q.get('sort'));
      this.sortOrder.set(q.get('dir') === 'desc' ? -1 : 1);
      this.load();
    });
  }

  search(): void {
    this.navigate(0, this.size());
  }

  reset(): void {
    this.f = this.blank();
    this.sortField.set(null);
    this.sortOrder.set(1);
    this.navigate(0, this.size());
  }

  onPage(e: TablePageEvent): void {
    this.navigate(Math.floor(e.first / e.rows), e.rows);
  }

  onSort(e: { field: string; order: number }): void {
    this.sortField.set(e.field);
    this.sortOrder.set(e.order);
    this.navigate(0, this.size());
  }

  export(): void {
    downloadCsv('instances', [
      { field: 'id', header: 'Id' }, { field: 'name', header: 'Name' }, { field: 'processName', header: 'Process' },
      { field: 'version', header: 'Version' }, { field: 'status', header: 'Status' },
      { field: 'runningActivities', header: 'Running steps' }, { field: 'failedActivities', header: 'Failed steps' },
      { field: 'created', header: 'Created' }, { field: 'finished', header: 'Finished' },
      { field: 'createdBy', header: 'Created by' }, { field: 'test', header: 'Test' }
    ], this.items());
  }

  private navigate(page: number, size: number): void {
    const f = this.f;
    this.router.navigate([], {
      queryParams: {
        text: f.text || null,
        status: f.status || null,
        processId: f.processId,
        createdBy: f.createdBy || null,
        from: f.from || null,
        to: f.to || null,
        olderThanHours: f.olderThanHours,
        includeTest: f.includeTest ? 'true' : null,
        sort: this.sortField(),
        dir: this.sortField() && this.sortOrder() < 0 ? 'desc' : null,
        page: page > 0 ? page : null,
        size: size !== 50 ? size : null
      }
    });
  }

  private load(): void {
    const f = this.f;
    const q: InstanceQuery = {
      text: f.text, status: f.status, processId: f.processId, createdBy: f.createdBy, from: f.from, to: f.to,
      olderThanHours: f.olderThanHours, includeTest: f.includeTest, page: this.page(), size: this.size(),
      sort: this.sortField() ?? undefined, dir: this.sortOrder() < 0 ? 'desc' : 'asc'
    };
    this.loading.set(true);
    this.error.set(null);
    this.api.instances(q).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.total.set(0); this.loading.set(false); }
    });
  }

  private blank() {
    return {
      text: '', status: '', processId: null as number | null, createdBy: '', from: '', to: '',
      olderThanHours: null as number | null, includeTest: false
    };
  }
}
