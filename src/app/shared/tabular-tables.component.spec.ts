import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TabularTable } from '../core/models';
import { TabularTablesComponent } from './tabular-tables.component';

function table(page: number, size: number, total: number): TabularTable {
  const first = page * size + 1;
  const rows = [];
  for (let i = first; i < Math.min(first + size, total + 1); i++) {
    rows.push({ rowId: i, values: { mac_address_Devices: 'MAC' + i } });
  }
  return { doId: 7, doName: 'Devices', columns: ['mac_address_Devices'], rows, totalRows: total, page, size };
}

describe('TabularTablesComponent', () => {
  it('shows a pager for a big table and reads the next page from the server', () => {
    const fixture = TestBed.createComponent(TabularTablesComponent);
    const calls: number[][] = [];
    fixture.componentInstance.loader = (doId, page, size) => {
      calls.push([doId, page, size]);
      return of(table(page, size, 60));
    };
    fixture.componentInstance.tables = [table(0, 25, 60)];
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('60 rows');
    expect(el.querySelectorAll('tbody tr').length).toBe(25);
    expect(el.querySelector('app-pager')).not.toBeNull();

    fixture.componentInstance.load(fixture.componentInstance.shown()[0], 2, 25);
    fixture.detectChanges();

    expect(calls).toEqual([[7, 2, 25]]);
    expect(fixture.componentInstance.shown()[0].page).toBe(2);
    // the last page holds rows 51 to 60
    expect(el.querySelectorAll('tbody tr').length).toBe(10);
    expect(el.textContent).toContain('MAC51');
  });

  it('has no pager when every row fits on one page', () => {
    const fixture = TestBed.createComponent(TabularTablesComponent);
    fixture.componentInstance.tables = [table(0, 25, 3)];
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-pager')).toBeNull();
  });
});
