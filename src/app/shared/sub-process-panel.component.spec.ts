import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { InstanceSummary, SubProcessLink } from '../core/models';
import { SubProcessPanelComponent } from './sub-process-panel.component';

const child = (id: number, status: string, failed = 0): InstanceSummary => ({
  id, name: 'child', processId: 2649, processName: 'Visit Confirmation', version: 'Version 46', status,
  created: '2024-01-01T10:00:00', createdBy: 'x', test: false, runningActivities: 0, failedActivities: failed
} as unknown as InstanceSummary);

const link = (n: number, c: InstanceSummary | null, hidden = false): SubProcessLink => ({
  activityId: 'A', activityName: 'Confirmation', activityInstanceId: n, status: 'Completed', start: '2024-01-01T10:00:00',
  configuredProcessId: '2649', configuredVersion: 'Version 8', matchedBy: c ? 'step id' : null, child: c, hidden
});

describe('SubProcessPanelComponent', () => {
  let diagramCalls: number[];

  beforeEach(() => {
    diagramCalls = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: ApiService,
        useValue: { diagram: (id: number) => { diagramCalls.push(id); return of({ overlay: { activities: [], takenEdges: [], unknownActivities: [] }, diagramError: 'No drawing.' }); } }
      }]
    });
  });

  it('lists each run with its child, a link to a new tab, and says when the version differs', () => {
    const f = TestBed.createComponent(SubProcessPanelComponent);
    f.componentInstance.links = [link(1, child(500, 'COMPLETED')), link(2, child(501, 'STARTED', 2))];
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.textContent).toContain('#500');
    expect(el.textContent).toContain('#501');
    expect(el.textContent).toContain('2 failed steps');
    expect(el.textContent).toContain('the drawing names Version 8');
    const hrefs = Array.from(el.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['#/instances/500', '#/instances/501']);
    expect(el.querySelector('a')!.getAttribute('target')).toBe('_blank');
  });

  it('reads the child tracking only when asked to show it', () => {
    const f = TestBed.createComponent(SubProcessPanelComponent);
    f.componentInstance.links = [link(1, child(500, 'COMPLETED'))];
    f.detectChanges();
    expect(diagramCalls).toEqual([]);
    f.componentInstance.toggle(500);
    f.detectChanges();
    expect(diagramCalls).toEqual([500]);
    f.componentInstance.toggle(500);
    f.componentInstance.toggle(500);
    expect(diagramCalls).toEqual([500]);
  });

  it('says plainly when no child was recorded or the user may not see it', () => {
    const f = TestBed.createComponent(SubProcessPanelComponent);
    f.componentInstance.links = [link(1, null), link(2, null, true)];
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('No sub-process instance is recorded for this run.');
    expect(text).toContain('you may not view it');
  });
});
