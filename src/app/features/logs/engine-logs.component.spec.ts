import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { LogFile, LogHit, LogPage } from '../../core/models';
import { EngineLogsComponent } from './engine-logs.component';

const FILE: LogFile = { id: '0/engine.log', name: 'engine.log', folder: 0, sizeBytes: 4_500_000_000, modified: '2026-10-19T10:00:00' };

function page(start: number, end: number, hasPrevious: boolean, hasNext: boolean, texts: string[]): LogPage {
  return { file: FILE.id, size: FILE.sizeBytes, startOffset: start, endOffset: end, hasPrevious, hasNext,
    lines: texts.map((t, i) => ({ offset: start + i * 10, text: t, cut: 0 })) };
}

describe('EngineLogsComponent', () => {
  let pages: { offset: number; lines: number; direction: string }[];
  let searches: { text: string; from: number; direction: string; skip: boolean }[];
  let hit: LogHit;

  function build(configured = true, files: LogFile[] = [FILE]) {
    pages = [];
    searches = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: ApiService,
        useValue: {
          logFiles: () => of({ configured, files }),
          logPage: (_f: string, offset: number, lines: number, direction: string): Observable<LogPage> => {
            pages.push({ offset, lines, direction });
            return of(direction === 'backward' && offset > 4_000_000_000
              ? page(4_499_999_000, FILE.sizeBytes, true, false, ['2026-10-19 ERROR boom', '\tat com.bpm.Engine.run(Engine.java:5)', 'last line'])
              : page(offset, offset + 30, offset > 0, true, ['a line', 'another line']));
          },
          logSearch: (_f: string, text: string, from: number, direction: string, skip: boolean): Observable<LogHit> => {
            searches.push({ text, from, direction, skip });
            return of(hit);
          }
        }
      }]
    });
    const f = TestBed.createComponent(EngineLogsComponent);
    f.detectChanges();
    return f;
  }

  beforeEach(() => { hit = { found: true, offset: 123_456, scannedBytes: 1000, reachedEdge: false }; });

  it('says so when no log folder is configured', () => {
    const f = build(false, []);
    expect((f.nativeElement as HTMLElement).textContent).toContain('No log folder is configured');
  });

  it('opens the newest file at its end, with its lines marked by kind', () => {
    const f = build();
    expect(pages[0]).toEqual({ offset: Number.MAX_SAFE_INTEGER, lines: 200, direction: 'backward' });
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('.row').length).toBe(3);
    expect(el.querySelector('.row.error')).not.toBeNull();
    expect(el.querySelector('.row.trace')).not.toBeNull();
    // 4.5 GB is shown in gigabytes, and the position as a share of the file
    expect(f.componentInstance.size(FILE.sizeBytes)).toBe('4.19 GB');
    expect(f.componentInstance.percent()).toBeGreaterThan(99);
  });

  it('moves by byte position: next from the end of this page, previous from the start of it, start and end', () => {
    const f = build();
    f.componentInstance.first();
    expect(pages[pages.length - 1]).toEqual({ offset: 0, lines: 200, direction: 'forward' });
    f.componentInstance.next();
    expect(pages[pages.length - 1]).toEqual({ offset: 30, lines: 200, direction: 'forward' });
    f.componentInstance.previous();
    expect(pages[pages.length - 1]).toEqual({ offset: 30, lines: 200, direction: 'backward' });
    f.componentInstance.last();
    expect(pages[pages.length - 1].direction).toBe('backward');
  });

  it('jumps to a share of the file and keeps the page size when it changes', () => {
    const f = build();
    f.componentInstance.jump({ target: { value: '500' } } as unknown as Event);
    expect(pages[pages.length - 1]).toEqual({ offset: 2_250_000_000, lines: 200, direction: 'forward' });
    f.componentInstance.setLines(1000);
    expect(pages[pages.length - 1].lines).toBe(1000);
  });

  it('searches from the page, shows the match at its position, and goes on from there', () => {
    const f = build();
    f.componentInstance.term.set('277939916');
    f.componentInstance.find(true, false);
    expect(searches[0].text).toBe('277939916');
    expect(searches[0].direction).toBe('forward');
    expect(pages[pages.length - 1]).toEqual({ offset: 123_456, lines: 200, direction: 'forward' });
    expect(f.componentInstance.match()).toBe(123_456);
    f.componentInstance.find(true, false);
    expect(searches[1].from).toBe(123_456);
    expect(searches[1].skip).toBeTrue();
  });

  it('says where a search stopped when the file is too big to scan in one go, and continues from there', () => {
    const f = build();
    f.componentInstance.term.set('needle');
    hit = { found: false, scannedBytes: 268_435_456, stoppedAt: 268_000_000, reachedEdge: false };
    f.componentInstance.find(true, false);
    expect(f.componentInstance.note()).toContain('Searched 256.0 MB');
    expect(f.componentInstance.continueFrom()).toBe(268_000_000);
    hit = { found: false, scannedBytes: 10, reachedEdge: true };
    f.componentInstance.keepSearching();
    expect(searches[1].from).toBe(268_000_000);
    expect(searches[1].skip).toBeFalse();
    expect(f.componentInstance.note()).toContain('end of the file');
  });

  it('marks the searched text in a line', () => {
    const f = build();
    f.componentInstance.term.set('ERROR');
    const parts = f.componentInstance.parts('2026 error and ERROR again');
    expect(parts.filter(p => p.hit).length).toBe(2);
    expect(parts.map(p => p.text).join('')).toBe('2026 error and ERROR again');
  });
});
