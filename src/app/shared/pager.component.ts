import { Component, EventEmitter, Input, Output } from '@angular/core';

/** First / previous / next / last, a page-size selector and the total. Pages are zero-based. */
@Component({
  selector: 'app-pager',
  standalone: true,
  template: `
    <div class="pager">
      <span>{{ total }} {{ noun }}</span>
      <button class="btn small" type="button" [disabled]="page <= 0" (click)="pageChange.emit(0)" aria-label="First page">&laquo;</button>
      <button class="btn small" type="button" [disabled]="page <= 0" (click)="pageChange.emit(page - 1)">Previous</button>
      <span>Page {{ page + 1 }} of {{ pages() }}</span>
      <button class="btn small" type="button" [disabled]="page + 1 >= pages()" (click)="pageChange.emit(page + 1)">Next</button>
      <button class="btn small" type="button" [disabled]="page + 1 >= pages()" (click)="pageChange.emit(pages() - 1)" aria-label="Last page">&raquo;</button>
      <label class="size">Per page
        <select [value]="size" (change)="onSize($event)">
          @for (s of sizes; track s) {
            <option [value]="s" [selected]="s === size">{{ s }}</option>
          }
        </select>
      </label>
    </div>
  `,
  styles: [`
    .pager { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .size { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--muted); }
  `]
})
export class PagerComponent {
  @Input() total = 0;
  @Input() page = 0;
  @Input() size = 50;
  @Input() noun = 'found';
  @Input() sizes: number[] = [25, 50, 100, 200];
  @Output() pageChange = new EventEmitter<number>();
  @Output() sizeChange = new EventEmitter<number>();

  pages(): number {
    return Math.max(1, Math.ceil(this.total / Math.max(1, this.size)));
  }

  onSize(e: Event): void {
    this.sizeChange.emit(Number((e.target as HTMLSelectElement).value));
  }
}
