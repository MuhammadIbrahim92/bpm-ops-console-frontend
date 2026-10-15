import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { RequestRow, TimerRequestRow } from '../core/models';
import { requestLook } from '../core/status';
import { DateTimePipe } from './pipes';
import { Field, recFields, showValue, timerFields } from './request-fields';
import { RetryButtonComponent } from './retry-button.component';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * The engine request queue (REC_REQUESTS) and timer queue (TIMER_REQUESTS) rows for an instance or a step.
 * Each row expands to every column of the table row.
 */
@Component({
  selector: 'app-request-tables',
  standalone: true,
  imports: [ButtonModule, TableModule, DateTimePipe, RetryButtonComponent, StatusBadgeComponent],
  template: `
    <div class="font-semibold mt-4 mb-2">Engine requests &middot; REC_REQUESTS ({{ requests.length }})</div>
    <p-table [value]="requests" dataKey="id" size="small" [expandedRowKeys]="openRec()" [tableStyle]="{ 'min-width': '50rem' }">
      <ng-template #header>
        <tr><th style="width: 3rem"></th><th>Request</th><th>Type</th><th>Status</th><th>Requested</th><th>Notes</th><th></th></tr>
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
    <p-table [value]="timers" dataKey="id" size="small" [expandedRowKeys]="openTimer()" [tableStyle]="{ 'min-width': '50rem' }">
      <ng-template #header>
        <tr><th style="width: 3rem"></th><th>Request</th><th>Type</th><th>Status</th><th>Step</th><th>Requested</th><th>Ends</th><th>Notes</th></tr>
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
}
