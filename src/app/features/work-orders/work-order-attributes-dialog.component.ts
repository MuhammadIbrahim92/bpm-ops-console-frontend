import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { WorkOrderAttribute, WorkOrderAttributes, WorkOrderSection } from '../../core/models';
import { downloadCsv } from '../../shared/csv';

/**
 * The additional attributes of one work order: every attribute its request type defines, by section, with the stored value
 * (or "not set"), the BPM attribute id and whether the attribute is returned to OM and to VC4.
 */
@Component({
  selector: 'app-work-order-attributes-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, IconFieldModule, InputIconModule, InputTextModule, MessageModule,
    PanelModule, TableModule, TagModule],
  template: `
    <p-dialog [visible]="workOrderId() !== null" (visibleChange)="$event ? null : closed.emit()" [modal]="true" [dismissableMask]="true"
      [draggable]="false" [style]="{ width: '78rem', 'max-width': '96vw' }" [contentStyle]="{ 'max-height': '78vh' }">
      <ng-template #header>
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-semibold text-lg">Additional attributes · work order {{ workOrderId() }}</span>
          @if (data(); as d) { <p-tag [value]="d.requestType || 'no request type'" severity="secondary" /> }
        </div>
      </ng-template>

      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-3" /> }
      @if (loading()) { <p class="text-muted-color">Loading…</p> }

      @if (data(); as d) {
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <p-iconfield>
            <p-inputicon class="pi pi-search" />
            <input pInputText type="text" [ngModel]="term()" (ngModelChange)="term.set($event)" placeholder="Search attributes" aria-label="Search attributes" />
          </p-iconfield>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="onlyMissing()" (ngModelChange)="onlyMissing.set($event)" /> Only attributes the work order does not have</label>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="onlyReturned()" (ngModelChange)="onlyReturned.set($event)" /> Only attributes returned to OM or VC4</label>
          <span class="flex-1"></span>
          <span class="text-muted-color text-sm">{{ presentCount() }} of {{ totalCount() }} attributes have a value row</span>
          <p-button type="button" icon="pi pi-download" label="Export CSV" size="small" severity="secondary" [outlined]="true" (onClick)="export()" />
        </div>

        @for (s of visibleSections(); track s.sectionId) {
          <p-panel [toggleable]="true" styleClass="mb-3">
            <ng-template #header>
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ s.nameEn || 'Section ' + s.sectionId }}</span>
                @if (s.nameAr) { <span class="text-muted-color" dir="rtl">{{ s.nameAr }}</span> }
                <p-tag [value]="'Section ' + s.sectionId" severity="secondary" />
                <span class="text-muted-color text-sm">{{ s.present }} of {{ s.attributes.length }} set</span>
              </div>
            </ng-template>
            <p-table [value]="s.attributes" size="small" [rowHover]="true" [stripedRows]="true" [resizableColumns]="true" columnResizeMode="expand">
              <ng-template #header>
                <tr>
                  <th pSortableColumn="attId" pResizableColumn>Att id <p-sortIcon field="attId" /></th>
                  <th pSortableColumn="name" pResizableColumn>Attribute <p-sortIcon field="name" /></th>
                  <th pSortableColumn="present" pResizableColumn>On the order <p-sortIcon field="present" /></th>
                  <th pSortableColumn="value" pResizableColumn>Value <p-sortIcon field="value" /></th>
                  <th pSortableColumn="bpmAttId" pResizableColumn>BPM attribute <p-sortIcon field="bpmAttId" /></th>
                  <th pResizableColumn>Returned to</th>
                </tr>
              </ng-template>
              <ng-template #body let-a>
                <tr [class.missing]="!a.present">
                  <td class="mono">{{ a.attId }}</td>
                  <td>{{ a.name }}
                    @if (a.mandatory) { <span class="text-muted-color" title="Mandatory">*</span> }
                    @if (a.label && a.label !== a.name) { <div class="text-muted-color text-sm">{{ a.label }}</div> }
                    @if (!a.defined) { <div class="text-muted-color text-sm">not defined for this request type</div> }
                  </td>
                  <td>
                    @if (a.present) { <p-tag value="Yes" severity="success" /> } @else { <p-tag value="No" severity="secondary" /> }
                  </td>
                  <td class="val">@if (a.value) { {{ a.value }} } @else if (a.present) { <span class="text-muted-color">(empty)</span> } @else { <span class="text-muted-color">—</span> }</td>
                  <td>@if (a.bpmAttId) { <span class="mono">{{ a.bpmAttId }}</span> @if (a.bpmAttName) { <div class="text-sm">{{ a.bpmAttName }}</div> } }</td>
                  <td class="nowrap">
                    @if (a.returnsToOm) { <p-tag value="OM" severity="info" styleClass="mr-1" /> }
                    @if (a.returnsToVc4) { <p-tag value="VC4" severity="warn" [title]="a.vc4AttCode ? 'VC4 code ' + a.vc4AttCode : 'Returned to VC4'" /> }
                    @if (!a.returnsToOm && !a.returnsToVc4) { <span class="text-muted-color">—</span> }
                  </td>
                </tr>
              </ng-template>
              <ng-template #emptymessage><tr><td colspan="6">No attribute matches.</td></tr></ng-template>
            </p-table>
          </p-panel>
        } @empty {
          <p class="text-muted-color">{{ d.sections.length === 0 ? 'No attribute is defined or stored for this work order.' : 'No attribute matches.' }}</p>
        }
      }
    </p-dialog>
  `,
  styles: [`
    .val { white-space: pre-wrap; word-break: break-word; }
    tr.missing td { opacity: .72; }
  `]
})
export class WorkOrderAttributesDialogComponent {
  private readonly api = inject(ApiService);

