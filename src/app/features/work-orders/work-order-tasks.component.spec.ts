import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService, WorkOrderQuery } from '../../core/api.service';
import { Page, WorkOrderTask } from '../../core/models';
import { WorkOrderTasksComponent } from './work-order-tasks.component';

function task(over: Partial<WorkOrderTask>): WorkOrderTask {
  return { workOrderId: '9937061', workId: 22837103, instanceKnown: false, relatedKnown: false, ...over };
}

describe('WorkOrderTasksComponent', () => {
  function build(items: WorkOrderTask[]) {
    const queries: WorkOrderQuery[] = [];
    TestBed.configureTestingModule({
      providers: [provideRouter([]), {
        provide: ApiService,
        useValue: {
          workOrderOptions: () => of({ workOrderStatuses: ['Ready'], taskStatuses: ['Completed'] }),
          workOrderTasks: (q: WorkOrderQuery) => {
            queries.push(q);
            return of({ items, total: items.length, page: 0, size: 50 } as Page<WorkOrderTask>);
          }
        }
      }]
    });
    const f = TestBed.createComponent(WorkOrderTasksComponent);
    f.detectChanges();
    return { f, queries };
  }

  it('lists the tasks and links the instance and the related instance only when they can be opened', () => {
    const { f } = build([
      task({ workId: 1, instanceId: 275624371, instanceKnown: true }),
      task({ workId: 2, relatedInstance: 275624371, relatedKnown: true }),
      task({ workId: 3, instanceId: 111, instanceKnown: false })
    ]);
    const el: HTMLElement = f.nativeElement;
    const links = Array.from(el.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(h => (h ?? '').startsWith('/instances/'));
    expect(links).toEqual(['/instances/275624371', '/instances/275624371']);
    // an instance that is no longer in the engine tables is shown as plain text
    expect(el.textContent).toContain('111');
    expect(Array.from(el.querySelectorAll('a')).some(a => a.textContent?.trim() === '111')).toBeFalse();
  });

  it('asks the server for the first page, newest first, and shows the total', () => {
    const { f, queries } = build([task({})]);
    expect(queries[0].page).toBe(0);
    expect(queries[0].size).toBe(50);
    expect(f.componentInstance.total()).toBe(1);
  });
});
