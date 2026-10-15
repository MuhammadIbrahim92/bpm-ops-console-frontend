import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';
import { RequestRow, TimerRequestRow } from '../core/models';
import { requestLook } from '../core/status';
import { downloadCsv } from './csv';
import { DateTimePipe } from './pipes';
import { Field, recFields, showValue, timerFields } from './request-fields';
import { RetryButtonComponent } from './retry-button.component';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * The engine request queue (REC_REQUESTS) and timer queue (TIMER_REQUESTS) rows for an instance or a step.
 * Both tables sort, filter per column, search, resize columns, export CSV and expand each row to every column.
 */
@Component({
  selector: 'app-request-tables',
  standalone: true,
  imports: [FormsModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, TableModule,
    DateTimePipe, RetryButtonComponent, StatusBadgeComponent],
  template: `
    <div class="font-semibold mt-4 mb-2">Engine requests &middot; REC_REQUESTS ({{ requests.length }})</div>
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <p-iconfield>
        <p-inputicon class="pi pi-search" />
        <input pInputText type="text" placeholder="Search engine requests" aria-label="Search engine requests"
          (input)="rec.filterGlobal($any($event.target).value, 'contains')" />
      </p-iconfield>
      <p-button type="button" icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" size="small" (onClick)="exportRec(rec)" />
      <p-button type="button" icon="pi pi-filter-slash" label="Clear" severity="secondary" [outlined]="true" size="small" (onClick)="rec.clear()" />
    </div>
    <p-table #rec [value]="requests" dataKey="id" size="small" [expandedRowKeys]="openRec()" [stripedRows]="true"
      [resizableColumns]="true" columnResizeMode="expand" [paginator]="requests.length > 25" [rows]="25"
      [globalFilterFields]="['id', 'type', 'status', 'notes', 'rejectionReason', 'command']"
      [tableStyle]="{ 'min-width': '50rem' }">
      <ng-template #header>
        <tr>
          <th style="width: 3rem"></th>
          <th pSortableColumn="id" pResizableColumn>Request <p-sortIcon field="id" /><p-columnFilter type="text" field="id" display="menu" /></th>
          <th pSortableColumn="type" pResizableColumn>Type <p-sortIcon field="type" /><p-columnFilter type="text" field="type" display="menu" /></th>
          <th pSortableColumn="status" pResizableColumn>Status <p-sortIcon field="status" /><p-columnFilter type="text" field="status" display="menu" /></th>
          <th pSortableColumn="requestDate" pResizableColumn>Requested <p-sortIcon field="requestDate" /></th>
          <th pSortableColumn="notes" pResizableColumn>Notes <p-sortIcon field="notes" /><p-columnFilter type="text" field="notes" display="menu" /></th>
          <th></th>
        </tr>
      </ng-template>
      <ng-template #body let-r let-isOpen="expanded">
        <tr>
          <td>
            <p-button type="button" [text]="true" [rounded]="true" severity="secondary" size="small"
              [icon]="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-expanded]="isOpen" (onClick)="toggle(openRec, r.id)" />
          </td>
          <td>{{ r.id }}</td>
          <td>{{ r.type }}</td>
          <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
          <td class="nowrap">{{ r.requestDate | dateTime }}</td>
          <td>{{ r.rejectionReason || r.notes }}</td>
          <td><app-retry-button [row]="r" [allowed]="allowRetry" (retried)="retried.emit($event)" /></td>
        </tr>
      </ng-template>
      <ng-template #expandedrow let-r>
        <tr><td colspan="7">
          <dl class="fields">
            @for (f of recFields(r); track f[0]) { <div><dt>{{ f[0] }}</dt><dd>{{ show(f[1]) }}</dd></div> }
          </dl>
        </td></tr>
      </ng-template>
      <ng-template #emptymessage><tr><td colspan="7">No engine requests.</td></tr></ng-template>
    </p-table>

    <div class="font-semibold mt-6 mb-2">Timer requests &middot; TIMER_REQUESTS ({{ timers.length }})</div>
    <div class="flex flex-wrap items-center gap-2 mb-2">
      <p-iconfield>
        <p-inputicon class="pi pi-search" />
        <input pInputText type="text" placeholder="Search timer requests" aria-label="Search timer requests"
          (input)="tim.filterGlobal($any($event.target).value, 'contains')" />
      </p-iconfield>
      <p-button type="button" icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" size="small" (onClick)="exportTimer(tim)" />
      <p-button type="button" icon="pi pi-filter-slash" label="Clear" severity="secondary" [outlined]="true" size="small" (onClick)="tim.clear()" />
    </div>
    <p-table #tim [value]="timers" dataKey="id" size="small" [expandedRowKeys]="openTimer()" [stripedRows]="true"
      [resizableColumns]="true" columnResizeMode="expand" [paginator]="timers.length > 25" [rows]="25"
      [globalFilterFields]="['id', 'type', 'status', 'activityId', 'exceptionName', 'notes', 'command']"
      [tableStyle]="{ 'min-width': '50rem' }">
      <ng-template #header>
        <tr>
          <th style="width: 3rem"></th>
          <th pSortableColumn="id" pResizableColumn>Request <p-sortIcon field="id" /><p-columnFilter type="text" field="id" display="menu" /></th>
          <th pSortableColumn="type" pResizableColumn>Type <p-sortIcon field="type" /><p-columnFilter type="text" field="type" display="menu" /></th>
          <th pSortableColumn="status" pResizableColumn>Status <p-sortIcon field="status" /><p-columnFilter type="text" field="status" display="menu" /></th>
          <th pSortableColumn="activityId" pResizableColumn>Step <p-sortIcon field="activityId" /><p-columnFilter type="text" field="activityId" display="menu" /></th>
          <th pSortableColumn="requestDate" pResizableColumn>Requested <p-sortIcon field="requestDate" /></th>
          <th pSortableColumn="endDate" pResizableColumn>Ends <p-sortIcon field="endDate" /></th>
          <th pSortableColumn="exceptionName" pResizableColumn>Notes <p-sortIcon field="exceptionName" /><p-columnFilter type="text" field="exceptionName" display="menu" /></th>
        </tr>
      </ng-template>
      <ng-template #body let-r let-isOpen="expanded">
        <tr>
          <td>
            <p-button type="button" [text]="true" [rounded]="true" severity="secondary" size="small"
              [icon]="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-expanded]="isOpen" (onClick)="toggle(openTimer, r.id)" />
          </td>
          <td>{{ r.id }}</td>
          <td>{{ r.type }} @if (r.reminder) { <span class="text-muted-color">(reminder)</span> }</td>
          <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
          <td><span class="mono">{{ r.activityId }}</span> @if (r.activityInstanceId) { <span class="text-muted-color">#{{ r.activityInstanceId }}</span> }</td>
          <td class="nowrap">{{ r.requestDate | dateTime }}</td>
          <td class="nowrap">{{ r.endDate | dateTime }}</td>
          <td>{{ r.exceptionName || r.notes }}</td>
        </tr>
      </ng-template>
      <ng-template #expandedrow let-r>
        <tr><td colspan="8">
          <dl class="fields">
            @for (f of timerFields(r); track f[0]) { <div><dt>{{ f[0] }}</dt><dd>{{ show(f[1]) }}</dd></div> }
          </dl>
        </td></tr>
      </ng-template>
      <ng-template #emptymessage><tr><td colspan="8">No timer requests.</td></tr></ng-template>
    </p-table>
  `,
  styles: [`
    .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px 16px; margin: 0; }
    .fields dt { font-size: 11px; color: var(--muted); font-weight: 600; font-family: ui-monospace, monospace; }
    .fields dd { margin: 0; word-break: break-word; white-space: pre-wrap; }
  `]
})
export class RequestTablesComponent {
  @Input() requests: RequestRow[] = [];
  @Input() timers: TimerRequestRow[] = [];
  @Input() allowRetry = false;
  @Output() retried = new EventEmitter<RequestRow>();

