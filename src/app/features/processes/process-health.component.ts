import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { ActivityStat, Lookups } from '../../core/models';
import { DurationPipe } from '../../shared/pipes';

@Component({
  selector: 'app-process-health',
  standalone: true,
  imports: [FormsModule, DurationPipe],
  template: `
    <div class="page">
      <h1>Process health</h1>
      <p class="sub">Where a process loses time. Steps are ranked by how long they take on average, over the chosen period.</p>

      <form class="card row" (ngSubmit)="load()">
        <label class="field">Process
          <select name="process" [(ngModel)]="processId" required>
            <option [ngValue]="null" disabled>Choose a process</option>
            @for (p of lookups()?.processes ?? []; track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </label>
        <label class="field">Version (optional)
          <input name="version" [(ngModel)]="version" placeholder="all versions">
        </label>
        <label class="field">Period
          <select name="days" [(ngModel)]="days">
            <option [ngValue]="7">Last 7 days</option>
            <option [ngValue]="30">Last 30 days</option>
            <option [ngValue]="90">Last 90 days</option>
          </select>
        </label>
        <button class="btn primary" type="submit" [disabled]="processId === null || loading()">Show</button>
      </form>

      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      @if (loaded()) {
        <div class="card" style="margin-top: 12px">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Step</th><th class="right">Runs</th><th class="right">Running now</th><th class="right">Failed</th><th>Average time</th><th class="right">Slowest</th><th class="right">Longest wait now</th></tr>
              </thead>
              <tbody>
                @for (s of stats(); track s.activityId) {
                  <tr>
                    <td class="mono">{{ s.activityId }}</td>
                    <td class="right">{{ s.executions }}</td>
                    <td class="right">{{ s.running }}</td>
                    <td class="right">@if (s.failed > 0) { <strong class="bad">{{ s.failed }}</strong> } @else { 0 }</td>
                    <td>
                      <div class="bar" role="img" [attr.aria-label]="'Average ' + (s.avgSeconds ?? 0) + ' seconds'">
                        <span [style.width.%]="width(s.avgSeconds)"></span>
                      </div>
                      {{ s.avgSeconds | duration }}
                    </td>
                    <td class="right">{{ s.maxSeconds | duration }}</td>
                    <td class="right">{{ s.longestRunningSeconds | duration }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (stats().length === 0) { <p class="empty">No activity was recorded for this process in the period.</p> }
        </div>
      }
    </div>
  `,
  styles: [`
    .bad { color: var(--c-failed); }
    .bar { height: 8px; background: var(--surface-2); border-radius: 4px; min-width: 120px; overflow: hidden; margin-bottom: 3px; }
    .bar span { display: block; height: 100%; background: var(--accent); }
  `]
})
export class ProcessHealthComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly lookups = signal<Lookups | null>(null);
  readonly stats = signal<ActivityStat[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);

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
