import { TestBed } from '@angular/core/testing';
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

  it('asks the page to show the child in full, and to hide it again', () => {
    const f = TestBed.createComponent(SubProcessPanelComponent);
    const asked: (number | null)[] = [];
    f.componentInstance.showDetails.subscribe(v => asked.push(v));
    f.componentInstance.links = [link(1, child(500, 'COMPLETED'))];
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    (el.querySelector('p-button button') as HTMLButtonElement).click();
    expect(asked).toEqual([500]);

    f.componentInstance.openId = 500;
    f.detectChanges();
    expect(el.textContent).toContain('Hide details');
    (el.querySelector('p-button button') as HTMLButtonElement).click();
    expect(asked).toEqual([500, null]);
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
