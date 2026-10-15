import { Component, Input, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AttributeSection } from '../core/models';
import { downloadCsv } from './csv';

/**
 * Attributes grouped by data object (DO_ID): one collapsible panel per data object. Every table sorts and filters
 * by column; one search box filters all panels; the export covers the rows that pass the search.
 */
@Component({
  selector: 'app-attribute-sections',
  standalone: true,
  imports: [FormsModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, PanelModule, TableModule, TagModule],
  template: `
    @if (sections.length > 0) {
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input pInputText type="text" [ngModel]="term()" (ngModelChange)="term.set($event)"
            placeholder="Search attributes" aria-label="Search attributes" />
        </p-iconfield>
        <p-button type="button" icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" (onClick)="export()" />
        <p-button type="button" icon="pi pi-filter-slash" label="Clear" severity="secondary" [outlined]="true" (onClick)="term.set('')" />
      </div>
    }
    @for (s of visibleSections(); track s.doId) {
      <p-panel [toggleable]="true" styleClass="mb-4">
        <ng-template #header>
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ s.doName }}</span>
            <p-tag [value]="'DO ' + s.doId" severity="secondary" />
            <span class="text-muted-color text-sm">{{ s.attributes.length }} attributes</span>
          </div>
        </ng-template>
        <p-table [value]="s.attributes" size="small" [rowHover]="true" [stripedRows]="true" [resizableColumns]="true"
          columnResizeMode="expand" [paginator]="s.attributes.length > 25" [rows]="25">
          <ng-template #header>
            <tr>
              <th pSortableColumn="name" pResizableColumn>Attribute <p-sortIcon field="name" /><p-columnFilter type="text" field="name" display="menu" /></th>
              <th pSortableColumn="type" pResizableColumn>Type <p-sortIcon field="type" /><p-columnFilter type="text" field="type" display="menu" /></th>
              <th pSortableColumn="value" pResizableColumn>Value <p-sortIcon field="value" /><p-columnFilter type="text" field="value" display="menu" /></th>
            </tr>
          </ng-template>
          <ng-template #body let-a>
            <tr>
              <td>{{ a.name }} @if (a.tabular) { <span class="text-muted-color">(table)</span> }</td>
              <td class="text-muted-color">{{ a.type }}</td>
              <td class="val">{{ a.value }}@if (a.value1) { <span class="text-muted-color"> / {{ a.value1 }}</span> }</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage><tr><td colspan="3">No attribute matches.</td></tr></ng-template>
        </p-table>
      </p-panel>
    } @empty {
      <p class="text-muted-color">{{ sections.length > 0 ? 'No attribute matches the search.' : emptyText }}</p>
    }
  `,
  styles: [`
    .val { white-space: pre-wrap; word-break: break-word; }
  `]
})
export class AttributeSectionsComponent {
  private readonly all = signal<AttributeSection[]>([]);

  @Input() set sections(value: AttributeSection[]) {
    this.all.set(value ?? []);
  }
  get sections(): AttributeSection[] {
    return this.all();
  }
  @Input() emptyText = 'No attributes.';
  /** Used in the downloaded file name. */
  @Input() exportName = 'attributes';

  readonly term = signal('');

  /** The panels with only the attributes that match the search; panels with none are left out. */
  readonly visibleSections = computed<AttributeSection[]>(() => {
    const q = this.term().trim().toLowerCase();
    if (!q) {
      return this.all();
    }
    return this.all()
      .map(s => ({
        ...s,
        attributes: s.attributes.filter(a =>
          [a.name, a.type, a.value, a.value1, s.doName].some(v => (v ?? '').toLowerCase().includes(q)))
      }))
      .filter(s => s.attributes.length > 0);
  });

  export(): void {
    const rows = this.visibleSections().flatMap(s =>
      s.attributes.map(a => ({ doId: s.doId, doName: s.doName, name: a.name, type: a.type, value: a.value, value1: a.value1 })));
    downloadCsv(this.exportName, [
      { field: 'doId', header: 'DO_ID' }, { field: 'doName', header: 'Data object' }, { field: 'name', header: 'Attribute' },
      { field: 'type', header: 'Type' }, { field: 'value', header: 'Value' }, { field: 'value1', header: 'Value 1' }
    ], rows);
  }
}
