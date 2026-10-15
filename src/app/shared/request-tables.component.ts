import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RequestRow, TimerRequestRow } from '../core/models';
import { requestLook } from '../core/status';
import { DateTimePipe } from './pipes';
import { Field, recFields, showValue, timerFields } from './request-fields';
import { RetryButtonComponent } from './retry-button.component';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * The engine request queue (REC_REQUESTS) and timer queue (TIMER_REQUESTS) rows for an instance or a step.
 * Each row has a summary line and a Details button that lists every column of the table row.
 */
@Component({
  selector: 'app-request-tables',
  standalone: true,
  imports: [DateTimePipe, RetryButtonComponent, StatusBadgeComponent],
  template: `
    <h3>Engine requests - REC_REQUESTS ({{ requests.length }})</h3>
    @if (requests.length > 0) {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Requested</th><th>Notes</th><th></th><th></th></tr></thead>
          <tbody>
            @for (r of requests; track r.id) {
              <tr>
                <td>{{ r.id }}</td>
                <td>{{ r.type }}</td>
                <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
                <td class="nowrap">{{ r.requestDate | dateTime }}</td>
                <td>{{ r.rejectionReason || r.notes }}</td>
                <td><button type="button" class="btn small" (click)="toggle('R' + r.id)">{{ open() === 'R' + r.id ? 'Hide' : 'Details' }}</button></td>
                <td><app-retry-button [row]="r" [allowed]="allowRetry" (retried)="retried.emit($event)" /></td>
              </tr>
              @if (open() === 'R' + r.id) {
                <tr><td colspan="7">
                  <dl class="fields">
                    @for (f of recFields(r); track f[0]) {
                      <div><dt>{{ f[0] }}</dt><dd>{{ show(f[1]) }}</dd></div>
                    }
                  </dl>
                </td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">No engine requests.</p>
    }

    <h3>Timer requests - TIMER_REQUESTS ({{ timers.length }})</h3>
    @if (timers.length > 0) {
      <div class="table-wrap">
        <table>
          <thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Step</th><th>Requested</th><th>Ends</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            @for (r of timers; track r.id) {
              <tr>
                <td>{{ r.id }}</td>
                <td>{{ r.type }}</td>
                <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
                <td><span class="mono">{{ r.activityId }}</span> @if (r.activityInstanceId) { <span class="muted">#{{ r.activityInstanceId }}</span> }</td>
                <td class="nowrap">{{ r.requestDate | dateTime }}</td>
                <td class="nowrap">{{ r.endDate | dateTime }}</td>
                <td>{{ r.exceptionName || r.notes }}</td>
                <td><button type="button" class="btn small" (click)="toggle('T' + r.id)">{{ open() === 'T' + r.id ? 'Hide' : 'Details' }}</button></td>
              </tr>
              @if (open() === 'T' + r.id) {
                <tr><td colspan="8">
                  <dl class="fields">
                    @for (f of timerFields(r); track f[0]) {
                      <div><dt>{{ f[0] }}</dt><dd>{{ show(f[1]) }}</dd></div>
                    }
                  </dl>
                </td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="empty">No timer requests.</p>
    }
  `,
  styles: [`
    h3 { margin: 12px 0 6px; font-size: 14px; }
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

  readonly open = signal<string | null>(null);
  look = requestLook;

  toggle(key: string): void {
    this.open.update(k => (k === key ? null : key));
  }

  show = showValue;

  recFields(r: RequestRow): Field[] {
    return recFields(r);
  }

  timerFields(r: TimerRequestRow): Field[] {
    return timerFields(r);
  }
}
