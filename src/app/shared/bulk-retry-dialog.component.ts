import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/errors';
import { BulkResult, BulkRow, BulkTarget } from '../core/models';
import { downloadCsv } from './csv';

/**
 * Bulk retry of failed activities: shows what would happen for each instance (nothing is changed), asks for one
 * confirmation, then re-queues the latest engine request of every instance that passes the safety rules.
 */
@Component({
  selector: 'app-bulk-retry-dialog',
  standalone: true,
  imports: [RouterLink, ButtonModule, DialogModule, MessageModule, TableModule, TagModule],
  template: `
    <p-dialog [visible]="targets !== null" (visibleChange)="$event ? null : close()" [modal]="true" [draggable]="false"
      [closable]="!busy()" [dismissableMask]="false" header="Retry failed activities in bulk"
      [style]="{ width: '75rem', 'max-width': '96vw' }">
      @if (warnings.length > 0) {
        <p-message severity="warn" styleClass="mb-3" [text]="warnings.length + ' row(s) of the sheet were ignored: ' + warnings.slice(0, 3).join(' ') + (warnings.length > 3 ? ' ...' : '')" />
      }
      @if (error()) {
        <p-message severity="error" [text]="error()!" styleClass="mb-3" />
      }
      @if (loading()) {
        <p class="text-muted-color">Checking {{ targets?.length }} item(s) against the engine…</p>
      }

      @if (result(); as r) {
        <div class="flex flex-wrap items-center gap-2 mb-3">
          @if (done()) {
            <p-tag [value]="r.retried + ' retried'" severity="success" />
            @if (r.failed > 0) { <p-tag [value]="r.failed + ' failed'" severity="danger" /> }
            <p-tag [value]="r.skipped + ' skipped'" severity="secondary" />
          } @else {
            <p-tag [value]="r.ready + ' will be retried'" severity="success" />
            <p-tag [value]="r.skipped + ' skipped'" severity="secondary" />
          }
          <span class="text-muted-color text-sm">One request per process instance: the newest request of the instance is put back in the queue.</span>
        </div>

        <p-table [value]="r.rows" size="small" [paginator]="r.rows.length > 25" [rows]="25" [stripedRows]="true"
          [scrollable]="true" scrollHeight="45vh" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              <th pSortableColumn="instanceId">Instance <p-sortIcon field="instanceId" /></th>
              <th>Failed activities</th>
              <th pSortableColumn="requestId">Request <p-sortIcon field="requestId" /></th>
              <th pSortableColumn="requestStatus">Request status <p-sortIcon field="requestStatus" /></th>
              <th pSortableColumn="outcome">{{ done() ? 'Result' : 'Outcome' }} <p-sortIcon field="outcome" /></th>
              <th>Reason</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>@if (row.instanceId) { <a [routerLink]="['/instances', row.instanceId]" target="_blank">#{{ row.instanceId }}</a> }</td>
              <td>{{ row.activities }} @if (!row.activities && row.activityInstanceIds.length) { <span class="mono text-muted-color">#{{ row.activityInstanceIds.join(', #') }}</span> }</td>
              <td>@if (row.requestId) { {{ row.requestId }} <span class="text-muted-color">{{ row.requestType }}</span> }</td>
              <td>{{ row.requestStatus }}</td>
              <td><p-tag [value]="label(row)" [severity]="severity(row)" /></td>
              <td>{{ row.reason }}</td>
            </tr>
          </ng-template>
        </p-table>
      }

      <ng-template #footer>
        @if (result(); as r) {
          <p-button type="button" label="Export CSV" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="export(r.rows)" />
        }
        @if (!done()) {
          @if (confirming()) {
            <span class="mr-2">Re-queue {{ result()?.ready }} request(s)? The engine will run them again.</span>
            <p-button type="button" label="Yes, retry" icon="pi pi-check" severity="danger" [loading]="busy()" (onClick)="run()" />
            <p-button type="button" label="Back" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="confirming.set(false)" />
          } @else {
            <p-button type="button" [label]="'Retry ' + (result()?.ready ?? 0) + ' request(s)'" icon="pi pi-replay"
              [disabled]="loading() || !(result()?.ready)" (onClick)="confirming.set(true)" />
            <p-button type="button" label="Cancel" severity="secondary" [text]="true" (onClick)="close()" />
          }
        } @else {
          <p-button type="button" label="Close" (onClick)="close()" />
        }
      </ng-template>
    </p-dialog>
  `
})
export class BulkRetryDialogComponent implements OnChanges {
  /** The ids to retry; null keeps the dialog closed. Setting it starts a preview. */
  @Input() targets: BulkTarget[] | null = null;
  /** Rows of an uploaded sheet that could not be used. */
  @Input() warnings: string[] = [];
  @Output() closed = new EventEmitter<void>();
  /** Something was re-queued: the list behind the dialog is out of date. */
  @Output() changed = new EventEmitter<void>();

  readonly result = signal<BulkResult | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly confirming = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly api: ApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['targets'] && this.targets) {
      this.result.set(null);
      this.error.set(null);
      this.done.set(false);
      this.confirming.set(false);
      this.loading.set(true);
      const mine = this.targets;
      this.api.bulkPreview(mine).subscribe({
        next: r => { if (this.targets === mine) { this.result.set(r); this.loading.set(false); } },
        error: e => { this.error.set(describeError(e)); this.loading.set(false); }
      });
    }
  }

  run(): void {
    if (!this.targets || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.bulkRetry(this.targets).subscribe({
      next: r => {
        this.result.set(r);
        this.done.set(true);
        this.confirming.set(false);
        this.busy.set(false);
        if (r.retried > 0) {
          this.changed.emit();
        }
      },
      error: e => { this.error.set(describeError(e)); this.busy.set(false); this.confirming.set(false); }
    });
  }

  close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  label(row: BulkRow): string {
    switch (row.outcome) {
      case 'READY': return 'Will retry';
      case 'RETRIED': return 'Retried';
      case 'FAILED': return 'Failed';
      default: return 'Skipped';
    }
  }

  severity(row: BulkRow): 'success' | 'danger' | 'secondary' | 'info' {
    switch (row.outcome) {
      case 'READY': return 'info';
      case 'RETRIED': return 'success';
      case 'FAILED': return 'danger';
      default: return 'secondary';
    }
  }

  export(rows: BulkRow[]): void {
    downloadCsv('bulk-retry', [
      { field: 'instanceId', header: 'Instance' }, { field: 'activityList', header: 'Activity instances' },
      { field: 'activities', header: 'Failed activities' }, { field: 'requestId', header: 'Request' },
      { field: 'requestType', header: 'Type' }, { field: 'requestStatus', header: 'Request status' },
      { field: 'outcome', header: 'Outcome' }, { field: 'reason', header: 'Reason' }
    ], rows.map(r => ({ ...r, activityList: r.activityInstanceIds.join(' ') })));
  }
}
