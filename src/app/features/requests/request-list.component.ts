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
import { AgePipe, DateTimePipe } from '../../shared/pipes';
import { Field, recFields, showValue } from '../../shared/request-fields';
import { RetryButtonComponent } from '../../shared/retry-button.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, TableModule,
    StatusBadgeComponent, RetryButtonComponent, DateTimePipe, AgePipe],
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
      <p-table [value]="items()" dataKey="id" [lazy]="true" [loading]="loading()" [paginator]="true" [rows]="size()"
        [first]="page() * size()" [totalRecords]="total()" [rowsPerPageOptions]="[25, 50, 100, 200]"
        [showCurrentPageReport]="true" currentPageReportTemplate="{first} to {last} of {totalRecords} requests"
        [rowHover]="true" [expandedRowKeys]="expanded()" [tableStyle]="{ 'min-width': '70rem' }" (onPage)="onPage($event)">
        <ng-template #header>
          <tr>
            <th style="width: 3rem"></th>
            <th>Request</th><th>Type</th><th>Status</th><th>Requested</th><th>Fetched</th><th>Instance</th><th>Notes</th><th></th>
          </tr>
        </ng-template>
        <ng-template #body let-r let-isOpen="expanded">
          <tr>
            <td>
              <p-button type="button" [text]="true" [rounded]="true" severity="secondary" size="small"
                [icon]="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-expanded]="isOpen" (onClick)="toggle(r.id)" />
            </td>
            <td class="nowrap">{{ r.id }}</td>
            <td>{{ r.type }}</td>
            <td><app-status-badge [look]="look(r.status)" [text]="r.status" /></td>
            <td class="nowrap">{{ r.requestDate | dateTime }}</td>
            <td class="nowrap">{{ r.fetchDate | age }}</td>
            <td>@if (r.instanceId) { <a [routerLink]="['/instances', r.instanceId]">#{{ r.instanceId }}</a> }</td>
            <td class="clip" [title]="r.rejectionReason || r.notes || ''">{{ r.rejectionReason || r.notes }}</td>
            <td><app-retry-button [row]="r" [allowed]="auth.can('RETRY_REQUEST')" (retried)="replace($event)" /></td>
          </tr>
        </ng-template>
        <ng-template #expandedrow let-r>
          <tr>
            <td colspan="9">
              <dl class="fields">
                @for (fld of fields(r); track fld[0]) {
                  <div><dt>{{ fld[0] }}</dt><dd>{{ show(fld[1]) }}</dd></div>
                }
              </dl>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="9">No requests match.</td></tr>
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
        from: f.from || null, to: f.to || null, page: page > 0 ? page : null, size: size !== 50 ? size : null
      }
    });
  }

  private load(): void {
    const q: RequestQuery = { ...this.f, page: this.page(), size: this.size() };
    this.loading.set(true);
    this.error.set(null);
    this.api.requests(q).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.total.set(0); this.loading.set(false); }
    });
  }
}
