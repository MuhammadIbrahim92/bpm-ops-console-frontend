import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { ActivityStat, Lookups } from '../../core/models';
import { DurationPipe } from '../../shared/pipes';

@Component({
  selector: 'app-process-health',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, MessageModule, ProgressBarModule, SelectModule, TableModule, DurationPipe],
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
        <div class="col-span-12 md:col-span-2">
          <p-button type="submit" label="Show" icon="pi pi-chart-bar" [disabled]="processId === null || loading()" />
        </div>
      </form>
    </div>

    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }

    @if (loaded()) {
      <div class="card">
        <p-table [value]="stats()" [loading]="loading()" [paginator]="stats().length > 25" [rows]="25" [rowHover]="true"
          [sortField]="'avgSeconds'" [sortOrder]="-1" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              <th pSortableColumn="activityId">Step <p-sortIcon field="activityId" /></th>
              <th pSortableColumn="executions" class="text-right">Runs <p-sortIcon field="executions" /></th>
              <th pSortableColumn="running" class="text-right">Running now <p-sortIcon field="running" /></th>
              <th pSortableColumn="failed" class="text-right">Failed <p-sortIcon field="failed" /></th>
              <th pSortableColumn="avgSeconds">Average time <p-sortIcon field="avgSeconds" /></th>
              <th pSortableColumn="maxSeconds" class="text-right">Slowest <p-sortIcon field="maxSeconds" /></th>
              <th pSortableColumn="longestRunningSeconds" class="text-right">Longest wait now <p-sortIcon field="longestRunningSeconds" /></th>
            </tr>
          </ng-template>
          <ng-template #body let-s>
            <tr>
              <td class="mono">{{ s.activityId }}</td>
              <td class="text-right">{{ s.executions }}</td>
              <td class="text-right">{{ s.running }}</td>
              <td class="text-right">@if (s.failed > 0) { <strong class="bad">{{ s.failed }}</strong> } @else { 0 }</td>
              <td style="min-width: 12rem">
                <p-progressbar [value]="width(s.avgSeconds)" [showValue]="false" [style]="{ height: '8px' }" />
                <span class="text-sm">{{ s.avgSeconds | duration }}</span>
              </td>
              <td class="text-right">{{ s.maxSeconds | duration }}</td>
              <td class="text-right">{{ s.longestRunningSeconds | duration }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="7">No activity was recorded for this process in the period.</td></tr>
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

  processId: number | null = null;
  version = '';
  days = 30;

  private readonly maxAvg = computed(() => Math.max(1, ...this.stats().map(s => s.avgSeconds ?? 0)));

  ngOnInit(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: e => this.error.set(describeError(e)) });
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
    this.api.bottlenecks(this.processId, this.days, this.version.trim() || undefined).subscribe({
      next: s => { this.stats.set(s); this.loaded.set(true); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.loading.set(false); }
    });
  }
}