  /** The work order to show; null keeps the dialog closed. */
  readonly workOrderId = input<string | null>(null);
  readonly closed = output<void>();

  readonly data = signal<WorkOrderAttributes | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly term = signal('');
  readonly onlyMissing = signal(false);
  readonly onlyReturned = signal(false);

  constructor() {
    effect(() => {
      const id = this.workOrderId();
      this.data.set(null);
      this.error.set(null);
      this.term.set('');
      this.onlyMissing.set(false);
      this.onlyReturned.set(false);
      if (id === null) {
        return;
      }
      this.loading.set(true);
      this.api.workOrderAttributes(id).subscribe({
        next: d => { this.data.set(d); this.loading.set(false); },
        error: e => { this.error.set(describeError(e)); this.loading.set(false); }
      });
    });
  }

  readonly presentCount = computed(() => this.all().filter(a => a.present).length);
  readonly totalCount = computed(() => this.all().length);

  /** The sections with only the attributes that pass the search and the two filters; a section left empty is hidden. */
  readonly visibleSections = computed<WorkOrderSection[]>(() => {
    const d = this.data();
    if (!d) {
      return [];
    }
    const q = this.term().trim().toLowerCase();
    const missing = this.onlyMissing();
    const returned = this.onlyReturned();
    const filtering = q !== '' || missing || returned;
    return d.sections
      .map(s => ({
        ...s,
        attributes: s.attributes.filter(a =>
          (!missing || !a.present) && (!returned || a.returnsToOm || a.returnsToVc4) &&
          (q === '' || [String(a.attId), a.name, a.label, a.labelAr, a.code, a.value, s.nameEn, s.nameAr, a.bpmAttId == null ? '' : String(a.bpmAttId), a.bpmAttName]
            .some(v => (v ?? '').toLowerCase().includes(q))))
      }))
      .filter(s => !filtering || s.attributes.length > 0);
  });

  private all(): WorkOrderAttribute[] {
    return (this.data()?.sections ?? []).flatMap(s => s.attributes);
  }

  export(): void {
    const d = this.data();
    if (!d) {
      return;
    }
    const rows = this.visibleSections().flatMap(s => s.attributes.map(a => ({
      sectionId: s.sectionId, section: s.nameEn, attId: a.attId, name: a.name, label: a.label,
      onOrder: a.present ? 'Yes' : 'No', value: a.value, bpmAttId: a.bpmAttId, bpmAttName: a.bpmAttName,
      om: a.returnsToOm ? 'Yes' : 'No', vc4: a.returnsToVc4 ? 'Yes' : 'No', vc4Code: a.vc4AttCode
    })));
    downloadCsv('work-order-' + d.workOrderId + '-attributes', [
      { field: 'sectionId', header: 'Section id' }, { field: 'section', header: 'Section' }, { field: 'attId', header: 'Att id' },
      { field: 'name', header: 'Attribute' }, { field: 'label', header: 'Label' }, { field: 'onOrder', header: 'On the order' },
      { field: 'value', header: 'Value' }, { field: 'bpmAttId', header: 'BPM att id' }, { field: 'bpmAttName', header: 'BPM attribute name' }, { field: 'om', header: 'Returned to OM' },
      { field: 'vc4', header: 'Returned to VC4' }, { field: 'vc4Code', header: 'VC4 code' }
    ], rows);
  }
}