  readonly openRec = signal<Record<string, boolean>>({});
  readonly openTimer = signal<Record<string, boolean>>({});
  look = requestLook;
  show = showValue;

  toggle(state: ReturnType<typeof signal<Record<string, boolean>>>, id: number): void {
    state.update(cur => {
      const next = { ...cur };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }

  recFields(r: RequestRow): Field[] {
    return recFields(r);
  }

  timerFields(r: TimerRequestRow): Field[] {
    return timerFields(r);
  }

  exportRec(dt: Table): void {
    const rows = (dt.filteredValue ?? this.requests) as RequestRow[];
    downloadCsv('rec-requests', recFields(rows[0] ?? ({ id: 0 } as RequestRow)).map(f => ({ field: f[0], header: f[0] })),
      rows.map(r => Object.fromEntries(recFields(r).map(f => [f[0], f[1]]))));
  }

  exportTimer(dt: Table): void {
    const rows = (dt.filteredValue ?? this.timers) as TimerRequestRow[];
    downloadCsv('timer-requests', timerFields(rows[0] ?? ({ id: 0 } as TimerRequestRow)).map(f => ({ field: f[0], header: f[0] })),
      rows.map(r => Object.fromEntries(timerFields(r).map(f => [f[0], f[1]]))));
  }
}
