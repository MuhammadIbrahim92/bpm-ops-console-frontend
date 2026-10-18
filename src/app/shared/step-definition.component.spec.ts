import { TestBed } from '@angular/core/testing';
import { DiagramNode } from '../core/models';
import { StepDefinitionComponent } from './step-definition.component';

const node = (extra: Partial<DiagramNode>): DiagramNode =>
  ({ id: '1', activityId: 'A', name: 'Step', kind: 'SCRIPT_TASK', x: 0, y: 0, width: 60, height: 40, ...extra } as DiagramNode);

function render(n: DiagramNode): HTMLElement {
  const f = TestBed.createComponent(StepDefinitionComponent);
  f.componentInstance.node = n;
  f.detectChanges();
  return f.nativeElement;
}

describe('StepDefinitionComponent', () => {
  it('shows the text of a script step', () => {
    const el = render(node({ script: '[Days] := [End] - [Start];' }));
    expect(el.querySelector('pre')!.textContent).toContain('[Days] := [End] - [Start];');
    expect(el.textContent).toContain('Script');
  });

  it('shows the procedure of a database step with its parameters in plain words', () => {
    const el = render(node({
      kind: 'DATABASE_TASK',
      dbCall: {
        application: 'Get_Days_Between', procedure: 'GET_DAYS_BETWEEN', connection: 'WFM3',
        parameters: [
          { name: 'P_START_DATE', mode: 'IN', type: 'VARCHAR2', variable: 'StartDate' },
          { name: 'P_DAYS', mode: 'OUT', type: 'NUMBER', variable: 'Days' },
          { name: 'P_BOTH', mode: 'INOUT', type: 'NUMBER', variable: '' }
        ]
      }
    }));
    expect(el.textContent).toContain('GET_DAYS_BETWEEN');
    expect(el.textContent).toContain('WFM3');
    expect(el.textContent).toContain('Get_Days_Between');
    const rows = Array.from(el.querySelectorAll('tbody tr')).map(r => Array.from(r.querySelectorAll('td')).map(c => c.textContent!.trim()));
    expect(rows[0]).toEqual(['P_START_DATE', 'Sent', 'VARCHAR2', 'StartDate']);
    expect(rows[1][1]).toBe('Returned');
    expect(rows[2][1]).toBe('Sent and returned');
  });

  it('shows nothing for a step with neither', () => {
    expect(render(node({ kind: 'USER_TASK' })).textContent!.trim()).toBe('');
  });
});
