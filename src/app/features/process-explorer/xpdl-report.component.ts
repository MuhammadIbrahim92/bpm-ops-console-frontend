import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { KIND_LABEL, Kind, ProcessData } from './xpdl';
import { applyConsoleProfile } from './xpdl/console-profile';

/** Summary of the process and what the automatic checks found, vendor-format noise set apart. */
@Component({
  selector: 'app-xpdl-report',
  standalone: true,
  imports: [NgTemplateOutlet, TagModule],
  template: `
    @if (data()) {
      <div class="grid grid-cols-12 gap-3 mb-4">
        @for (s of summary(); track s[0]) {
          <div class="col-span-6 md:col-span-3 xl:col-span-2 stat"><div class="n">{{ s[1] }}</div><div class="l">{{ s[0] }}</div></div>
        }
      </div>

      <div class="section">Needs attention ({{ profiled().problems.length }})</div>
      @for (c of profiled().problems; track c.l) {
        <ng-container *ngTemplateOutlet="row; context: { $implicit: c }" />
      } @empty {
        <p class="text-muted-color">Nothing needs attention.</p>
      }

      <div class="section">Notes ({{ profiled().notes.length }})</div>
      <p class="text-muted-color mb-2">How the designer writes the file, or things worth knowing. Not faults.</p>
      @for (c of profiled().notes; track c.l) {
        <ng-container *ngTemplateOutlet="row; context: { $implicit: c }" />
      }

      <div class="section">Passed ({{ profiled().passed.length }})</div>
      <div class="flex flex-wrap gap-1">
        @for (c of profiled().passed; track c.l) {
          <span class="ok" [title]="c.d">{{ c.l }}</span>
        }
      </div>
    }

    <ng-template #row let-c>
      <div class="finding">
        <button type="button" class="head" (click)="toggle(c.l)" [attr.aria-expanded]="open().has(c.l)">
          <p-tag [value]="c.s === 'fail' ? 'Fix' : c.s === 'warn' ? 'Check' : 'Note'"
                 [severity]="c.s === 'fail' ? 'danger' : c.s === 'warn' ? 'warn' : 'info'" />
          <b>{{ c.l }}</b><span class="text-muted-color">{{ c.d }}</span>
        </button>
        @if (open().has(c.l)) {
          <div class="body">
            @if (c.items?.length) {
              <ul>@for (i of c.items; track $index) { <li>{{ i }}</li> }</ul>
            }
            @if (c.fix) {
              <div class="text-muted-color">How to fix: {{ c.fix }}</div>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .stat { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 10px; padding: 10px 12px; }
    .stat .n { font-size: 22px; font-weight: 600; }
    .stat .l { font-size: 12px; color: var(--p-text-muted-color, #667085); }
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 18px 0 6px; color: var(--p-text-muted-color, #667085); }
    .finding { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; margin-bottom: 6px; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 100%; text-align: left; background: transparent; border: 0; color: inherit; font: inherit; padding: 8px 10px; cursor: pointer; }
    .body { padding: 0 12px 10px 12px; }
    .body ul { margin: 4px 0 8px 18px; list-style: disc; }
    .ok { font-size: 12px; border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 99px; padding: 2px 10px; }
  `]
})
export class XpdlReportComponent {
  readonly data = signal<ProcessData | null>(null);
  readonly open = signal<Set<string>>(new Set());

  @Input({ required: true }) set model(value: ProcessData) {
    this.data.set(value);
    this.open.set(new Set());
  }

  readonly profiled = computed(() => applyConsoleProfile(this.data()?.M.checks ?? []));

  readonly summary = computed<[string, number | string][]>(() => {
    const m = this.data()?.M;
    if (!m) {
      return [];
    }
    const rows: [string, number | string][] = [['Steps', m.nAct], ['Transitions', m.nTr]];
    (Object.keys(KIND_LABEL) as Kind[]).forEach(k => {
      if (m.kinds[k] && k !== 'start' && k !== 'end') {
        rows.push([KIND_LABEL[k] + 's', m.kinds[k]!]);
      }
    });
    rows.push(['Data fields', m.datafields], ['Integrations', m.integ.length], ['Layout', m.layout]);
    return rows;
  });

  toggle(label: string): void {
    this.open.update(s => {
      const n = new Set(s);
      if (n.has(label)) {
        n.delete(label);
      } else {
        n.add(label);
      }
      return n;
    });
  }
}
