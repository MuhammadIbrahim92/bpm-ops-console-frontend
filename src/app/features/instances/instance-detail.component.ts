import { Component, HostListener, Input, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TableModule, TablePageEvent } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ActivityState, AttributePage, ParentRef, SubProcessLink, TabularTable, DiagramNode, InstanceDiagram, InstanceSummary, RequestRow, StartForm, StepRow, TimerRequestRow, WorkItemHtml } from '../../core/models';
import { kindLabel } from '../../core/diagram-geometry';
import { PagerComponent } from '../../shared/pager.component';
import { downloadCsv } from '../../shared/csv';
import { TableToolsComponent, ToolColumn } from '../../shared/table-tools.component';
import { RequestTablesComponent } from '../../shared/request-tables.component';
import { activityLook, instanceLook, requestLook } from '../../core/status';
import { EMPTY } from 'rxjs';
import { conditionVariables, describeCondition, evaluateCondition } from '../process-explorer/xpdl';
import { SubProcessPanelComponent } from '../../shared/sub-process-panel.component';
import { TabularTablesComponent } from '../../shared/tabular-tables.component';
import { DiagramViewComponent } from '../../shared/diagram-view.component';
import { AgePipe, DateTimePipe, DurationPipe } from '../../shared/pipes';
import { AttributeSectionsComponent } from '../../shared/attribute-sections.component';
import { SavedHtmlComponent } from '../../shared/saved-html.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

