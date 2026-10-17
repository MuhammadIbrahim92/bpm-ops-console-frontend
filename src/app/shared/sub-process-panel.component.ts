import { Component, Input, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/errors';
import { InstanceDiagram, SubProcessLink } from '../core/models';
import { instanceLook } from '../core/status';
import { DiagramViewComponent } from './diagram-view.component';
import { DateTimePipe } from './pipes';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * The sub-process instances started by one step of the instance: one row per run of the step, with the instance it
 * started (found exactly, never guessed), a button to see its tracking here, and a link to open it in a new tab.
 */
@Component({
  selector: 'app-sub-process-panel',
  standalone: true,
  imports: [ButtonModule, MessageModule, DiagramViewComponent, StatusBadgeComponent, DateTimePipe],
  template: `
    <div class="font-semibold mb-2"><i class="pi pi-sitemap mr-1"></i>Sub-process</div>
    @for (l of links; track l.activityInstanceId; let ix = $index) {
      <div class="run">
        <div class="flex flex-wrap items-center gap-2">
          @if (links.length > 1) { <span class="text-muted-color">Run {{ ix + 1 }}</span> }
          <span class="text-muted-color">started {{ l.start | dateTime }}</span>
          @if (l.child; as c) {
            <b>#{{ c.id }}</b>
            <app-status-badge [look]="look(c.status)" />
            @if (c.failedActivities > 0) { <span class="bad">{{ c.failedActivities }} failed step{{ c.failedActivities === 1 ? '' : 's' }}</span> }
            @if (c.runningActivities > 0) { <span class="text-muted-color">{{ c.runningActivities }} running</span> }
            <span class="text-muted-color">{{ c.processName }} · {{ c.version }}@if (l.configuredVersion && l.configuredVersion !== c.version) { (the drawing names {{ l.configuredVersion }}) }</span>
            <span class="flex-1"></span>
            <p-button type="button" [label]="open().has(c.id) ? 'Hide tracking' : 'Show tracking'" icon="pi pi-sitemap" size="small"
              severity="secondary" [outlined]="true" (onClick)="toggle(c.id)" />
            <a class="p-button p-button-sm p-button-outlined" [href]="'#/instances/' + c.id" target="_blank" rel="noopener">
              <i class="pi pi-external-link mr-2"></i>Open in new tab</a>
          } @else if (l.hidden) {
            <span class="text-muted-color">A sub-process instance was started, but you may not view it.</span>
          } @else {
            <span class="text-muted-color">No sub-process instance is recorded for this run.</span>
          }
        </div>
        @if (l.child; as c) {
          @if (open().has(c.id)) {
            <div class="mt-3">
              @if (errors()[c.id]) {
                <p-message severity="error" [text]="errors()[c.id]" />
              } @else if (diagrams()[c.id]; as d) {
                @if (d.graph; as g) {
                  <app-diagram-view [graph]="g" [overlay]="d.overlay" [compact]="true" />
                } @else {
                  <p-message severity="warn" [text]="(d.diagramError || 'The drawing is not available.') + ' Open the instance to see its steps.'" />
                }
              } @else {
                <p class="text-muted-color">Loading the tracking…</p>
              }
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    .run { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .bad { color: var(--c-failed); font-weight: 600; }
    a.p-button { text-decoration: none; display: inline-flex; align-items: center; }
  `]
})
export class SubProcessPanelComponent {
  private readonly api = inject(ApiService);

  @Input() links: SubProcessLink[] = [];

  readonly open = signal<Set<number>>(new Set());
  readonly diagrams = signal<Record<number, InstanceDiagram>>({});
  readonly errors = signal<Record<number, string>>({});
  readonly look = instanceLook;

  toggle(id: number): void {
    const next = new Set(this.open());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (!this.diagrams()[id]) {
        this.api.diagram(id).subscribe({
          next: d => this.diagrams.update(m => ({ ...m, [id]: d })),
          error: e => this.errors.update(m => ({ ...m, [id]: describeError(e) }))
        });
      }
    }
    this.open.set(next);
  }
}
