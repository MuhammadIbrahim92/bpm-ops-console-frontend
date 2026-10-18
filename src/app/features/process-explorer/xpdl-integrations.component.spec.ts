import { TestBed } from '@angular/core/testing';
import { parseXpdl } from './xpdl';
import { XpdlIntegrationsComponent } from './xpdl-integrations.component';

const BASE = '/base/src/app/features/process-explorer/xpdl/testdata/';

describe('XpdlIntegrationsComponent', () => {
  it('groups the applications into web services and databases, each split into used and not used', async () => {
    const text = await (await fetch(BASE + 'p4177-v6.xml')).text();
    const data = parseXpdl(text, 'p4177-v6.xml');
    const f = TestBed.createComponent(XpdlIntegrationsComponent);
    f.componentInstance.model = data;
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;

    const panels = Array.from(el.querySelectorAll('p-panel'));
    expect(panels.length).toBe(2);
    expect(panels[0].textContent).toContain('Web services');
    expect(panels[1].textContent).toContain('Databases');

    const ws = data.M.integ.filter(i => i.kind === 'ws');
    const db = data.M.integ.filter(i => i.kind === 'db');
    expect(panels[0].textContent).toContain(`Used (${ws.filter(i => i.usedBy.length).length})`);
    expect(panels[0].textContent).toContain(`Not used (${ws.filter(i => !i.usedBy.length).length})`);
    expect(panels[1].textContent).toContain(`Used (${db.filter(i => i.usedBy.length).length})`);
    expect(panels[1].textContent).toContain(`Not used (${db.filter(i => !i.usedBy.length).length})`);
    // every application of the definition appears exactly once
    const names = Array.from(el.querySelectorAll('.box > div:first-child b')).map(b => b.textContent!.trim());
    expect(names.length).toBe(data.M.integ.length);
  });

  it('folds the used and not used lists away and back', async () => {
    const text = await (await fetch(BASE + 'p4177-v6.xml')).text();
    const data = parseXpdl(text, 'p4177-v6.xml');
    const f = TestBed.createComponent(XpdlIntegrationsComponent);
    f.componentInstance.model = data;
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const boxes = () => el.querySelectorAll('.box').length;
    const total = boxes();
    expect(total).toBe(data.M.integ.length);

    // fold away every "Used" list: only the not used ones are left
    const usedHeaders = Array.from(el.querySelectorAll('button.group')).filter(b => b.textContent!.includes('Used ('));
    usedHeaders.forEach(b => (b as HTMLButtonElement).click());
    f.detectChanges();
    expect(boxes()).toBe(data.M.integ.filter(i => i.usedBy.length === 0).length);
    expect(usedHeaders.every(b => b.getAttribute('aria-expanded') === 'false')).toBeTrue();

    usedHeaders.forEach(b => (b as HTMLButtonElement).click());
    f.detectChanges();
    expect(boxes()).toBe(total);
  });
});