type Tab = 'diagram' | 'steps' | 'attributes' | 'requests';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [TableToolsComponent, ButtonModule, DialogModule, MessageModule, TableModule, TabsModule, TagModule, RequestTablesComponent, PagerComponent, AttributeSectionsComponent, TabularTablesComponent, SubProcessPanelComponent, SavedHtmlComponent, RouterLink, DiagramViewComponent, StatusBadgeComponent, DateTimePipe, AgePipe, DurationPipe],
  template: `
    @if (!embedded) {
      <div class="mb-4">
        <p-button label="All instances" icon="pi pi-arrow-left" [text]="true" routerLink="/instances" />
      </div>
    }

    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-4" /> }

    @if (instance(); as i) {
      <div class="card">
        <div class="flex flex-wrap justify-between gap-4">
          <div>
            <div class="font-semibold text-2xl">{{ i.name || 'Instance ' + i.id }}</div>
            <p class="text-muted-color mt-1">#{{ i.id }} &middot; {{ i.processName }} <span class="mono">v{{ i.version }}</span> @if (i.test) { &middot; test instance }</p>
          </div>
          <dl class="facts">
            <div><dt>Status</dt><dd><app-status-badge [look]="instLook(i.status)" [text]="i.status" /></dd></div>
            <div><dt>Started</dt><dd>{{ i.created | dateTime }} <span class="text-muted-color">by {{ i.createdBy }}</span></dd></div>
            <div><dt>{{ i.finished ? 'Finished' : 'Open for' }}</dt><dd>@if (i.finished) { {{ i.finished | dateTime }} } @else { {{ i.created | age }} }</dd></div>
            <div><dt>Running steps</dt><dd>{{ i.runningActivities }}</dd></div>
            <div><dt>Failed steps</dt><dd [class.bad]="i.failedActivities > 0">{{ i.failedActivities }}</dd></div>
          </dl>
        </div>
      </div>

      @if (parent(); as pr) {
        <div class="card flex flex-wrap items-center gap-2">
          <i class="pi pi-sitemap"></i>
          @if (pr.available) {
            <span>This is a sub-process: it was started by
              @if (pr.activityName) { the step <b>{{ pr.activityName }}</b> of } instance
              <a [routerLink]="['/instances', pr.instanceId]">#{{ pr.instanceId }}</a>@if (pr.parentName) { ({{ pr.parentName }}) }.</span>
          } @else {
            <span>This is a sub-process of instance #{{ pr.instanceId }}, which no longer exists or is not visible to you.</span>
          }
        </div>
      }
      <div class="card">
        <p-tabs [value]="tab()" (valueChange)="show($any($event))">
          <p-tablist>
            @if (auth.can('VIEW_DIAGRAM')) { <p-tab value="diagram"><i class="pi pi-sitemap mr-2"></i>Diagram</p-tab> }
            <p-tab value="steps"><i class="pi pi-list mr-2"></i>Steps</p-tab>
            <p-tab value="attributes"><i class="pi pi-database mr-2"></i>Attributes</p-tab>
            @if (auth.can('VIEW_INSTANCES')) { <p-tab value="requests"><i class="pi pi-clock mr-2"></i>Engine requests</p-tab> }
          </p-tablist>
        </p-tabs>

        <div class="mt-4">
        @if (tab() === 'diagram') {
          @if (diagram(); as d) {
            @if (d.diagramError) {
              <p-message severity="warn" [text]="d.diagramError + ' The steps are still accurate.'" styleClass="mb-4" />
            }
            @if (d.overlay.unknownActivities.length > 0) {
              <p-message severity="info" styleClass="mb-4"
                [text]="'This instance ran steps that are not on the stored drawing (' + d.overlay.unknownActivities.join(', ') + '). The instance may have started on an older version of the process.'" />
            }
            @if (d.graph; as g) {
              <div class="split">
                <app-diagram-view [graph]="g" [overlay]="d.overlay" [children]="subLinks()" [compact]="embedded" [selectedId]="selectedId()" (selected)="onNode($event)" [selectedEdgeId]="selectedEdgeId()" (edgePicked)="onEdge($event)" (focused)="focusStep($event)" />
                <aside class="side" aria-live="polite">
                  @if (edgeInfo(); as ei) {
                    <div class="font-semibold text-lg">Arrow</div>
                    <p class="mt-1"><b>{{ ei.from }}</b> <i class="pi pi-arrow-right mx-1"></i> <b>{{ ei.to }}</b></p>
                    @if (ei.name) { <p class="text-muted-color">Named “{{ ei.name }}”</p> }
                    <p class="my-2"><p-tag [value]="ei.taken ? 'Travelled' : 'Not travelled'" [severity]="ei.taken ? 'success' : 'secondary'" /></p>
                    <div class="font-semibold mt-3 mb-1">Condition</div>
                    @if (ei.condition) {
                      <code class="cond">{{ ei.condition }}</code>
                      <p class="text-muted-color mt-1">{{ ei.plain }}</p>
                      @if (ei.vars.length > 0) {
                        <div class="font-semibold mt-3 mb-1">Values it reads</div>
                        @if (edgeValues(); as vals) {
                          <dl class="facts col">
                            @for (v of ei.vars; track v) {
                              <div><dt>{{ v }}</dt><dd>@if (vals[v] !== undefined) { {{ vals[v] }} } @else { <span class="text-muted-color">not set</span> }</dd></div>
                            }
                          </dl>
                          @if (edgeHolds() !== null) {
                            <p class="mt-2">With these values the condition is <b>{{ edgeHolds() ? 'true' : 'false' }}</b>.</p>
                          }
                          <p class="text-muted-color text-sm mt-2">These are the instance's values now. The engine does not keep what they were when this decision was made, so a step that changed them later can make the result differ.</p>
                        } @else {
                          <p class="text-muted-color">Loading the values…</p>
                        }
                      }
                    } @else {
                      <p class="text-muted-color">{{ ei.conditionType === 'OTHERWISE'
                        ? 'Otherwise: taken when no other arrow leaving the same step has a condition that holds.'
                        : 'No condition: the flow always takes this arrow.' }}</p>
                    }
                  } @else if (selectedNode(); as n) {
                    <div class="font-semibold text-lg">{{ n.name || n.activityId }}</div>
                    <p class="mono text-muted-color">{{ n.activityId }}</p>
                    @if (selectedState(); as s) {
                      <p class="my-2"><app-status-badge [look]="actLook(s.status)" />
                        @if (s.overdue) { <p-tag value="Overdue task" severity="danger" styleClass="ml-2" /> }</p>
                      <dl class="facts col">
                        <div><dt>Executions</dt><dd>{{ s.executions }} @if (s.failed > 0) { <span class="bad">({{ s.failed }} failed)</span> }</dd></div>
                        <div><dt>First started</dt><dd>{{ s.firstStart | dateTime }}</dd></div>
                        <div><dt>Last finished</dt><dd>{{ s.lastFinish | dateTime }}</dd></div>
                        <div><dt>Time spent here</dt><dd>{{ s.totalSeconds | duration }}</dd></div>
                        @if (s.running > 0) { <div><dt>Waiting right now</dt><dd>{{ s.currentSeconds | duration }}</dd></div> }
                        @if (s.performers.length > 0) { <div><dt>With</dt><dd>{{ s.performers.join(', ') }}</dd></div> }
                      </dl>
                    } @else {
                      <p class="text-muted-color">This instance has not reached this step.</p>
                    }
                  } @else {
                    <p class="text-muted-color">Click a step on the diagram to see its attributes, saved forms and queue requests.</p>
                    @if (attention().length > 0) {
                      <div class="font-semibold mt-4 mb-2">Needs a look</div>
                      <ul class="plain">
                        @for (s of attention(); track s.activityId) {
                          <li><a href="javascript:void(0)" (click)="onNode(s.activityId)">{{ nameOf(s.activityId) }}</a>
                            <span class="text-muted-color"> &mdash; {{ actLook(s.status).label }}@if (s.overdue) {, overdue}</span></li>
                        }
                      </ul>
                    }
                  }
                </aside>
              </div>
            }
          } @else if (!error()) {
            <p class="text-muted-color" role="status">Loading the diagram&hellip;</p>
          }
        }

        @if (tab() === 'steps') {
          <div class="mb-4">
            <p-button type="button" [label]="startOpen() ? 'Hide start form' : 'Start form'" icon="pi pi-file" severity="secondary"
              [outlined]="true" size="small" (onClick)="toggleStartForm()" />
            <span class="text-muted-color ml-2">The form the start event collected.</span>
            @if (startOpen()) {
              @if (startFormError()) {
                <p-message severity="info" [text]="startFormError()!" styleClass="mt-3" />
              }
              @if (startForm(); as sf) {
                <div class="font-semibold mt-3 mb-2">Start form <span class="text-muted-color font-normal">@if (sf.createdBy) { by {{ sf.createdBy }} } @if (sf.created) { , {{ sf.created | dateTime }} }</span></div>
                <app-saved-html [html]="sf.html" />
              } @else if (!startFormError()) {
                <p class="text-muted-color mt-3">Loading…</p>
              }
            }
          </div>

          @if (typesOnPage().length > 0) {
            <p class="text-muted-color mb-2">Step types on this page:
              @for (t of typesOnPage(); track t) { <p-tag [value]="t" severity="secondary" styleClass="mr-1" /> }
            </p>
          }

          <app-table-tools [columns]="stepColumns" [visible]="stepVisible()" (visibleChange)="stepVisible.set($event)"
            [search]="false" note="Click a column title to sort all steps. Export covers this page."
            (exportCsv)="exportSteps()" (clear)="clearStepSort()" />
          <p-table [value]="activities()" dataKey="activityInstanceId" [lazy]="true" [paginator]="true" [rows]="stepSize()"
            [first]="stepPage() * stepSize()" [totalRecords]="stepTotal()" [rowsPerPageOptions]="[25, 50, 100, 200]"
            [showCurrentPageReport]="true" currentPageReportTemplate="{first} to {last} of {totalRecords} steps"
            [sortField]="stepSortField() ?? undefined" [sortOrder]="stepSortOrder()" [resizableColumns]="true"
            columnResizeMode="expand" [stripedRows]="true" [scrollable]="true"
            [expandedRowKeys]="stepExpanded()" [rowHover]="true" [tableStyle]="{ 'min-width': '50rem' }"
            (onPage)="onStepsPage($event)" (onSort)="onStepsSort($event)">
            <ng-template #header>
              <tr>
                <th style="width: 3rem"></th>
                @if (stepCol('activityId')) { <th pSortableColumn="activityId" pResizableColumn>Step <p-sortIcon field="activityId" /></th> }
                @if (stepCol('taskType')) { <th pSortableColumn="taskType" pResizableColumn>Type <p-sortIcon field="taskType" /></th> }
                @if (stepCol('status')) { <th pSortableColumn="status" pResizableColumn>Status <p-sortIcon field="status" /></th> }
                @if (stepCol('requestUuid')) { <th pSortableColumn="requestUuid" pResizableColumn>Request UUID <p-sortIcon field="requestUuid" /></th> }
                @if (stepCol('start')) { <th pSortableColumn="start" pResizableColumn>Started <p-sortIcon field="start" /></th> }
                @if (stepCol('finish')) { <th pSortableColumn="finish" pResizableColumn>Finished <p-sortIcon field="finish" /></th> }
              </tr>
            </ng-template>
            <ng-template #body let-a let-isOpen="expanded">
              <tr>
                <td>
                  <p-button type="button" [text]="true" [rounded]="true" severity="secondary" size="small"
                    [icon]="isOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" [attr.aria-expanded]="isOpen"
                    (onClick)="toggleDetails(a.activityInstanceId)" />
                </td>
                @if (stepCol('activityId')) { <td><span class="mono">{{ a.activityId }}</span> @if (stepName(a.activityId); as nm) { <span class="text-muted-color ml-2">{{ nm }}</span> }</td> }
                @if (stepCol('taskType')) { <td>@if (typeOf(a); as ty) { <p-tag [value]="ty" severity="secondary" /> }</td> }
                @if (stepCol('status')) { <td><app-status-badge [look]="actLook(statusOf(a))" [text]="a.status" /></td> }
                @if (stepCol('requestUuid')) { <td class="mono">{{ isService(a) ? (a.requestUuid || '-') : '' }}</td> }
                @if (stepCol('start')) { <td class="nowrap">{{ (a.start || a.creation) | dateTime }}</td> }
                @if (stepCol('finish')) { <td class="nowrap">{{ a.finish | dateTime }}</td> }
              </tr>
            </ng-template>
            <ng-template #expandedrow let-a>
              <tr>
                <td [attr.colspan]="stepVisible().length + 1">
                  @if (stepError()) {
                    <p-message severity="error" [text]="stepError()!" />
                  }
                  @if (stepAttributes(); as pg) {
                    <div class="font-semibold mb-2">Attributes of this step</div>
                    <app-attribute-sections [sections]="pg.sections" emptyText="This step has no attributes." />
                    <app-tabular-tables [tables]="stepTables()" [loader]="stepTableLoader" exportName="step-table" />
                    @if (pg.total > pg.size || pg.page > 0) {
                      <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
                        (pageChange)="loadStepAttributes($event, pg.size)" (sizeChange)="loadStepAttributes(0, $event)" />
                    }
                  } @else if (!stepError()) {
                    <p class="text-muted-color">Loading…</p>
                  }
                  @for (w of stepForms(); track w.workItemId) {
                    <div class="font-semibold mt-4 mb-2">Saved form: {{ w.name || 'work item ' + w.workItemId }}
                      <span class="text-muted-color font-normal">{{ w.status }}@if (w.finishedBy || w.assignedUser) { , by {{ w.finishedBy || w.assignedUser }} }@if (w.endDate) { , {{ w.endDate | dateTime }} }</span></div>
                    <app-saved-html [html]="w.html" />
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template #emptymessage>
              <tr><td [attr.colspan]="stepVisible().length + 1">No steps have run yet.</td></tr>
            </ng-template>
          </p-table>
        }

        @if (tab() === 'attributes') {
          <p class="text-muted-color mb-4">Current attributes of this process instance, grouped by data object.</p>
          @if (processAttributes(); as pg) {
            <app-attribute-sections [sections]="pg.sections" emptyText="This instance has no attributes." />
            <app-tabular-tables [tables]="processTables()" [loader]="processTableLoader" exportName="instance-table" />
            <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
              (pageChange)="loadAttributes($event, pg.size)" (sizeChange)="loadAttributes(0, $event)" />
          } @else {
            <p class="text-muted-color">Loading…</p>
          }
        }

        @if (tab() === 'requests') {
          <p class="text-muted-color mb-4">Engine and timer requests of this instance. Retrying an engine request puts it back in the queue; the engine picks it up again.</p>
          <app-request-tables [requests]="requests()" [timers]="timers()" [allowRetry]="auth.can('RETRY_REQUEST')" (retried)="replaceRequest($event)" />
        }
        </div>
      </div>

      <p-dialog [visible]="popup() !== null" (visibleChange)="$event ? null : closePopup()" [modal]="true" [dismissableMask]="true"
        [draggable]="false" [style]="{ width: openChild() ? '90rem' : '64rem', 'max-width': '96vw' }" [contentStyle]="{ 'max-height': '78vh' }">
        <ng-template #header>
          @if (popup(); as pu) {
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold text-lg">{{ pu.name }}</span>
              @if (pu.type) { <p-tag [value]="pu.type" severity="secondary" /> }
              <span class="mono text-muted-color">{{ pu.activityId }}</span>
            </div>
          }
        </ng-template>
        @if (popup(); as pu) {
          @if (popupLinks().length > 0) {
            <app-sub-process-panel [links]="popupLinks()" [openId]="openChild()" (showDetails)="openChild.set($event)" />
            @if (openChild(); as cid) {
              <div class="embedded">
                <app-instance-detail [instanceId]="cid" [embedded]="true" />
              </div>
            }
          }
          @if (pu.isStart) {
            @if (startFormError()) {
              <p-message severity="info" [text]="startFormError()!" styleClass="mb-3" />
            }
            @if (startForm(); as sf) {
              <div class="font-semibold mb-2">Start form <span class="text-muted-color font-normal">@if (sf.createdBy) { by {{ sf.createdBy }} } @if (sf.created) { , {{ sf.created | dateTime }} }</span></div>
              <app-saved-html [html]="sf.html" />
            } @else if (!startFormError()) {
              <p class="text-muted-color">Loading…</p>
            }
          }
          @if (popupLoading()) {
            <p class="text-muted-color">Loading…</p>
          } @else if (popupSteps().length === 0 && !pu.isStart) {
            <p class="text-muted-color">This step has not run in this instance.</p>
          }
          @if (pu.type === 'Service task' && popupSteps().length > 0) {
            <div class="font-semibold mb-2 mt-3">Request UUID</div>
            <ul class="plain mono mb-3">
              @for (e of popupSteps(); track e.activityInstanceId; let ix = $index) {
                <li>@if (popupSteps().length > 1) { <span class="text-muted-color">#{{ ix + 1 }} </span> }{{ e.requestUuid || '-' }}</li>
              }
            </ul>
          }
          @if (popupSteps().length > 1) {
            <label class="flex items-center gap-2 mb-3 font-semibold">Execution
              <select class="border border-surface rounded-border p-2 bg-surface-0 dark:bg-surface-900" (change)="pickExecution($event)">
                @for (e of popupSteps(); track e.activityInstanceId; let ix = $index) {
                  <option [value]="e.activityInstanceId" [selected]="e.activityInstanceId === openStep()">#{{ ix + 1 }} · {{ e.status }} · {{ (e.start || e.creation) | dateTime }}</option>
                }
              </select>
            </label>
          }
          @if (openStep() !== null) {
            @if (stepError()) {
              <p-message severity="error" [text]="stepError()!" styleClass="mb-3" />
            }
            @if (stepAttributes(); as pg) {
              <div class="font-semibold mb-2 mt-3">Attributes</div>
              <app-attribute-sections [sections]="pg.sections" emptyText="This step has no attributes." />
              <app-tabular-tables [tables]="stepTables()" [loader]="stepTableLoader" exportName="step-table" />
              @if (pg.total > pg.size || pg.page > 0) {
                <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
                  (pageChange)="loadStepAttributes($event, pg.size)" (sizeChange)="loadStepAttributes(0, $event)" />
              }
            } @else if (!stepError()) {
              <p class="text-muted-color">Loading…</p>
            }
            @for (w of stepForms(); track w.workItemId) {
              <div class="font-semibold mt-4 mb-2">Saved form: {{ w.name || 'work item ' + w.workItemId }}
                <span class="text-muted-color font-normal">{{ w.status }}@if (w.finishedBy || w.assignedUser) { , by {{ w.finishedBy || w.assignedUser }} }@if (w.endDate) { , {{ w.endDate | dateTime }} }</span></div>
              <app-saved-html [html]="w.html" />
            }
          }
          @if (auth.can('VIEW_INSTANCES')) {
            <app-request-tables [requests]="popupRequests()" [timers]="popupTimers()" [allowRetry]="auth.can('RETRY_REQUEST')" (retried)="replaceRequest($event)" />
          }
        }
      </p-dialog>
    }
`,
  styles: [`
    .embedded { margin-top: 12px; padding: 12px; border: 1px dashed var(--border); border-radius: 10px; }
    .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0; }
    .facts.col { flex-direction: column; gap: 6px; }
    .facts div { min-width: 90px; }
    dt { font-size: 12px; color: var(--muted); font-weight: 600; }
    dd { margin: 0; }
    .bad { color: var(--c-failed); font-weight: 700; }
    .split { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    @media (max-width: 960px) { .split { grid-template-columns: 1fr; } }
    ul.plain { list-style: none; padding: 0; margin: 0; }
    ul.plain li { padding: 3px 0; }
  `]
})
export class InstanceDetailComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly instance = signal<InstanceSummary | null>(null);
  readonly diagram = signal<InstanceDiagram | null>(null);
  readonly activities = signal<StepRow[]>([]);
  readonly stepTotal = signal(0);
  readonly stepSortField = signal<string | null>(null);
  readonly stepSortOrder = signal(1);
  readonly stepColumns: ToolColumn[] = [
    { field: 'activityId', header: 'Step' },
    { field: 'taskType', header: 'Type' },
    { field: 'status', header: 'Status' },
    { field: 'requestUuid', header: 'Request UUID' },
    { field: 'start', header: 'Started' },
    { field: 'finish', header: 'Finished' }
  ];
  readonly stepVisible = signal<string[]>(this.stepColumns.map(c => c.field));
  readonly stepPage = signal(0);
  readonly stepSize = signal(50);
  readonly requests = signal<RequestRow[]>([]);
  readonly timers = signal<TimerRequestRow[]>([]);
  private queuesLoaded = false;
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('steps');
  readonly selectedId = signal<string | undefined>(undefined);
  readonly processAttributes = signal<AttributePage | null>(null);
  readonly processTables = signal<TabularTable[]>([]);
  readonly subLinks = signal<SubProcessLink[]>([]);
  /** The sub-process instance shown in full inside the step popup. */
  readonly openChild = signal<number | null>(null);
  /** Shown inside another page's popup: no back link, a smaller drawing, and the id comes from the host. */
  @Input() embedded = false;
  private fixedId = false;

  @Input() set instanceId(value: number | null) {
    if (value) {
      this.fixedId = true;
      this.id = value;
      this.load();
    }
  }
  readonly parent = signal<ParentRef | null>(null);
  /** The runs of the open step's sub-process, when it is a sub-process step. */
  readonly popupLinks = computed(() => {
    const pu = this.popup();
    return pu ? this.subLinks().filter(l => l.activityId === pu.activityId) : [];
  });
  readonly stepTables = signal<TabularTable[]>([]);
  readonly openStep = signal<number | null>(null);
  readonly stepAttributes = signal<AttributePage | null>(null);
  readonly stepForms = signal<WorkItemHtml[]>([]);
  readonly stepError = signal<string | null>(null);
  readonly startOpen = signal(false);
  readonly popup = signal<{ activityId: string; name: string; type: string; isStart: boolean } | null>(null);
  readonly popupSteps = signal<StepRow[]>([]);
  readonly popupLoading = signal(false);
  readonly startForm = signal<StartForm | null>(null);
  readonly startFormError = signal<string | null>(null);
  /** Queue rows that belong to the clicked step: any of its executions, or the start request for a start event. */
  readonly popupRequests = computed<RequestRow[]>(() => {
    const pu = this.popup();
    const ids = new Set(this.popupSteps().map(s => s.activityInstanceId));
    if (!pu) {
      return [];
    }
    return this.requests().filter(r => {
      const m = /ACT_INST_ID\s*=\s*(\d+)/i.exec(r.command ?? '');
      return m ? ids.has(Number(m[1])) : pu.isStart;
    });
  });
  readonly popupTimers = computed<TimerRequestRow[]>(() => {
    const pu = this.popup();
    const ids = new Set(this.popupSteps().map(s => String(s.activityInstanceId)));
    if (!pu) {
      return [];
    }
    return this.timers().filter(r => r.activityId === pu.activityId || (r.activityInstanceId != null && ids.has(r.activityInstanceId)));
  });
  /** Row expansion state for the steps table: the step whose details are open. */
  readonly stepExpanded = computed<Record<string, boolean>>(() => {
    const open = this.openStep();
    return open === null || this.popup() !== null ? {} : { [open]: true };
  });
  readonly typesOnPage = computed<string[]>(() =>
    Array.from(new Set(this.activities().map(a => this.typeOf(a)).filter(t => t !== ''))));

  readonly selectedNode = computed<DiagramNode | undefined>(() =>
    this.diagram()?.graph?.nodes.find(n => n.activityId === this.selectedId()));
  readonly selectedEdgeId = signal<string | undefined>(undefined);
  /** Current values of the attributes the selected arrow's condition reads; null while they load. */
  readonly edgeValues = signal<Record<string, string | undefined> | null>(null);
  readonly edgeInfo = computed(() => {
    const d = this.diagram();
    const e = d?.graph?.edges.find(x => x.id === this.selectedEdgeId());
    if (!d?.graph || !e) {
      return null;
    }
    const nameOf = (id: string) => d.graph!.nodes.find(n => n.activityId === id)?.name?.trim() || id;
    return {
      from: nameOf(e.sourceActivityId),
      to: nameOf(e.targetActivityId),
      name: e.name ?? '',
      condition: e.condition ?? null,
      conditionType: e.conditionType ?? null,
      plain: e.condition ? describeCondition(e.condition) : '',
      vars: e.condition ? conditionVariables(e.condition) : [],
      taken: d.overlay.takenEdges.includes(e.id)
    };
  });
  /** Whether the selected arrow's condition holds for the current values (null when it cannot be worked out). */
  readonly edgeHolds = computed<boolean | null>(() => {
    const info = this.edgeInfo();
    const vals = this.edgeValues();
    if (!info?.condition || !vals) {
      return null;
    }
    const known: Record<string, string> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v !== undefined) {
        known[k] = v;
      }
    }
    return evaluateCondition(info.condition, known);
  });
  readonly selectedState = computed<ActivityState | undefined>(() =>
    this.diagram()?.overlay.activities.find(a => a.activityId === this.selectedId()));
  readonly attention = computed<ActivityState[]>(() =>
    (this.diagram()?.overlay.activities ?? []).filter(a =>
      a.status === 'FAILED' || a.status === 'TIMEOUT' || a.status === 'SUSPENDED' || a.overdue));

  instLook = instanceLook;
  actLook = activityLook;
  reqLook = requestLook;

  private id = 0;

  ngOnInit(): void {
    if (this.fixedId) {
      return;
    }
    this.route.paramMap.subscribe(p => {
      this.id = Number(p.get('id'));
      this.load();
    });
  }

  show(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'attributes' && this.processAttributes() === null) {
      this.loadAttributes(0, 50);
    }
    if (tab === 'requests') {
      this.ensureQueues();
    }
  }

  /** Loads the engine and timer queue rows of this instance once (operations only). */
  private ensureQueues(): void {
    if (this.queuesLoaded || !this.auth.can('VIEW_INSTANCES')) {
      return;
    }
    this.queuesLoaded = true;
    this.api.instanceRequests(this.id).subscribe({
      next: r => this.requests.set(r),
      error: e => this.error.set(describeError(e))
    });
    this.api.instanceTimerRequests(this.id).subscribe({
      next: r => this.timers.set(r),
      error: e => this.error.set(describeError(e))
    });
  }

  nameOf(activityId: string): string {
    return this.diagram()?.graph?.nodes.find(n => n.activityId === activityId)?.name?.trim() || activityId;
  }

  stepName(activityId: string): string {
    const name = this.diagram()?.graph?.nodes.find(n => n.activityId === activityId)?.name?.trim();
    return name && name !== activityId ? name : '';
  }

  statusOf(a: StepRow) {
    // The overlay already normalises the engine's spellings; for the plain list map the common ones here.
    switch ((a.status ?? '').trim().toUpperCase()) {
      case 'RUNNING': case 'STARTED': return 'RUNNING' as const;
      case 'COMPLETED': case 'FINISHED': return 'COMPLETED' as const;
      case 'INTI': case 'INIT': case 'NOT STARTED': return 'PENDING' as const;
      case 'SUSPENDED': return 'SUSPENDED' as const;
      case 'FAILD': case 'FAILED': return 'FAILED' as const;
      case 'TIMEOUT': return 'TIMEOUT' as const;
      default: return 'UNKNOWN' as const;
    }
  }

  onStepsPage(e: TablePageEvent): void {
    this.loadSteps(Math.floor(e.first / e.rows), e.rows);
  }

  stepCol(field: string): boolean {
    return this.stepVisible().includes(field);
  }

  onStepsSort(e: { field: string; order: number }): void {
    this.stepSortField.set(e.field);
    this.stepSortOrder.set(e.order);
    this.loadSteps(0, this.stepSize());
  }

  clearStepSort(): void {
    this.stepSortField.set(null);
    this.stepSortOrder.set(1);
    this.loadSteps(0, this.stepSize());
  }

  exportSteps(): void {
    downloadCsv(`instance-${this.id}-steps`, [
      { field: 'activityInstanceId', header: 'Activity instance' }, { field: 'activityId', header: 'Step' },
      { field: 'taskType', header: 'Task type' }, { field: 'status', header: 'Status' },
      { field: 'requestUuid', header: 'Request UUID' }, { field: 'creation', header: 'Created' }, { field: 'start', header: 'Started' },
      { field: 'finish', header: 'Finished' }
    ], this.activities());
  }

  loadSteps(page: number, size: number): void {
    this.openStep.set(null);
    this.api.activities(this.id, page, size, undefined, this.stepSortField() ?? undefined,
      this.stepSortOrder() < 0 ? 'desc' : 'asc').subscribe({
      next: p => {
        this.activities.set(p.items);
        this.stepTotal.set(p.total);
        this.stepPage.set(p.page);
        this.stepSize.set(p.size);
      },
      error: e => this.error.set(describeError(e))
    });
  }

  /** Reads further pages of rows for the tables of the instance and of the open step. */
  readonly processTableLoader = (doId: number, page: number, size: number) => this.api.processTable(this.id, doId, page, size);
  readonly stepTableLoader = (doId: number, page: number, size: number) => {
    const open = this.openStep();
    return open === null ? EMPTY : this.api.stepTable(this.id, open, doId, page, size);
  };

  loadAttributes(page: number, size: number): void {
    this.api.processAttributes(this.id, page, size).subscribe({
      next: p => this.processAttributes.set(p),
      error: e => this.error.set(describeError(e))
    });
    if (page === 0 && this.processTables().length === 0) {
      this.api.processTables(this.id).subscribe({
        next: t => this.processTables.set(t),
        error: e => this.error.set(describeError(e))
      });
    }
  }

  loadStepAttributes(page: number, size: number): void {
    const open = this.openStep();
    if (open === null) {
      return;
    }
    this.api.stepAttributes(this.id, open, page, size).subscribe({
      next: p => { if (this.openStep() === open) { this.stepAttributes.set(p); } },
      error: e => this.stepError.set(describeError(e))
    });
    if (page === 0) {
      this.api.stepTables(this.id, open).subscribe({
        next: t => { if (this.openStep() === open) { this.stepTables.set(t); } },
        error: e => this.stepError.set(describeError(e))
      });
    }
  }

  toggleDetails(activityInstanceId: number): void {
    this.stepAttributes.set(null);
    this.stepTables.set([]);
    this.stepForms.set([]);
    this.stepError.set(null);
    if (this.openStep() === activityInstanceId) {
      this.openStep.set(null);
      return;
    }
    this.openStep.set(activityInstanceId);
    this.loadStepAttributes(0, 50);
    this.api.stepForms(this.id, activityInstanceId).subscribe({
      next: f => { if (this.openStep() === activityInstanceId) { this.stepForms.set(f); } },
      error: e => this.stepError.set(describeError(e))
    });
  }

  /** A click on a diagram node: select it and show its attributes and saved HTML in a popup. */
  /** A click on an arrow: show its condition and the values it reads. */
  onEdge(edgeId: string): void {
    this.selectedEdgeId.set(edgeId);
    this.selectedId.set(undefined);
    this.edgeValues.set(null);
    const edge = this.diagram()?.graph?.edges.find(x => x.id === edgeId);
    const names = edge?.condition ? conditionVariables(edge.condition) : [];
    if (names.length === 0) {
      this.edgeValues.set({});
      return;
    }
    this.api.attributeValues(this.id, names).subscribe({
      next: list => {
        if (this.selectedEdgeId() === edgeId) {
          this.edgeValues.set(Object.fromEntries(list.map(a => [a.name, a.value ?? 'null'])));
        }
      },
      error: () => { if (this.selectedEdgeId() === edgeId) { this.edgeValues.set({}); } }
    });
  }

  /** Moving the highlight from the diagram (find, issues, following the run, a click on empty space). */
  focusStep(activityId: string): void {
    this.selectedEdgeId.set(undefined);
    this.selectedId.set(activityId || undefined);
  }

  onNode(activityId: string | undefined): void {
    this.selectedEdgeId.set(undefined);
    this.openChild.set(null);
    this.selectedId.set(activityId);
    if (!activityId) {
      return;
    }
    const node = this.diagram()?.graph?.nodes.find(n => n.activityId === activityId);
    const isStart = node?.kind === 'START';
    this.popup.set({
      activityId,
      name: node?.name?.trim() || activityId,
      type: node ? kindLabel(node.kind) : '',
      isStart
    });
    this.popupSteps.set([]);
    this.ensureQueues();
    this.popupLoading.set(true);
    this.openStep.set(null);
    this.stepAttributes.set(null);
    this.stepTables.set([]);
    this.stepForms.set([]);
    this.stepError.set(null);
    if (isStart) {
      this.loadStartForm();
    }
    this.api.activities(this.id, 0, 200, activityId).subscribe({
      next: p => {
        if (this.popup()?.activityId !== activityId) {
          return;
        }
        this.popupSteps.set(p.items);
        this.popupLoading.set(false);
        if (p.items.length > 0) {
          this.showExecution(p.items[p.items.length - 1].activityInstanceId);
        }
      },
      error: e => { this.popupLoading.set(false); this.stepError.set(describeError(e)); }
    });
  }

  pickExecution(e: Event): void {
    this.showExecution(Number((e.target as HTMLSelectElement).value));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.popup()) {
      this.closePopup();
    }
  }

  closePopup(): void {
    this.openChild.set(null);
    this.popup.set(null);
    this.openStep.set(null);
    this.stepAttributes.set(null);
    this.stepTables.set([]);
    this.stepForms.set([]);
    this.stepError.set(null);
  }

  private showExecution(activityInstanceId: number): void {
    this.stepAttributes.set(null);
    this.stepTables.set([]);
    this.stepForms.set([]);
    this.stepError.set(null);
    this.openStep.set(activityInstanceId);
    this.loadStepAttributes(0, 50);
    this.api.stepForms(this.id, activityInstanceId).subscribe({
      next: f => { if (this.openStep() === activityInstanceId) { this.stepForms.set(f); } },
      error: e => this.stepError.set(describeError(e))
    });
  }

  private loadStartForm(): void {
    if (this.startForm() === null && this.startFormError() === null) {
      this.api.startForm(this.id).subscribe({
        next: f => this.startForm.set(f),
        error: e => this.startFormError.set(e?.status === 404 ? 'This instance has no saved start form.' : describeError(e))
      });
    }
  }

  toggleStartForm(): void {
    if (this.startOpen()) {
      this.startOpen.set(false);
      return;
    }
    this.startOpen.set(true);
    if (this.startForm() === null && this.startFormError() === null) {
      this.api.startForm(this.id).subscribe({
        next: f => this.startForm.set(f),
        error: e => this.startFormError.set(e?.status === 404 ? 'This instance has no saved start form.' : describeError(e))
      });
    }
  }

  /** A service task: the diagram says so (or the type label does). The REQUEST_UUID is shown for these. */
  isService(a: StepRow): boolean {
    return this.typeOf(a) === 'Service task';
  }

  /** Task type annotation: the drawing's node type when known, else the work item task type. */
  typeOf(a: StepRow): string {
    const node = this.diagram()?.graph?.nodes.find(n => n.activityId === a.activityId);
    const label = node ? kindLabel(node.kind) : '';
    if (label) {
      return label;
    }
    return a.taskType ? `${a.taskType.charAt(0).toUpperCase()}${a.taskType.slice(1).toLowerCase()} task` : '';
  }

  replaceRequest(updated: RequestRow): void {
    this.requests.update(list => list.map(r => (r.id === updated.id ? updated : r)));
  }

  private load(): void {
    this.error.set(null);
    this.instance.set(null);
    this.diagram.set(null);
    this.requests.set([]);
    this.timers.set([]);
    this.queuesLoaded = false;
    this.processAttributes.set(null);
    this.processTables.set([]);
    this.openStep.set(null);
    this.stepAttributes.set(null);
    this.stepTables.set([]);
    this.stepForms.set([]);
    this.stepError.set(null);
    this.startOpen.set(false);
    this.startForm.set(null);
    this.startFormError.set(null);
    this.selectedId.set(undefined);
    this.selectedEdgeId.set(undefined);
    this.subLinks.set([]);
    this.parent.set(null);
    this.api.parentOf(this.id).subscribe({ next: p => this.parent.set(p), error: () => this.parent.set(null) });
    this.loadSteps(0, this.stepSize());
    if (this.auth.can('VIEW_DIAGRAM')) {
      this.tab.set('diagram');
      this.api.diagram(this.id).subscribe({
        next: d => {
          this.diagram.set(d);
          this.instance.set(d.instance);
          if (d.graph?.nodes.some(n => n.kind === 'SUB_PROCESS' || n.subProcessId)) {
            this.api.subProcesses(this.id).subscribe({ next: l => this.subLinks.set(l), error: () => this.subLinks.set([]) });
          }
        },
        error: e => this.error.set(describeError(e))
      });
    } else {
      this.tab.set('steps');
      this.api.instance(this.id).subscribe({
        next: i => this.instance.set(i),
        error: e => this.error.set(describeError(e))
      });
    }
  }
}
