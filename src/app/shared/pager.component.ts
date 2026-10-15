import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';

/** Page controls (PrimeNG paginator) for server-paged lists. Pages are zero-based. */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [PaginatorModule],
  template: `
    <p-paginator [first]="page * size" [rows]="size" [totalRecords]="total" [rowsPerPageOptions]="sizes"
      [showCurrentPageReport]="true" [currentPageReportTemplate]="'{first} to {last} of {totalRecords} ' + noun"
      (onPageChange)="onChange($event)" />
  `
})
export class PagerComponent {
  @Input() total = 0;
  @Input() page = 0;
  @Input() size = 50;
  @Input() noun = 'found';
  @Input() sizes: number[] = [25, 50, 100, 200];
  @Output() pageChange = new EventEmitter<number>();
  @Output() sizeChange = new EventEmitter<number>();

  onChange(e: PaginatorState): void {
    const rows = e.rows ?? this.size;
    if (rows !== this.size) {
      this.sizeChange.emit(rows);
    } else {
      this.pageChange.emit(e.page ?? 0);
    }
  }
}
