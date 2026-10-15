import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, RequestQuery } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { Lookups, RequestRow } from '../../core/models';
import { requestLook } from '../../core/status';
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { RetryButtonComponent } from '../../shared/retry-button.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, RetryButtonComponent, DateTimePipe, AgePipe],
  template: `
    <div class="page">
      <h1>Request queue</h1>
      <p class="sub">The engine's work queue. A stuck request can be put back in the queue; nothing else is changed.</p>

      <form class="card row" (ngSubmit)="search()">
        <label class="field">Request id or command text
          <input name="text" [(ngModel)]="f.text" placeholder="e.g. 5521 or INST_ID=10442">
        </label>
        <label class="field">Status
          <select name="status" [(ngModel)]="f.status">
            <option value="">Any</option>
            @for (s of lookups()?.requestStatuses ?? []; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </label>
        <label class="field">Type
          <input name="type" [(ngModel)]="f.type" placeholder="any">
        </label>
        <label class="field">From
          <input name="from" type="date" [(ngModel)]="f.from">
        </label>
        <label class="field">To
          <input name="to" type="date" [(ngModel)]="f.to">
        </label>
        <button class="btn primary" type="submit">Search</button>
        <button class="btn" type="button" (click)="reset()">Clear</button>
      </form>

      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      <div class="card" style="margin-top: 12px">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Requested</th><th>Fetched</th><th>Instance</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              @for (r of items(); track r.id) {
                <tr>
                  <td class="nowrap"><button type="button" class="link" [attr.aria-expanded]="open() === r.id" (click)="toggle(r.id)">{{ r.id }}</button></td>
                  <td>{{ r.type }}</td>
                  <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
                  <td class="nowrap">{{ r.requestDate | dateTime }}</td>
                  <td class="nowrap">{{ r.fetchDate | age }}</td>
                  <td>@if (r.instanceId) { <a [routerLink]="['/instances', r.instanceId]">#{{ r.instanceId }}</a> }</td>
                  <td class="clip" [title]="r.rejectionReason || r.notes || ''">{{ r.rejectionReason || r.notes }}</td>
                  <td><app-retry-button [row]="r" [allowed]="auth.can('RETRY_REQUEST')" (retried)="replace($event)" /></td>
                </tr>
                @if (open() === r.id) {
                  <tr class="detail">
                    <td colspan="8">
                      <dl>
                        <dt>Command</dt><dd class="mono">{{ r.command }}</dd>
                        <dt>Notes</dt><dd>{{ r.notes || '—' }}</dd>
                        <dt>Rejection reason</dt><dd>{{ r.rejectionReason || '—' }}</dd>
                        <dt>Engine</dt><dd>{{ r.engineId || '—' }}</dd>
                        <dt>Finished</dt><dd>{{ r.finishDate | dateTime }}</dd>
                      </dl>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if (loading()) { <p class="empty" role="status">Loading&hellip;</p> }
        @else if (items().length === 0) { <p class="empty">No requests match.</p> }

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
    .link { font: inherit; background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; }
    .link:hover { text-decoration: underline; }
    .clip { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    tr.detail td { background: var(--surface-2); }
    dl { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; margin: 0; }
    dt { color: var(--muted); font-size: 12px; font-weight: 600; }
    dd { margin: 0; overflow-wrap: anywhere; }
  `]
})
export class RequestListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly size = 50;
  readonly lookups = signal<Lookups | null>(null);
  readonly items = signal<RequestRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly open = signal<number | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  f = { text: '', status: '', type: '', from: '', to: '' };
  look = requestLook;

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
      this.load();
    });
  }

  pages(): number {
    return Math.max(1, Math.ceil(this.total() / this.size));
  }

  toggle(id: number): void {
    this.open.update(cur => (cur === id ? null : id));
  }

  search(): void {
    this.navigate(0);
  }

  reset(): void {
    this.f = { text: '', status: '', type: '', from: '', to: '' };
    this.navigate(0);
  }

  go(page: number): void {
    this.navigate(page);
  }

  replace(updated: RequestRow): void {
    this.items.update(list => list.map(r => (r.id === updated.id ? updated : r)));
  }

  private navigate(page: number): void {
    const f = this.f;
    this.router.navigate([], {
      queryParams: {
        text: f.text || null, status: f.status || null, type: f.type || null,
        from: f.from || null, to: f.to || null, page: page > 0 ? page : null
      }
    });
  }

  private load(): void {
    const q: RequestQuery = { ...this.f, page: this.page(), size: this.size };
    this.loading.set(true);
    this.error.set(null);
    this.api.requests(q).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.total.set(0); this.loading.set(false); }
    });
  }
}
