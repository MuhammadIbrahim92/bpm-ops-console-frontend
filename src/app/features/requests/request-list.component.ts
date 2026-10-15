import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { ApiService, RequestQuery } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { Lookups, RequestRow } from '../../core/models';
import { requestLook } from '../../core/status';
import { downloadCsv } from '../../shared/csv';
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';
import { Field, recFields, showValue } from '../../shared/request-fields';
import { RetryButtonComponent } from '../../shared/retry-button.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, TableModule,
    TableToolsComponent, StatusBadgeComponent, RetryButtonComponent, DateTimePipe, AgePipe],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Request queue</div>
      <p class="text-muted-color mb-4">The engine's work queue. A stuck request can be put back in the queue; nothing else is changed.</p>

      <form class="grid grid-cols-12 gap-4 items-end" (ngSubmit)="search()">
        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
          <label for="text">Request id or command text</label>
          <input pInputText id="text" name="text" [(ngModel)]="f.text" placeholder="e.g. 5521 or INST_ID=10442" fluid />
        </div>
        <div class="col-span-6 md:col-span-4 flex flex-col gap-2">
          <label for="status">Status</label>
          <p-select inputId="status" name="status" [(ngModel)]="f.status" [options]="statusOptions()" optionLabel="label"
            optionValue="value" placeholder="Any" [showClear]="true" fluid />
        </div>
        <div class="col-span-6 md:col-span-4 flex flex-col gap-2">
          <label for="type">Type</label>
          <input pInputText id="type" name="type" [(ngModel)]="f.type" placeholder="any" fluid />
        </div>
        <div class="col-span-6 md:col-span-4 flex flex-col gap-2">
          <label for="from">From</label>
          <input pInputText id="from" name="from" type="date" [(ngModel)]="f.from" fluid />
        </div>
        <div class="col-span-6 md:col-span-4 flex flex-col gap-2">
          <label for="to">To</label>
          <input pInputText id="to" name="to" type="date" [(ngModel)]="f.to" fluid />
        </div>
        <div class="col-span-12 md:col-span-4 flex gap-2">
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
        [showCurrentPageReport]="true" currentPageReportTemplate="{first} to {last} of {totalRecords} requests"
        [sortField]="sortField() ?? undefined" [sortOrder]="sortOrder()" [resizableColumns]="true" columnResizeMode="expand"
        [stripedRows]="true" [rowHover]="true" [expandedRowKeys]="expanded()" [scrollable]="true"
        [tableStyle]="{ 'min-width': '70rem' }" (onPage)="onPage($event)" (onSort)="onSort($event)">
        <ng-template #header>
          <tr>
            <th style="width: 3rem"></th>
            @if (col('id')) { <th pSortableColumn="id" pResizableColumn>Request <p-sortIcon field="id" /></th> }
            @if (col('type')) { <th pSortableColumn="type" pResizableColumn>Type <p-sortIcon field="type" /></th> }
            @if (col('status')) { <th pSortableColumn="status" pResizableColumn>Status <p-sortIcon field="status" /></th> }
            @if (col('requestDate')) { <th pSortableColumn="requestDate" pResizableColumn>Requested <p-sortIcon field="requestDate" /></th> }
            @if (col('fetchDate')) { <th pSortableColumn="fetchDate" pResizableColumn>Fetched <p-sortIcon field="fetchDate" /></th> }
            @if (col('instanceId')) { <th pResizableColumn>Instance</th> }
            @if (col('notes')) { <th pResizableColumn>Notes</th> }
            <th></th>
          </tr>
        </ng-template>
        <ng-template #body let-r let-isOpen="expanded">
          <tr>
            <td>
              <p-button type="button" [text]="true" [rounded]="true" severity="secondary" size="small"
                [icon]="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-expanded]="isOpen" (onClick)="toggle(r.id)" />
            </td>
            @if (col('id')) { <td class="nowrap">{{ r.id }}</td> }
            @if (col('type')) { <td>{{ r.type }}</td> }
            @if (col('status')) { <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td> }
            @if (col('requestDate')) { <td class="nowrap">{{ r.requestDate | dateTime }}</td> }
            @if (col('fetchDate')) { <td class="nowrap">{{ r.fetchDate | age }}</td> }
            @if (col('instanceId')) { <td>@if (r.instanceId) { <a [routerLink]="['/instances', r.instanceId]">#{{ r.instanceId }}</a> }</td> }
            @if (col('notes')) { <td class="clip" [title]="r.rejectionReason || r.notes || ''">{{ r.rejectionReason || r.notes }}</td> }
            <td><app-retry-button [row]="r" [allowed]="auth.can('RETRY_REQUEST')" (retried)="replace($event)" /></td>
          </tr>
        </ng-template>
        <ng-template #expandedrow let-r>
          <tr>
            <td [attr.colspan]="visible().length + 2">
              <dl class="fields">
                @for (fld of fields(r); track fld[0]) {
                  <div><dt>{{ fld[0] }}</dt><dd>{{ show(fld[1]) }}</dd></div>
                }
              </dl>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td [attr.colspan]="visible().length + 2">No requests match.</td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [`
    .clip { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px 16px; margin: 0; }
    .fields dt { font-size: 11px; color: var(--muted); font-weight: 600; font-family: ui-monospace, monospace; }
    .fields dd { margin: 0; word-break: break-word; white-space: pre-wrap; }
  `]
})
export class RequestListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ToolColumn[] = [
    { field: 'id', header: 'Request' },
    { field: 'type', header: 'Type' },
    { field: 'status', header: 'Status' },
    { field: 'requestDate', header: 'Requested' },
    { field: 'fetchDate', header: 'Fetched' },
    { field: 'instanceId', header: 'Instance' },
    { field: 'notes', header: 'Notes' }
  ];
  readonly visible = signal<string[]>(this.columns.map(c => c.field));
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal(1);

  col(field: string): boolean {
    return this.visible().includes(field);
  }

  export(): void {
    downloadCsv('requests', [
      { field: 'id', header: 'REQUEST_ID' }, { field: 'type', header: 'REQUEST_TYPE' },
      { field: 'status', header: 'REQUEST_STATUS' }, { field: 'requestDate', header: 'REQUEST_DATE' },
      { field: 'fetchDate', header: 'FETCH_DATE' }, { field: 'finishDate', header: 'FINISH_DATE' },
      { field: 'engineId', header: 'ENGINE_ID' }, { field: 'executionTime', header: 'EXECUTION_TIME' },
      { field: 'instanceId', header: 'INSTANCE' }, { field: 'notes', header: 'NOTES' },
      { field: 'rejectionReason', header: 'REJECTION_REASON' }, { field: 'command', header: 'REQUEST_COMMAND' }
    ], this.items());
  }

  onSort(e: { field: string; order: number }): void {
    this.sortField.set(e.field);
    this.sortOrder.set(e.order);
    this.navigate(0, this.size());
  }

  readonly size = signal(50);
  readonly lookups = signal<Lookups | null>(null);
  readonly items = signal<RequestRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly expanded = signal<Record<string, boolean>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  f = { text: '', status: '', type: '', from: '', to: '' };
  look = requestLook;
  show = showValue;

  statusOptions(): { label: string; value: string }[] {
    return (this.lookups()?.requestStatuses ?? []).map(s => ({ label: s, value: s }));
  }

  fields(r: RequestRow): Field[] {
    return recFields(r);
  }

  ngOnInit(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
    this.route.queryParamMap.subscribe(q => {
      this.f = {
        text: q.get('text') ?? '',
        status: q.get('status') ?? '',
        type: q.get('type') ?? '',
        from: q.get('from') ?? '',
        to: q.get('to') ?? ''
      };
      this.page.set(q.get('page') ? Math.max(0, Number(q.get('page'))) : 0);
      const sz = Number(q.get('size'));
      this.size.set(sz >= 1 && sz <= 200 ? sz : 50);
      this.sortField.set(q.get('sort'));
      this.sortOrder.set(q.get('dir') === 'desc' ? -1 : 1);
      this.expanded.set({});
      this.load();
    });
  }

  toggle(id: number): void {
    this.expanded.update(cur => {
      const next = { ...cur };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }

  search(): void {
    this.navigate(0, this.size());
  }

  reset(): void {
    this.f = { text: '', status: '', type: '', from: '', to: '' };
    this.sortField.set(null);
    this.sortOrder.set(1);
    this.navigate(0, this.size());
  }

  onPage(e: TablePageEvent): void {
    this.navigate(Math.floor(e.first / e.rows), e.rows);
  }

  replace(updated: RequestRow): void {
    this.items.update(list => list.map(r => (r.id === updated.id ? updated : r)));
  }

  private navigate(page: number, size: number): void {
    const f = this.f;
    this.router.navigate([], {
      queryParams: {
        text: f.text || null, status: f.status || null, type: f.type || null,
        from: f.from || null, to: f.to || null, sort: this.sortField(),
        dir: this.sortField() && this.sortOrder() < 0 ? 'desc' : null,
        page: page > 0 ? page : null, size: size !== 50 ? size : null
      }
    });
  }

  private load(): void {
    const q: RequestQuery = {
      ...this.f, page: this.page(), size: this.size(),
      sort: this.sortField() ?? undefined, dir: this.sortOrder() < 0 ? 'desc' : 'asc'
    };
    this.loading.set(true);
    this.error.set(null);
    this.api.requests(q).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.total.set(0); this.loading.set(false); }
    });
  }
}
