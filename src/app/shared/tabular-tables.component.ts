import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabularTable } from '../core/models';
import { downloadCsv } from './csv';
import { PagerComponent } from './pager.component';

interface Shown {
  doId: number;
  doName: string;
  totalRows: number;
  page: number;
  size: number;
  loading: boolean;
  error: string | null;
  columns: { field: string; header: string }[];
  rows: Record<string, string | number | null>[];
}

/** Fetches one page of rows of one data object. */
export type TablePageLoader = (doId: number, page: number, size: number) => Observable<TabularTable>;

/**
 * Data objects of type Table, drawn as tables: one panel per data object, one column per attribute, one row per
 * ROW_ID of the engine (the id that ties the cells of a row together). Big tables come in pages: the next page is
 * read from the server when the page changes.
 */
@Component({
  selector: 'app-tabular-tables',
  standalone: true,
  imports: [ButtonModule, MessageModule, PanelModule, TableModule, TagModule, PagerComponent],
  template: `
    @for (t of shown(); track t.doId) {
      <p-panel [toggleable]="true" styleClass="mb-4">
        <ng-template #header>
          <div class="flex flex-wrap items-center gap-2">
            <i class="pi pi-table"></i>
            <span class="font-semibold">{{ t.doName }}</span>
            <p-tag [value]="'DO ' + t.doId" severity="secondary" />
            <span class="text-muted-color text-sm">{{ t.totalRows }} row{{ t.totalRows === 1 ? '' : 's' }}, {{ t.columns.length - 1 }} columns</span>
          </div>
        </ng-template>
        <ng-template #icons>
          <p-button type="button" icon="pi pi-download" [label]="t.totalRows > t.rows.length ? 'Export this page' : 'Export CSV'" size="small"
            severity="secondary" [outlined]="true" (onClick)="export(t)" />
        </ng-template>
        @if (t.error) {
          <p-message severity="error" [text]="t.error" styleClass="mb-2" />
        }
        <div class="wide" [class.busy]="t.loading">
          <p-table [value]="t.rows" size="small" [rowHover]="true" [stripedRows]="true">
            <ng-template #header>
              <tr>
                @for (c of t.columns; track c.field) {
                  <th [pSortableColumn]="c.field" [title]="c.field">{{ c.header }} <p-sortIcon [field]="c.field" /></th>
                }
              </tr>
            </ng-template>
            <ng-template #body let-row>
              <tr>
                @for (c of t.columns; track c.field) {
                  <td class="val" [class.rowid]="c.field === '_row'">
                    @if (row[c.field] === null || row[c.field] === undefined || row[c.field] === 'null') { <span class="text-muted-color">&ndash;</span> } @else { {{ row[c.field] }} }
                  </td>
                }
              </tr>
            </ng-template>
            <ng-template #emptymessage><tr><td [attr.colspan]="t.columns.length">This table has no rows.</td></tr></ng-template>
          </p-table>
        </div>
        @if (t.totalRows > t.size || t.page > 0) {
          <app-pager [total]="t.totalRows" [page]="t.page" [size]="t.size" noun="rows" [sizes]="[25, 50, 100, 200]"
            (pageChange)="load(t, $event, t.size)" (sizeChange)="load(t, 0, $event)" />
        }
      </p-panel>
    }
  `,
  styles: [`
    .wide { overflow-x: auto; max-width: 100%; }
    .busy { opacity: .55; transition: opacity .1s; }
    .val { white-space: pre-wrap; word-break: break-word; }
    .rowid { color: var(--p-text-muted-color, #667085); font-variant-numeric: tabular-nums; }
  `]
})
export class TabularTablesComponent {
  readonly shown = signal<Shown[]>([]);

  @Input() exportName = 'table';
  /** Reads another page of a data object; without it the tables show only what they were given. */
  @Input() loader: TablePageLoader | null = null;
  @Output() readonly pageLoaded = new EventEmitter<TabularTable>();

  @Input() set tables(value: TabularTable[] | null | undefined) {
    this.shown.set((value ?? []).map(t => show(t)));
  }

  load(t: Shown, page: number, size: number): void {
    if (!this.loader) {
      return;
    }
    this.patch(t.doId, { loading: true, error: null });
    this.loader(t.doId, page, size).subscribe({
      next: fresh => {
        this.patch(t.doId, show(fresh));
        this.pageLoaded.emit(fresh);
      },
      error: () => this.patch(t.doId, { loading: false, error: 'This page of the table could not be read.' })
    });
  }

  private patch(doId: number, change: Partial<Shown>): void {
    this.shown.update(list => list.map(x => (x.doId === doId ? { ...x, ...change } : x)));
  }

  export(t: Shown): void {
    downloadCsv(`${this.exportName}-${t.doName.replace(/\W+/g, '_')}`,
      t.columns.map(c => ({ field: c.field, header: c.header })), t.rows);
  }
}

function show(t: TabularTable): Shown {
  return {
    doId: t.doId,
    doName: t.doName,
    totalRows: t.totalRows,
    page: t.page,
    size: t.size,
    loading: false,
    error: null,
    columns: [{ field: '_row', header: 'Row' }, ...t.columns.map(c => ({ field: c, header: heading(c, t.doName) }))],
    rows: t.rows.map(r => ({ _row: r.rowId, ...r.values }))
  };
}

/** "mac_address_NewDeviceInfoTABULAR" in the data object "New Device Info Tabular" reads as "mac address". */
function heading(column: string, doName: string): string {
  const compact = doName.replace(/[\s_]+/g, '').toLowerCase();
  const lower = column.toLowerCase();
  let name = column;
  if (compact && lower.endsWith('_' + compact)) {
    name = column.slice(0, column.length - compact.length - 1);
  }
  return name.replace(/_+/g, ' ').trim() || column;
}
