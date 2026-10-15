import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, InstanceQuery } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { InstanceSummary, Lookups } from '../../core/models';
import { instanceLook } from '../../core/status';
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-instance-list',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, DateTimePipe, AgePipe],
  template: `
    <div class="page">
      <h1>Instances</h1>
      <p class="sub">Search running and finished process instances. Open one to see where it is on the diagram.</p>

      <form class="card row" (ngSubmit)="search()">
        <label class="field">Instance id or name
          <input name="text" [(ngModel)]="f.text" placeholder="e.g. 10442 or Survey">
        </label>
        <label class="field">Status
          <select name="status" [(ngModel)]="f.status">
            <option value="">Any</option>
            @for (s of lookups()?.instanceStatuses ?? []; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </label>
        <label class="field">Process
          <select name="processId" [(ngModel)]="f.processId">
            <option [ngValue]="null">All processes</option>
            @for (p of lookups()?.processes ?? []; track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </label>
        <label class="field">Created from
          <input name="from" type="date" [(ngModel)]="f.from">
        </label>
        <label class="field">Created to
          <input name="to" type="date" [(ngModel)]="f.to">
        </label>
        <label class="field">Open longer than (hours)
          <input name="older" type="number" min="1" [(ngModel)]="f.olderThanHours">
        </label>
        <label class="field">
          <span><input name="test" type="checkbox" [(ngModel)]="f.includeTest"> Include test instances</span>
        </label>
        <button class="btn primary" type="submit">Search</button>
        <button class="btn" type="button" (click)="reset()">Clear</button>
      </form>

      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      <div class="card list">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Id</th><th>Name</th><th>Process</th><th>Status</th><th class="right">Running</th><th class="right">Failed</th><th>Created</th><th>Open for</th><th>By</th></tr>
            </thead>
            <tbody>
              @for (i of items(); track i.id) {
                <tr>
                  <td class="nowrap"><a [routerLink]="['/instances', i.id]">{{ i.id }}</a></td>
                  <td>{{ i.name }} @if (i.test) { <span class="muted">(test)</span> }</td>
                  <td>{{ i.processName }} <span class="muted">v{{ i.version }}</span></td>
                  <td><app-status-badge [look]="look(i.status)" [text]="i.status" /></td>
                  <td class="right">{{ i.runningActivities }}</td>
                  <td class="right">@if (i.failedActivities > 0) { <strong class="bad">{{ i.failedActivities }}</strong> } @else { 0 }</td>
                  <td class="nowrap">{{ i.created | dateTime }}</td>
                  <td class="nowrap">@if (!i.finished) { {{ i.created | age }} } @else { <span class="muted">finished</span> }</td>
                  <td>{{ i.createdBy }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!loading() && items().length === 0) { <p class="empty">No instances match.</p> }
        @if (loading()) { <p class="empty" role="status">Loading&hellip;</p> }

        <div class="pager">
          <span>{{ total() }} found</span>
          <button class="btn small" type="button" [disabled]="page() === 0" (click)="go(page() - 1)">Previous</button>
          <span>Page {{ page() + 1 }} of {{ pages() }}</span>
          <button class="btn small" type="button" [disabled]="page() + 1 >= pages()" (click)="go(page() + 1)">Next</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .list { margin-top: 12px; }
    .bad { color: var(--c-failed); }
  `]
})
export class InstanceListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly size = 50;
  readonly lookups = signal<Lookups | null>(null);
  readonly items = signal<InstanceSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  f = this.blank();

  look = instanceLook;

  ngOnInit(): void {
    this.api.lookups().subscribe({ next: l => this.lookups.set(l), error: () => undefined });
    this.route.queryParamMap.subscribe(q => {
      this.f = {
        text: q.get('text') ?? '',
        status: q.get('status') ?? '',
        processId: q.get('processId') ? Number(q.get('processId')) : null,
        from: q.get('from') ?? '',
        to: q.get('to') ?? '',
        olderThanHours: q.get('olderThanHours') ? Number(q.get('olderThanHours')) : null,
        includeTest: q.get('includeTest') === 'true'
      };
      this.page.set(q.get('page') ? Math.max(0, Number(q.get('page'))) : 0);
      this.load();
    });
  }

  pages(): number {
    return Math.max(1, Math.ceil(this.total() / this.size));
  }

  search(): void {
    this.navigate(0);
  }

  reset(): void {
    this.f = this.blank();
    this.navigate(0);
  }

  go(page: number): void {
    this.navigate(page);
  }

  private navigate(page: number): void {
    const f = this.f;
    this.router.navigate([], {
      queryParams: {
        text: f.text || null,
        status: f.status || null,
        processId: f.processId,
        from: f.from || null,
        to: f.to || null,
        olderThanHours: f.olderThanHours,
        includeTest: f.includeTest ? 'true' : null,
        page: page > 0 ? page : null
      }
    });
  }

  private load(): void {
    const f = this.f;
    const q: InstanceQuery = {
      text: f.text, status: f.status, processId: f.processId, from: f.from, to: f.to,
      olderThanHours: f.olderThanHours, includeTest: f.includeTest, page: this.page(), size: this.size
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
      text: '', status: '', processId: null as number | null, from: '', to: '',
      olderThanHours: null as number | null, includeTest: false
    };
  }
}
