import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule, TablePageEvent } from 'primeng/table';
import { ApiService, WorkOrderQuery } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { WorkOrderTask } from '../../core/models';
import { WorkOrderAttributesDialogComponent } from './work-order-attributes-dialog.component';
import { downloadCsv } from '../../shared/csv';
import { DateTimePipe } from '../../shared/pipes';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';

/**
 * The tasks created for work orders: work order (WF_WORK_ORDER), its items (WF_WORK_ORDER_ITEM) and their tasks
 * (WF_WORK) in one list. The instance and the related instance of a task open the instance tracking page.
 */
@Component({
  selector: 'app-work-order-tasks',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, TableModule,
    TableToolsComponent, DateTimePipe, WorkOrderAttributesDialogComponent],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1"><i class="pi pi-briefcase mr-2"></i>Work order tasks</div>
      <p class="text-muted-color mb-4">Every task created for a work order. Click the instance or the related instance of a task to see its tracking.</p>

      <form class="grid grid-cols-12 gap-4 items-end" (ngSubmit)="search()">
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="wo">Work order ID</label>
          <input pInputText id="wo" name="wo" [(ngModel)]="f.workOrderId" placeholder="e.g. 9937061" fluid />
        </div>
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="inst">Instance or related instance</label>
          <input pInputText id="inst" name="inst" type="number" [(ngModel)]="f.instanceId" placeholder="instance id" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="wos">Work order status</label>
          <p-select inputId="wos" name="wos" [(ngModel)]="f.woStatus" [options]="woStatuses()" placeholder="Any" [showClear]="true" fluid />
        </div>
        <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
          <label for="ts">Task status</label>
          <p-select inputId="ts" name="ts" [(ngModel)]="f.taskStatus" [options]="taskStatuses()" placeholder="Any" [showClear]="true" fluid />
        </div>
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="spec">Task (work spec)</label>
          <input pInputText id="spec" name="spec" [(ngModel)]="f.workSpec" placeholder="e.g. Cabinet Work" fluid />
        </div>
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="req">Request type</label>
          <input pInputText id="req" name="req" [(ngModel)]="f.requestType" placeholder="e.g. FTTH Survey" fluid />
        </div>
        <div class="col-span-12 md:col-span-2 flex flex-col gap-2">
          <label for="owner">Owner</label>
          <input pInputText id="owner" name="owner" [(ngModel)]="f.owner" fluid />
        </div>
        <div class="col-span-6 md:col-span-2 flex flex-col gap-2">
          <label for="from">Initiated from</label>
          <input pInputText id="from" name="from" type="date" [(ngModel)]="f.from" fluid />
        </div>
        <div class="col-span-6 md:col-span-2 flex flex-col gap-2">
          <label for="to">Initiated to</label>
          <input pInputText id="to" name="to" type="date" [(ngModel)]="f.to" fluid />
        </div>
        <div class="col-span-12 flex gap-2">
          <p-button type="submit" label="Search" icon="pi pi-search" />
          <p-button type="button" label="Clear" severity="secondary" [outlined]="true" (onClick)="reset()" />
        </div>
      </form>
    </div>

    <div class="card">
      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }
      <app-table-tools [columns]="columns" [visible]="visible()" (visibleChange)="visible.set($event)" [search]="false"
        note="Click a column title to sort the whole result. Export covers this page." (exportCsv)="export()" (clear)="reset()" />
      <p-table [value]="items()" dataKey="workId" [lazy]="true" [loading]="loading()" [paginator]="true" [rows]="size()"
        [first]="page() * size()" [totalRecords]="total()" [rowsPerPageOptions]="[25, 50, 100, 200]"
        [showCurrentPageReport]="true" currentPageReportTemplate="{first} to {last} of {totalRecords} tasks"
        [sortField]="sortField() ?? undefined" [sortOrder]="sortOrder()" [resizableColumns]="true" columnResizeMode="expand"
        [stripedRows]="true" [rowHover]="true" [scrollable]="true" [tableStyle]="{ 'min-width': '70rem' }"
        (onPage)="onPage($event)" (onSort)="onSort($event)">
        <ng-template #header>
          <tr>
            @if (show('workOrderId')) { <th pSortableColumn="workOrderId" pResizableColumn>Work order <p-sortIcon field="workOrderId" /></th> }
            @if (show('woStatus')) { <th pSortableColumn="woStatus" pResizableColumn>Order status <p-sortIcon field="woStatus" /></th> }
            @if (show('requestType')) { <th pSortableColumn="requestType" pResizableColumn>Request type <p-sortIcon field="requestType" /></th> }
            @if (show('initiated')) { <th pSortableColumn="initiated" pResizableColumn>Initiated <p-sortIcon field="initiated" /></th> }
            @if (show('sequence')) { <th pSortableColumn="sequence" pResizableColumn class="text-right">Item <p-sortIcon field="sequence" /></th> }
            @if (show('workId')) { <th pSortableColumn="workId" pResizableColumn>Task id <p-sortIcon field="workId" /></th> }
            @if (show('workSpec')) { <th pSortableColumn="workSpec" pResizableColumn>Task <p-sortIcon field="workSpec" /></th> }
            @if (show('status')) { <th pSortableColumn="status" pResizableColumn>Task status <p-sortIcon field="status" /></th> }
            @if (show('owner')) { <th pSortableColumn="owner" pResizableColumn>Owner <p-sortIcon field="owner" /></th> }
            @if (show('currentActivity')) { <th pResizableColumn>Current activity</th> }
            @if (show('generated')) { <th pSortableColumn="generated" pResizableColumn>Generated <p-sortIcon field="generated" /></th> }
            @if (show('ended')) { <th pResizableColumn>Ended</th> }
            @if (show('instanceId')) { <th pSortableColumn="instanceId" pResizableColumn>Instance <p-sortIcon field="instanceId" /></th> }
            @if (show('relatedInstance')) { <th pSortableColumn="relatedInstance" pResizableColumn>Related instance <p-sortIcon field="relatedInstance" /></th> }
            @if (show('relatedTask')) { <th pResizableColumn>Related task</th> }
            <th style="width:5rem">Attributes</th>
          </tr>
        </ng-template>
        <ng-template #body let-r>
          <tr>
            @if (show('workOrderId')) { <td class="nowrap"><a href="#" (click)="byWorkOrder($event, r.workOrderId)" title="Show only this work order">{{ r.workOrderId }}</a></td> }
            @if (show('woStatus')) { <td>{{ r.woStatus }}@if (r.woStage) { <span class="text-muted-color"> · {{ r.woStage }}</span> }</td> }
            @if (show('requestType')) { <td>{{ r.requestType }}</td> }
            @if (show('initiated')) { <td class="nowrap">{{ r.initiated | dateTime }}</td> }
            @if (show('sequence')) { <td class="text-right">{{ r.itemSequence }}</td> }
            @if (show('workId')) { <td class="mono">{{ r.workId }}</td> }
            @if (show('workSpec')) { <td>{{ r.workSpec }}</td> }
            @if (show('status')) { <td>{{ r.status }}@if (r.statusName) { <span class="text-muted-color"> · {{ r.statusName }}</span> }</td> }
            @if (show('owner')) { <td>{{ r.owner }}</td> }
            @if (show('currentActivity')) { <td>{{ r.currentActivity }}</td> }
            @if (show('generated')) { <td class="nowrap">{{ r.generated | dateTime }}</td> }
            @if (show('ended')) { <td class="nowrap">{{ r.ended | dateTime }}</td> }
            @if (show('instanceId')) {
              <td class="nowrap">
                @if (r.instanceId && r.instanceKnown) { <a [routerLink]="['/instances', r.instanceId]" title="Open the instance tracking">{{ r.instanceId }}</a> }
                @else if (r.instanceId) { <span class="text-muted-color" title="This instance is no longer in the engine tables">{{ r.instanceId }}</span> }
              </td>
            }
            @if (show('relatedInstance')) {
              <td class="nowrap">
                @if (r.relatedInstance && r.relatedKnown) { <a [routerLink]="['/instances', r.relatedInstance]" title="Open the instance tracking">{{ r.relatedInstance }}</a> }
                @else if (r.relatedInstance) { <span class="text-muted-color" title="This instance is no longer in the engine tables">{{ r.relatedInstance }}</span> }
              </td>
            }
            @if (show('relatedTask')) { <td class="mono">{{ r.relatedTask }}</td> }
            <td class="text-center">
              <p-button type="button" icon="pi pi-list" size="small" severity="secondary" [text]="true" (onClick)="attributesOf.set(r.workOrderId)"
                [ariaLabel]="'Additional attributes of work order ' + r.workOrderId" [title]="'Additional attributes of work order ' + r.workOrderId" />
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td [attr.colspan]="(visible().length || 1) + 1">No work order task matches.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <app-work-order-attributes-dialog [workOrderId]="attributesOf()" (closed)="attributesOf.set(null)" />
  `
})
export class WorkOrderTasksComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly columns: ToolColumn[] = [
    { field: 'workOrderId', header: 'Work order' },
    { field: 'woStatus', header: 'Order status' },
    { field: 'requestType', header: 'Request type' },
    { field: 'initiated', header: 'Initiated' },
    { field: 'sequence', header: 'Item' },
    { field: 'workId', header: 'Task id' },
    { field: 'workSpec', header: 'Task' },
    { field: 'status', header: 'Task status' },
    { field: 'owner', header: 'Owner' },
    { field: 'currentActivity', header: 'Current activity' },
    { field: 'generated', header: 'Generated' },
    { field: 'ended', header: 'Ended' },
    { field: 'instanceId', header: 'Instance' },
    { field: 'relatedInstance', header: 'Related instance' },
    { field: 'relatedTask', header: 'Related task' }
  ];
  readonly visible = signal<string[]>(
    this.columns.map(c => c.field).filter(x => !['currentActivity', 'ended', 'relatedTask', 'sequence'].includes(x))
  );

  readonly size = signal(50);
  /** The work order whose additional attributes are open in the dialog. */
  readonly attributesOf = signal<string | null>(null);
  readonly items = signal<WorkOrderTask[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly woStatuses = signal<string[]>([]);
  readonly taskStatuses = signal<string[]>([]);

  f = this.blank();

  show(field: string): boolean {
    return this.visible().includes(field);
  }

  ngOnInit(): void {
    this.api.workOrderOptions().subscribe({
      next: o => { this.woStatuses.set(o.workOrderStatuses ?? []); this.taskStatuses.set(o.taskStatuses ?? []); },
      error: () => undefined
    });
    this.route.queryParamMap.subscribe(q => {
      this.f = {
        workOrderId: q.get('workOrderId') ?? '',
        instanceId: q.get('instanceId') ? Number(q.get('instanceId')) : null,
        woStatus: q.get('woStatus') ?? '',
        taskStatus: q.get('taskStatus') ?? '',
        workSpec: q.get('workSpec') ?? '',
        requestType: q.get('requestType') ?? '',
        owner: q.get('owner') ?? '',
        from: q.get('from') ?? '',
        to: q.get('to') ?? ''
      };
      this.page.set(q.get('page') ? Math.max(0, Number(q.get('page'))) : 0);
      const sz = Number(q.get('size'));
      this.size.set(sz >= 1 && sz <= 200 ? sz : 50);
      this.sortField.set(q.get('sort'));
      this.sortOrder.set(q.get('dir') === 'desc' ? -1 : 1);
      this.load();
    });
  }

  search(): void {
    this.navigate(0, this.size());
  }

  reset(): void {
    this.f = this.blank();
    this.sortField.set(null);
    this.sortOrder.set(1);
    this.navigate(0, this.size());
  }

  byWorkOrder(event: Event, id: string): void {
    event.preventDefault();
    this.f = { ...this.blank(), workOrderId: id };
    this.navigate(0, this.size());
  }

  onPage(e: TablePageEvent): void {
    this.navigate(Math.floor(e.first / e.rows), e.rows);
  }

  onSort(e: { field: string; order: number }): void {
    this.sortField.set(e.field);
    this.sortOrder.set(e.order);
    this.navigate(0, this.size());
  }

  export(): void {
    downloadCsv('work-order-tasks', [
      { field: 'workOrderId', header: 'Work order' }, { field: 'woStatus', header: 'Order status' }, { field: 'woStage', header: 'Order stage' },
      { field: 'requestType', header: 'Request type' }, { field: 'initiated', header: 'Initiated' },
      { field: 'woItemId', header: 'Item id' }, { field: 'itemSequence', header: 'Item sequence' },
      { field: 'workId', header: 'Task id' }, { field: 'workSpec', header: 'Task' }, { field: 'status', header: 'Task status' },
      { field: 'statusName', header: 'Status name' }, { field: 'owner', header: 'Owner' },
      { field: 'currentActivity', header: 'Current activity' }, { field: 'generated', header: 'Generated' },
      { field: 'started', header: 'Started' }, { field: 'ended', header: 'Ended' },
      { field: 'instanceId', header: 'Instance' }, { field: 'relatedInstance', header: 'Related instance' },
      { field: 'relatedTask', header: 'Related task' }
    ], this.items());
  }

  private navigate(page: number, size: number): void {
    const f = this.f;
    this.router.navigate([], {
      queryParams: {
        workOrderId: f.workOrderId || null,
        instanceId: f.instanceId,
        woStatus: f.woStatus || null,
        taskStatus: f.taskStatus || null,
        workSpec: f.workSpec || null,
        requestType: f.requestType || null,
        owner: f.owner || null,
        from: f.from || null,
        to: f.to || null,
        sort: this.sortField(),
        dir: this.sortField() && this.sortOrder() < 0 ? 'desc' : null,
        page: page > 0 ? page : null,
        size: size !== 50 ? size : null
      }
    });
  }

  private load(): void {
    const f = this.f;
    const q: WorkOrderQuery = {
      workOrderId: f.workOrderId, instanceId: f.instanceId, woStatus: f.woStatus, taskStatus: f.taskStatus,
      workSpec: f.workSpec, requestType: f.requestType, owner: f.owner, from: f.from, to: f.to,
      page: this.page(), size: this.size(), sort: this.sortField() ?? undefined, dir: this.sortOrder() < 0 ? 'desc' : 'asc'
    };
    this.loading.set(true);
    this.error.set(null);
    this.api.workOrderTasks(q).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); },
      error: e => { this.error.set(describeError(e)); this.items.set([]); this.total.set(0); this.loading.set(false); }
    });
  }

  private blank() {
    return {
      workOrderId: '', instanceId: null as number | null, woStatus: '', taskStatus: '', workSpec: '', requestType: '',
      owner: '', from: '', to: ''
    };
  }
}
