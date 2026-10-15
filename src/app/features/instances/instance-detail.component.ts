import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ActivityState, AttributePage, DiagramNode, InstanceDiagram, InstanceSummary, RequestRow, StartForm, StepRow, TimerRequestRow, WorkItemHtml } from '../../core/models';
import { kindLabel } from '../../core/diagram-geometry';
import { PagerComponent } from '../../shared/pager.component';
import { RequestTablesComponent } from '../../shared/request-tables.component';
import { activityLook, instanceLook, requestLook } from '../../core/status';
import { DiagramViewComponent } from '../../shared/diagram-view.component';
import { AgePipe, DateTimePipe, DurationPipe } from '../../shared/pipes';
import { AttributeSectionsComponent } from '../../shared/attribute-sections.component';
import { SavedHtmlComponent } from '../../shared/saved-html.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

type Tab = 'diagram' | 'steps' | 'attributes' | 'requests';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [RequestTablesComponent, PagerComponent, AttributeSectionsComponent, SavedHtmlComponent, RouterLink, DiagramViewComponent, StatusBadgeComponent, DateTimePipe, AgePipe, DurationPipe],
  template: `
    <div class="page">
      <p><a routerLink="/instances">&larr; All instances</a></p>

      @if (error()) { <p class="alert" role="alert">{{ error() }}</p> }

      @if (instance(); as i) {
        <div class="head card">
          <div>
            <h1>{{ i.name || 'Instance ' + i.id }}</h1>
            <p class="sub">#{{ i.id }} &middot; {{ i.processName }} <span class="mono">v{{ i.version }}</span> @if (i.test) { &middot; test instance }</p>
          </div>
          <dl class="facts">
            <div><dt>Status</dt><dd><app-status-badge [look]="instLook(i.status)" [text]="i.status" /></dd></div>
            <div><dt>Started</dt><dd>{{ i.created | dateTime }} <span class="muted">by {{ i.createdBy }}</span></dd></div>
            <div><dt>{{ i.finished ? 'Finished' : 'Open for' }}</dt><dd>@if (i.finished) { {{ i.finished | dateTime }} } @else { {{ i.created | age }} }</dd></div>
            <div><dt>Running steps</dt><dd>{{ i.runningActivities }}</dd></div>
            <div><dt>Failed steps</dt><dd [class.bad]="i.failedActivities > 0">{{ i.failedActivities }}</dd></div>
          </dl>
        </div>

        <div class="tabs" role="tablist">
          @if (auth.can('VIEW_DIAGRAM')) {
            <button class="tab" role="tab" [attr.aria-selected]="tab() === 'diagram'" (click)="show('diagram')">Diagram</button>
          }
          <button class="tab" role="tab" [attr.aria-selected]="tab() === 'steps'" (click)="show('steps')">Steps</button>
          <button class="tab" role="tab" [attr.aria-selected]="tab() === 'attributes'" (click)="show('attributes')">Attributes</button>
          @if (auth.can('VIEW_INSTANCES')) {
            <button class="tab" role="tab" [attr.aria-selected]="tab() === 'requests'" (click)="show('requests')">Engine requests</button>
          }
        </div>

        @if (tab() === 'diagram') {
          @if (diagram(); as d) {
            @if (d.diagramError) {
              <p class="note">{{ d.diagramError }} The steps below are still accurate.</p>
            }
            @if (d.overlay.unknownActivities.length > 0) {
              <p class="note">This instance ran steps that are not on the stored drawing ({{ d.overlay.unknownActivities.join(', ') }}). The instance may have started on an older version of the process.</p>
            }
            @if (d.graph; as g) {
              <div class="split">
                <app-diagram-view [graph]="g" [overlay]="d.overlay" [selectedId]="selectedId()" (selected)="onNode($event)" />
                <aside class="card side" aria-live="polite">
                  @if (selectedNode(); as n) {
                    <h2>{{ n.name || n.activityId }}</h2>
                    <p class="mono muted">{{ n.activityId }}</p>
                    @if (selectedState(); as s) {
                      <p><app-status-badge [look]="actLook(s.status)" />
                        @if (s.overdue) { <span class="badge st-failed">Overdue task</span> }</p>
                      <dl class="facts col">
                        <div><dt>Executions</dt><dd>{{ s.executions }} @if (s.failed > 0) { <span class="bad">({{ s.failed }} failed)</span> }</dd></div>
                        <div><dt>First started</dt><dd>{{ s.firstStart | dateTime }}</dd></div>
                        <div><dt>Last finished</dt><dd>{{ s.lastFinish | dateTime }}</dd></div>
                        <div><dt>Time spent here</dt><dd>{{ s.totalSeconds | duration }}</dd></div>
                        @if (s.running > 0) { <div><dt>Waiting right now</dt><dd>{{ s.currentSeconds | duration }}</dd></div> }
                        @if (s.performers.length > 0) { <div><dt>With</dt><dd>{{ s.performers.join(', ') }}</dd></div> }
                      </dl>
                    } @else {
                      <p class="muted">This instance has not reached this step.</p>
                    }
                  } @else {
                    <p class="muted">Select a step on the diagram to see its history, who holds it and how long it has waited.</p>
                    @if (attention().length > 0) {
                      <h2>Needs a look</h2>
                      <ul class="plain">
                        @for (s of attention(); track s.activityId) {
                          <li><button type="button" class="link" (click)="selectedId.set(s.activityId)">{{ nameOf(s.activityId) }}</button>
                            <span class="muted"> &mdash; {{ actLook(s.status).label }}@if (s.overdue) {, overdue}</span></li>
                        }
                      </ul>
                    }
                  }
                </aside>
              </div>
            }
          } @else if (!error()) {
            <p class="empty" role="status">Loading the diagram&hellip;</p>
          }
        }

        @if (tab() === 'steps') {
          <div class="card">
            <div class="start-form">
              <button type="button" class="btn small" (click)="toggleStartForm()">{{ startOpen() ? 'Hide start form' : 'Start form' }}</button>
              <span class="muted">The form the start event collected.</span>
              @if (startOpen()) {
                @if (startFormError()) {
                  <p class="note" role="status">{{ startFormError() }}</p>
                }
                @if (startForm(); as sf) {
                  <h3>Start form <span class="muted">@if (sf.createdBy) { by {{ sf.createdBy }} } @if (sf.created) { , {{ sf.created | dateTime }} }</span></h3>
                  <app-saved-html [html]="sf.html" />
                } @else if (!startFormError()) {
                  <p class="muted">Loading…</p>
                }
              }
            </div>

            @if (typesOnPage().length > 0) {
              <p class="legend muted">Step types on this page:
                @for (t of typesOnPage(); track t) { <span class="type-tag">{{ t }}</span> }
              </p>
            }
            <div class="table-wrap">
              <table>
                <thead><tr><th>Step</th><th>Type</th><th>Status</th><th>Started</th><th>Finished</th><th></th></tr></thead>
                <tbody>
                  @for (a of activities(); track a.activityInstanceId) {
                    <tr>
                      <td><span class="mono">{{ a.activityId }}</span> @if (stepName(a.activityId); as nm) { <span class="muted">{{ nm }}</span> }</td>
                      <td>@if (typeOf(a); as ty) { <span class="type-tag">{{ ty }}</span> }</td>
                      <td><app-status-badge [look]="actLook(statusOf(a))" [text]="a.status" /></td>
                      <td class="nowrap">{{ (a.start || a.creation) | dateTime }}</td>
                      <td class="nowrap">{{ a.finish | dateTime }}</td>
                      <td><button type="button" class="btn small" (click)="toggleDetails(a.activityInstanceId)">{{ openStep() === a.activityInstanceId ? 'Hide details' : 'Details' }}</button></td>
                    </tr>
                    @if (openStep() === a.activityInstanceId) {
                      <tr>
                        <td colspan="6">
                          @if (stepError()) {
                            <p class="note" role="alert">{{ stepError() }}</p>
                          }
                          @if (stepAttributes(); as pg) {
                            <h3>Attributes of this step</h3>
                            <app-attribute-sections [sections]="pg.sections" emptyText="This step has no attributes." />
                            @if (pg.total > pg.size || pg.page > 0) {
                              <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
                                [sizes]="[25, 50, 100, 200]" (pageChange)="loadStepAttributes($event, pg.size)" (sizeChange)="loadStepAttributes(0, $event)" />
                            }
                          } @else if (!stepError()) {
                            <p class="muted">Loading…</p>
                          }
                          @for (w of stepForms(); track w.workItemId) {
                            <h3>Saved form: {{ w.name || 'work item ' + w.workItemId }}
                              <span class="muted">{{ w.status }}@if (w.finishedBy || w.assignedUser) { , by {{ w.finishedBy || w.assignedUser }} }@if (w.endDate) { , {{ w.endDate | dateTime }} }</span></h3>
                            <app-saved-html [html]="w.html" />
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            @if (activities().length === 0) { <p class="empty">No steps have run yet.</p> }
            <app-pager [total]="stepTotal()" [page]="stepPage()" [size]="stepSize()" noun="steps"
              (pageChange)="loadSteps($event, stepSize())" (sizeChange)="loadSteps(0, $event)" />
          </div>
        }

        @if (tab() === 'attributes') {
          <div class="card">
            <p class="muted">Current attributes of this process instance, grouped by data object.</p>
            @if (processAttributes(); as pg) {
              <app-attribute-sections [sections]="pg.sections" emptyText="This instance has no attributes." />
              <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
                (pageChange)="loadAttributes($event, pg.size)" (sizeChange)="loadAttributes(0, $event)" />
            } @else {
              <p class="muted">Loading…</p>
            }
          </div>
        }

        @if (popup(); as pu) {
          <div class="backdrop" (click)="closePopup()"></div>
          <div class="dialog card" role="dialog" aria-modal="true" [attr.aria-label]="pu.name" tabindex="-1" (keydown.escape)="closePopup()">
            <div class="dialog-head">
              <h2>{{ pu.name }} @if (pu.type) { <span class="type-tag">{{ pu.type }}</span> } <span class="mono muted">{{ pu.activityId }}</span></h2>
              <button type="button" class="btn small" (click)="closePopup()" aria-label="Close">Close</button>
            </div>
            <div class="dialog-body">
              @if (pu.isStart) {
                @if (startFormError()) {
                  <p class="note" role="status">{{ startFormError() }}</p>
                }
                @if (startForm(); as sf) {
                  <h3>Start form <span class="muted">@if (sf.createdBy) { by {{ sf.createdBy }} } @if (sf.created) { , {{ sf.created | dateTime }} }</span></h3>
                  <app-saved-html [html]="sf.html" />
                } @else if (!startFormError()) {
                  <p class="muted">Loading…</p>
                }
              }
              @if (popupLoading()) {
                <p class="muted">Loading…</p>
              } @else if (popupSteps().length === 0 && !pu.isStart) {
                <p class="empty">This step has not run in this instance.</p>
              }
              @if (popupSteps().length > 1) {
                <label class="exec">Execution
                  <select (change)="pickExecution($event)">
                    @for (e of popupSteps(); track e.activityInstanceId; let i = $index) {
                      <option [value]="e.activityInstanceId" [selected]="e.activityInstanceId === openStep()">#{{ i + 1 }} · {{ e.status }} · {{ (e.start || e.creation) | dateTime }}</option>
                    }
                  </select>
                </label>
              }
              @if (openStep() !== null) {
                @if (stepError()) {
                  <p class="note" role="alert">{{ stepError() }}</p>
                }
                @if (stepAttributes(); as pg) {
                  <h3>Attributes</h3>
                  <app-attribute-sections [sections]="pg.sections" emptyText="This step has no attributes." />
                  @if (pg.total > pg.size || pg.page > 0) {
                    <app-pager [total]="pg.total" [page]="pg.page" [size]="pg.size" noun="attributes"
                      (pageChange)="loadStepAttributes($event, pg.size)" (sizeChange)="loadStepAttributes(0, $event)" />
                  }
                } @else if (!stepError()) {
                  <p class="muted">Loading…</p>
                }
                @for (w of stepForms(); track w.workItemId) {
                  <h3>Saved form: {{ w.name || 'work item ' + w.workItemId }}
                    <span class="muted">{{ w.status }}@if (w.finishedBy || w.assignedUser) { , by {{ w.finishedBy || w.assignedUser }} }@if (w.endDate) { , {{ w.endDate | dateTime }} }</span></h3>
                  <app-saved-html [html]="w.html" />
                }
              }
              @if (auth.can('VIEW_INSTANCES')) {
                <app-request-tables [requests]="popupRequests()" [timers]="popupTimers()" [allowRetry]="auth.can('RETRY_REQUEST')" (retried)="replaceRequest($event)" />
              }
            </div>
          </div>
        }

        @if (tab() === 'requests') {
          <div class="card">
            <p class="muted">Engine and timer requests of this instance. Retrying an engine request puts it back in the queue; the engine picks it up again.</p>
            <app-request-tables [requests]="requests()" [timers]="timers()" [allowRetry]="auth.can('RETRY_REQUEST')" (retried)="replaceRequest($event)" />
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0; }
    .facts.col { flex-direction: column; gap: 6px; }
    .facts div { min-width: 90px; }
    dt { font-size: 12px; color: var(--muted); font-weight: 600; }
    dd { margin: 0; }
    .bad { color: var(--c-failed); font-weight: 700; }
    .split { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 12px; align-items: start; }
    @media (max-width: 960px) { .split { grid-template-columns: 1fr; } }
    .side h2 { margin-bottom: 2px; }
    ul.plain { list-style: none; padding: 0; margin: 0; }
    ul.plain li { padding: 3px 0; }
    .start-form { margin-bottom: 12px; }
    .backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 50; }
    .dialog { position: fixed; z-index: 51; top: 5vh; left: 50%; transform: translateX(-50%); width: min(960px, 94vw); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
    .dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .dialog-head h2 { margin: 0; font-size: 16px; }
    .dialog-body { overflow: auto; margin-top: 8px; }
    .exec { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600; }
    .legend { margin: 4px 0 8px; }
    .type-tag { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); margin-right: 4px; white-space: nowrap; }
    .link { font: inherit; background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; text-align: left; }
    .link:hover { text-decoration: underline; }
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
  readonly stepPage = signal(0);
  readonly stepSize = signal(50);
  readonly requests = signal<RequestRow[]>([]);
  readonly timers = signal<TimerRequestRow[]>([]);
  private queuesLoaded = false;
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('steps');
  readonly selectedId = signal<string | undefined>(undefined);
  readonly processAttributes = signal<AttributePage | null>(null);
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
  readonly typesOnPage = computed<string[]>(() =>
    Array.from(new Set(this.activities().map(a => this.typeOf(a)).filter(t => t !== ''))));

  readonly selectedNode = computed<DiagramNode | undefined>(() =>
    this.diagram()?.graph?.nodes.find(n => n.activityId === this.selectedId()));
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

  loadSteps(page: number, size: number): void {
    this.openStep.set(null);
    this.api.activities(this.id, page, size).subscribe({
      next: p => {
        this.activities.set(p.items);
        this.stepTotal.set(p.total);
        this.stepPage.set(p.page);
        this.stepSize.set(p.size);
      },
      error: e => this.error.set(describeError(e))
    });
  }

  loadAttributes(page: number, size: number): void {
    this.api.processAttributes(this.id, page, size).subscribe({
      next: p => this.processAttributes.set(p),
      error: e => this.error.set(describeError(e))
    });
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
  }

  toggleDetails(activityInstanceId: number): void {
    this.stepAttributes.set(null);
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
  onNode(activityId: string | undefined): void {
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
    this.popup.set(null);
    this.openStep.set(null);
    this.stepAttributes.set(null);
    this.stepForms.set([]);
    this.stepError.set(null);
  }

  private showExecution(activityInstanceId: number): void {
    this.stepAttributes.set(null);
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
    this.openStep.set(null);
    this.stepAttributes.set(null);
    this.stepForms.set([]);
    this.stepError.set(null);
    this.startOpen.set(false);
    this.startForm.set(null);
    this.startFormError.set(null);
    this.selectedId.set(undefined);
    this.loadSteps(0, this.stepSize());
    if (this.auth.can('VIEW_DIAGRAM')) {
      this.tab.set('diagram');
      this.api.diagram(this.id).subscribe({
        next: d => { this.diagram.set(d); this.instance.set(d.instance); },
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
