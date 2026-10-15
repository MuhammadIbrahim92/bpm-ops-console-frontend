import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';

export interface ToolColumn {
  field: string;
  header: string;
}

/**
 * The toolbar every table shares: quick search, column chooser, CSV export and clear. The table itself supplies
 * sorting, column filters and column resizing.
 */
@Component({
  selector: 'app-table-tools',
  standalone: true,
  imports: [FormsModule, ButtonModule, IconFieldModule, InputIconModule, InputTextModule, MultiSelectModule],
  template: `
    <div class="flex flex-wrap items-center gap-2 mb-3">
      @if (search) {
        <p-iconfield>
          <p-inputicon class="pi pi-search" />
          <input pInputText type="text" [ngModel]="term" (ngModelChange)="term = $event; searchChange.emit($event)"
            placeholder="Search in table" aria-label="Search in table" />
        </p-iconfield>
      }
      <p-multiselect [options]="columns" optionLabel="header" optionValue="field" [ngModel]="visible"
        (ngModelChange)="visibleChange.emit($event)" placeholder="Columns" [maxSelectedLabels]="0"
        selectedItemsLabel="Columns ({0})" [showToggleAll]="true" appendTo="body" />
      <p-button type="button" icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true"
        (onClick)="exportCsv.emit()" />
      <p-button type="button" icon="pi pi-filter-slash" label="Clear" severity="secondary" [outlined]="true"
        (onClick)="term = ''; clear.emit()" />
      @if (note) { <span class="text-muted-color text-sm">{{ note }}</span> }
    </div>
  `
})
export class TableToolsComponent {
  /** Every column that can be shown or hidden. */
  @Input() columns: ToolColumn[] = [];
  /** Field names of the columns currently shown. */
  @Input() visible: string[] = [];
  /** Offer the quick search box (client-side tables). */
  @Input() search = true;
  /** A short hint beside the buttons, e.g. that the export covers the current page. */
  @Input() note = '';

  @Output() visibleChange = new EventEmitter<string[]>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() exportCsv = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();

  term = '';
}
