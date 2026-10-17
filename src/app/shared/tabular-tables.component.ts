import { Component, Input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabularTable } from '../core/models';
import { downloadCsv } from './csv';

interface Shown {
  doId: number;
  doName: string;
  truncated: boolean;
  columns: { field: string; header: string }[];
  rows: Record<string, string | number | null>[];
}

/**
 * Data objects of type Table, drawn as tables: one panel per data object, one column per attribute, one row per
 * ROW_ID of the engine (the id that ties the cells of a row together).
 */
@Component({
  selector: 'app-tabular-tables',
  standalone: true,
  imports: [ButtonModule, MessageModule, PanelModule, TableModule, TagModule],
  template: `
    @for (t of shown(); track t.doId) {
      <p-panel [toggleable]="true" styleClass="mb-4">
        <ng-template #header>
          <div class="flex flex-wrap items-center gap-2">
            <i class="pi pi-table"></i>
            <span class="font-semibold">{{ t.doName }}</span>
            <p-tag [value]="'DO ' + t.doId" severity="secondary" />
            <span class="text-muted-color text-sm">{{ t.rows.length }} row{{ t.rows.length === 1 ? '' : 's' }}, {{ t.columns.length - 1 }} columns</span>
          </div>
        </ng-template>
        <ng-template #icons>
          <p-button type="button" icon="pi pi-download" label="Export CSV" size="small" severity="secondary" [outlined]="true" (onClick)="export(t)" />
        </ng-template>
        @if (t.truncated) {
          <p-message severity="warn" text="This data object is very large; only the first rows are shown." styleClass="mb-2" />
        }
        <div class="wide">
        <p-table [value]="t.rows" size="small" [rowHover]="true" [stripedRows]="true"
          [paginator]="t.rows.length > 25" [rows]="25" [rowsPerPageOptions]="[25, 50, 100]">
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
      </p-panel>
    }
  `,
  styles: [`
    .wide { overflow-x: auto; max-width: 100%; }
    .val { white-space: pre-wrap; word-break: break-word; }
    .rowid { color: var(--p-text-muted-color, #667085); font-variant-numeric: tabular-nums; }
  `]
})
export class TabularTablesComponent {
  readonly shown = signal<Shown[]>([]);

  @Input() exportName = 'table';

  @Input() set tables(value: TabularTable[] | null | undefined) {
    this.shown.set((value ?? []).map(t => ({
      doId: t.doId,
      doName: t.doName,
      truncated: t.truncated,
      columns: [{ field: '_row', header: 'Row' }, ...t.columns.map(c => ({ field: c, header: heading(c, t.doName) }))],
      rows: t.rows.map(r => ({ _row: r.rowId, ...r.values }))
    })));
  }

  export(t: Shown): void {
    downloadCsv(`${this.exportName}-${t.doName.replace(/\W+/g, '_')}`,
      t.columns.map(c => ({ field: c.field, header: c.header })), t.rows);
  }
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
