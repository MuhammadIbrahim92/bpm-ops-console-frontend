import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LogFile, LogFindResult } from '../core/models';
import { UuidLogsComponent } from './uuid-logs.component';

const file = (id: string, modified: string): LogFile => ({ id, name: id.split('/')[1], folder: 0, sizeBytes: 1000, modified });

describe('UuidLogsComponent', () => {
  it('searches only the files changed since the step started and lists the lines found', () => {
    const calls: { files: string[]; text: string }[] = [];
    const result: LogFindResult = { hits: [{ file: '0/new.log', name: 'new.log', offset: 77, text: 'call 3f2a ok', cut: 0 }], scannedBytes: 10, done: true };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), {
        provide: ApiService,
        useValue: {
          logFiles: () => of({ configured: true, files: [file('0/new.log', '2026-10-19T12:00:00'), file('0/old.log', '2026-10-01T12:00:00')] }),
          logFind: (files: string[], text: string) => { calls.push({ files, text }); return of(result); }
        }
      }]
    });
    const f = TestBed.createComponent(UuidLogsComponent);
    f.componentRef.setInput('uuid', '3f2a');
    f.componentRef.setInput('since', '2026-10-19T11:00:00');
    f.detectChanges();
    f.componentInstance.start();
    f.detectChanges();
    expect(calls).toEqual([{ files: ['0/new.log'], text: '3f2a' }]);
    expect(f.componentInstance.hits().length).toBe(1);
    expect((f.nativeElement as HTMLElement).textContent).toContain('call 3f2a ok');
    expect(f.componentInstance.note()).toContain('1 line');
  });

  it('says so when no file changed since the step started', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), {
        provide: ApiService,
        useValue: { logFiles: () => of({ configured: true, files: [file('0/old.log', '2026-10-01T12:00:00')] }) }
      }]
    });
    const f = TestBed.createComponent(UuidLogsComponent);
    f.componentRef.setInput('uuid', 'abc');
    f.componentRef.setInput('since', '2026-10-19T11:00:00');
    f.componentInstance.start();
    expect(f.componentInstance.note()).toContain('No log file was changed');
  });
});
