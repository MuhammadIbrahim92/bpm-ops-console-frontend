import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SubProcessLink } from '../core/models';
import { instanceLook } from '../core/status';
import { DateTimePipe } from './pipes';
import { StatusBadgeComponent } from './status-badge.component';

/**
 * The sub-process instances started by one step of the instance: one row per run of the step, with the instance it
 * started (found exactly, never guessed). "Show details" asks the page to show that instance in full, like the main
 * one; "Open in new tab" opens its own page.
 */
@Component({
  selector: 'app-sub-process-panel',
  standalone: true,
  imports: [ButtonModule, StatusBadgeComponent, DateTimePipe],
  template: `
    <div class="font-semibold mb-2"><i class="pi pi-sitemap mr-1"></i>Sub-process</div>
    @for (l of links; track l.activityInstanceId; let ix = $index) {
      <div class="run" [class.on]="l.child && l.child.id === openId">
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
            <p-button type="button" [label]="openId === c.id ? 'Hide details' : 'Show details'" icon="pi pi-sitemap" size="small"
              severity="secondary" [outlined]="true" (onClick)="showDetails.emit(openId === c.id ? null : c.id)" />
            <a class="p-button p-button-sm p-button-outlined" [href]="'#/instances/' + c.id" target="_blank" rel="noopener">
              <i class="pi pi-external-link mr-2"></i>Open in new tab</a>
          } @else if (l.hidden) {
            <span class="text-muted-color">A sub-process instance was started, but you may not view it.</span>
          } @else {
            <span class="text-muted-color">No sub-process instance is recorded for this run.</span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .run { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .run.on { border-color: var(--accent); }
    .bad { color: var(--c-failed); font-weight: 600; }
    a.p-button { text-decoration: none; display: inline-flex; align-items: center; }
  `]
})
export class SubProcessPanelComponent {
  @Input() links: SubProcessLink[] = [];
  /** The sub-process instance currently shown in full, if any. */
  @Input() openId: number | null = null;
  @Output() readonly showDetails = new EventEmitter<number | null>();
  readonly look = instanceLook;
}
