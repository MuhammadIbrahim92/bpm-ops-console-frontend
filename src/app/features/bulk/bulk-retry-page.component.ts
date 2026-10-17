import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { BulkTarget } from '../../core/models';
import { BulkRetryDialogComponent } from '../../shared/bulk-retry-dialog.component';
import { downloadCsv } from '../../shared/csv';

/** Bulk retry of failed activities: import an Excel/CSV sheet, or paste ids. Nothing changes until you confirm. */
@Component({
  selector: 'app-bulk-retry-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, MessageModule, SelectButtonModule, TextareaModule, BulkRetryDialogComponent],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Bulk retry</div>
      <p class="text-muted-color mb-4">
        Put the newest engine request of failed activities back in the queue, in one go. For each process instance the
        newest request is re-queued once, however many of its activities failed. You see what would happen for every
        row first, and confirm once.
      </p>

      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-6">
          <div class="font-semibold mb-2"><i class="pi pi-file-excel mr-2"></i>Import an Excel or CSV sheet</div>
          <p class="text-muted-color text-sm mb-3">
            The first row names the columns: <span class="mono">ACTIVITY_INSTANCE_ID</span> and/or
            <span class="mono">INSTANCE_ID</span>. Other columns are ignored. Up to 200 rows, .xlsx or .csv.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <p-button type="button" icon="pi pi-upload" label="Choose a file" [loading]="importing()" (onClick)="fileInput.click()" />
            <input #fileInput type="file" accept=".xlsx,.xlsm,.csv" class="hidden" (change)="onFile($event)" aria-label="Choose a sheet" />
            <p-button type="button" icon="pi pi-download" label="Download template" severity="secondary" [text]="true" (onClick)="template()" />
          </div>
        </div>

        <div class="col-span-12 lg:col-span-6">
          <div class="font-semibold mb-2"><i class="pi pi-list mr-2"></i>Or paste ids</div>
          <p-selectbutton [options]="kinds" [(ngModel)]="kind" optionLabel="label" optionValue="value" [allowEmpty]="false" class="mb-2" />
          <textarea pTextarea rows="5" class="w-full" [(ngModel)]="pasted" aria-label="Ids to retry"
            placeholder="One id per line, or separated by commas or spaces"></textarea>
          <div class="mt-2">
            <p-button type="button" icon="pi pi-search" label="Review" [disabled]="!pasted.trim()" (onClick)="review()" />
          </div>
        </div>
      </div>

      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mt-4" /> }

      <p class="text-muted-color text-sm mt-6">
        You can also tick failed steps on the <a routerLink="/issues" [queryParams]="{ type: 'FAILED_ACTIVITY' }">Issues</a>
        page (Failed steps tab) and retry them from there.
      </p>
    </div>

    <app-bulk-retry-dialog [targets]="targets()" [warnings]="warnings()" (closed)="close()" />
  `
})
export class BulkRetryPageComponent {
  private readonly api = inject(ApiService);

  readonly kinds = [
    { label: 'Activity instance ids', value: 'activity' },
    { label: 'Process instance ids', value: 'instance' }
  ];
  kind: 'activity' | 'instance' = 'activity';
  pasted = '';

  readonly targets = signal<BulkTarget[] | null>(null);
  readonly warnings = signal<string[]>([]);
  readonly importing = signal(false);
  readonly error = signal<string | null>(null);

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.error.set(null);
    this.importing.set(true);
    this.api.bulkImport(file).subscribe({
      next: r => {
        this.warnings.set(r.warnings);
        this.targets.set(r.targets);
        this.importing.set(false);
      },
      error: e => { this.error.set(describeError(e)); this.importing.set(false); }
    });
  }

  review(): void {
    this.error.set(null);
    const parts = this.pasted.split(/[\s,;]+/).filter(p => p.length > 0);
    const bad = parts.filter(p => !/^\d{1,18}$/.test(p));
    if (bad.length > 0) {
      this.error.set(`"${bad[0].slice(0, 30)}" is not an id. Use whole numbers only.`);
      return;
    }
    const ids = Array.from(new Set(parts.map(p => Number(p))));
    this.warnings.set([]);
    this.targets.set(ids.map(id => (this.kind === 'activity' ? { activityInstanceId: id } : { instanceId: id })));
  }

  template(): void {
    downloadCsv('bulk-retry-template', [
      { field: 'ACTIVITY_INSTANCE_ID', header: 'ACTIVITY_INSTANCE_ID' },
      { field: 'INSTANCE_ID', header: 'INSTANCE_ID' }
    ], []);
  }

  close(): void {
    this.targets.set(null);
    this.warnings.set([]);
  }
}
