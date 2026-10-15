import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeError } from '../../core/errors';
import { ActivityRecord, ActivityState, DiagramNode, InstanceDiagram, InstanceSummary, RequestRow } from '../../core/models';
import { activityLook, instanceLook, requestLook } from '../../core/status';
import { DiagramViewComponent } from '../../shared/diagram-view.component';
import { AgePipe, DateTimePipe, DurationPipe } from '../../shared/pipes';
import { RetryButtonComponent } from '../../shared/retry-button.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

type Tab = 'diagram' | 'steps' | 'requests';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [RouterLink, DiagramViewComponent, StatusBadgeComponent, RetryButtonComponent, DateTimePipe, AgePipe, DurationPipe],
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
          @if (auth.can('VIEW_REQUESTS')) {
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
                <app-diagram-view [graph]="g" [overlay]="d.overlay" [selectedId]="selectedId()" (selected)="selectedId.set($event)" />
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
            <div class="table-wrap">
              <table>
                <thead><tr><th>Step</th><th>Status</th><th>Started</th><th>Finished</th></tr></thead>
                <tbody>
                  @for (a of activities(); track a.activityInstanceId) {
                    <tr>
                      <td><span class="mono">{{ a.activityId }}</span> @if (stepName(a.activityId); as nm) { <span class="muted">{{ nm }}</span> }</td>
                      <td><app-status-badge [look]="actLook(statusOf(a))" [text]="a.status" /></td>
                      <td class="nowrap">{{ (a.start || a.creation) | dateTime }}</td>
                      <td class="nowrap">{{ a.finish | dateTime }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (activities().length === 0) { <p class="empty">No steps have run yet.</p> }
          </div>
        }

        @if (tab() === 'requests') {
          <div class="card">
            <p class="muted">Engine requests whose command names this instance. Retrying puts the request back in the queue; the engine picks it up again.</p>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Request</th><th>Type</th><th>Status</th><th>Requested</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  @for (r of requests(); track r.id) {
                    <tr>
                      <td>{{ r.id }}</td>
                      <td>{{ r.type }}</td>
                      <td><app-status-badge [look]="reqLook(r.status)" [text]="r.status" /></td>
                      <td class="nowrap">{{ r.requestDate | dateTime }}</td>
                      <td>{{ r.rejectionReason || r.notes }}</td>
                      <td><app-retry-button [row]="r" [allowed]="auth.can('RETRY_REQUEST')" (retried)="replaceRequest($event)" /></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (requests().length === 0) { <p class="empty">No engine requests found for this instance.</p> }
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
  readonly activities = signal<ActivityRecord[]>([]);
  readonly requests = signal<RequestRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('steps');
  readonly selectedId = signal<string | undefined>(undefined);

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
    if (tab === 'requests' && this.requests().length === 0) {
      this.api.instanceRequests(this.id).subscribe({
        next: r => this.requests.set(r),
        error: e => this.error.set(describeError(e))
      });
    }
  }

  nameOf(activityId: string): string {
    return this.diagram()?.graph?.nodes.find(n => n.activityId === activityId)?.name?.trim() || activityId;
  }

  stepName(activityId: string): string {
    const name = this.diagram()?.graph?.nodes.find(n => n.activityId === activityId)?.name?.trim();
    return name && name !== activityId ? name : '';
  }

  statusOf(a: ActivityRecord) {
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

  replaceRequest(updated: RequestRow): void {
    this.requests.update(list => list.map(r => (r.id === updated.id ? updated : r)));
  }

  private load(): void {
    this.error.set(null);
    this.instance.set(null);
    this.diagram.set(null);
    this.requests.set([]);
    this.selectedId.set(undefined);
    this.api.activities(this.id).subscribe({
      next: a => this.activities.set(a),
      error: e => this.error.set(describeError(e))
    });
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
