import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { WorkOrderAttribute, WorkOrderAttributes } from '../../core/models';
import { WorkOrderAttributesDialogComponent } from './work-order-attributes-dialog.component';

function att(over: Partial<WorkOrderAttribute>): WorkOrderAttribute {
  return { attId: 1, name: 'CustomerName', mandatory: false, readOnly: false, returnsToOm: false, returnsToVc4: false,
    present: false, defined: true, ...over };
}

const DATA: WorkOrderAttributes = {
  workOrderId: '9937061',
  requestType: 'FTTH Survey',
  sections: [
    { sectionId: 321, nameEn: 'Customer Information', present: 1, attributes: [
      att({ attId: 475, name: 'CustomerName', present: true, value: 'ZHOUZHOU', bpmAttId: 8776 }),
      att({ attId: 480, name: 'Sector' })
    ] },
    { sectionId: 428, nameEn: 'BPM Information', present: 0, attributes: [
      att({ attId: 988, name: 'Boxnumber', returnsToOm: true, returnsToVc4: true, bpmAttId: 8868 })
    ] }
  ]
};

describe('WorkOrderAttributesDialogComponent', () => {
  let asked: string[];

  function build() {
    asked = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: ApiService,
        useValue: { workOrderAttributes: (id: string) => { asked.push(id); return of(DATA); } }
      }]
    });
    const f = TestBed.createComponent(WorkOrderAttributesDialogComponent);
    f.componentRef.setInput('workOrderId', '9937061');
    f.detectChanges();
    return f;
  }

  it('loads the attributes of the work order when it is opened, with the counts', () => {
    const f = build();
    expect(asked).toEqual(['9937061']);
    expect(f.componentInstance.totalCount()).toBe(3);
    expect(f.componentInstance.presentCount()).toBe(1);
    expect(f.componentInstance.visibleSections().length).toBe(2);
  });

  it('shows only the attributes the work order does not have, or only those returned to OM or VC4', () => {
    const f = build();
    f.componentInstance.onlyMissing.set(true);
    expect(f.componentInstance.visibleSections().flatMap(s => s.attributes.map(a => a.name))).toEqual(['Sector', 'Boxnumber']);
    f.componentInstance.onlyMissing.set(false);
    f.componentInstance.onlyReturned.set(true);
    const sections = f.componentInstance.visibleSections();
    expect(sections.length).toBe(1);
    expect(sections[0].sectionId).toBe(428);
  });

  it('searches the id, the name, the value and the BPM attribute id', () => {
    const f = build();
    f.componentInstance.term.set('zhou');
    expect(f.componentInstance.visibleSections().flatMap(s => s.attributes.map(a => a.attId))).toEqual([475]);
    f.componentInstance.term.set('8868');
    expect(f.componentInstance.visibleSections().flatMap(s => s.attributes.map(a => a.attId))).toEqual([988]);
  });
});
