import { Component, Input, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { Analysis, ProcessData, Scenario, analyseProcess, scenarioSteps, scenarioTitle } from './xpdl';

/**
 * How the process can run, from the start to every possible ending: the standard path, the ways it can deviate, and
 * which scenarios go through a chosen step (to judge the effect of changing or breaking it).
 */
@Component({
  selector: 'app-xpdl-scenarios',
  standalone: true,
  imports: [FormsModule, SelectModule, TagModule],
  template: `
    @if (busy()) {
      <div class="text-muted-color"><i class="pi pi-spin pi-spinner mr-2"></i>Working out the routes…</div>
    } @else if (analysis(); as a) {
      <p class="text-muted-color">
        {{ a.all }} possible route{{ a.all === 1 ? '' : 's' }} from start to finish@if (a.trunc) { (the list was cut short because the process is very large) }.
        The {{ scenarios().length }} below together cover every step that waits for a person, a timeout, or a system, and every decision branch.
      </p>

      @for (s of scenarios(); track $index) {
        <div class="sc">
          <button type="button" class="head" (click)="toggle($index)" [attr.aria-expanded]="open().has($index)">
            <b>{{ $index + 1 }}. {{ title(s) }}</b>
            <span class="text-muted-color">{{ s.steps }} steps, ends as {{ s.out }}</span>
          </button>
          @if (open().has($index)) {
            <div class="body">
              @if (s.dev?.length) { <div class="mb-2">What makes it different: {{ s.dev?.join('; ') }}.</div> }
              <ol>
                @for (n of narration(s); track $index) {
                  <li><p-tag [value]="label[n.k]" [severity]="sev[n.k]" /> <span class="ml-1">{{ n.x }}</span></li>
                }
              </ol>
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-color">No complete route from the start was found.</p>
      }

      <div class="section">Impact of a step</div>
      <p class="text-muted-color">Pick a step to see which scenarios pass through it, and what comes before and after it.</p>
      <p-select [(ngModel)]="picked" [options]="steps()" optionLabel="name" optionValue="id" [filter]="true" filterBy="name"
        placeholder="Choose a step" class="w-full md:w-96" />
      @if (impact(); as i) {
        <div class="mt-3"><b>{{ i.through }}</b> of {{ a.all }} routes pass through this step.</div>
        <div class="mt-1">Always reached before: {{ i.before.join(', ') || 'nothing (it is the first step)' }}</div>
        <div class="mt-1">Can only happen afterwards: {{ i.after.join(', ') || 'nothing (it is a last step)' }}</div>
        <div class="mt-1">Scenarios affected: {{ i.scenarios.join('; ') || 'none of the listed ones' }}</div>
      }
    }
  `,
  styles: [`
    .sc { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; margin-bottom: 6px; }
    .head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; width: 100%; text-align: left; background: transparent; border: 0; color: inherit; font: inherit; padding: 8px 10px; cursor: pointer; }
    .body { padding: 0 14px 10px; }
    .body ol { margin-left: 18px; list-style: decimal; }
    .body li { margin: 3px 0; }
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 22px 0 6px; color: var(--p-text-muted-color, #667085); }
  `]
})
export class XpdlScenariosComponent {
  readonly label: Record<string, string> = { sys: 'System', man: 'Person', dec: 'Decision', to: 'Timeout', end: 'End' };
  readonly sev: Record<string, 'info' | 'warn' | 'secondary' | 'danger' | 'success'> =
    { sys: 'info', man: 'warn', dec: 'secondary', to: 'danger', end: 'success' };

  private readonly data = signal<ProcessData | null>(null);
  readonly analysis = signal<Analysis | null>(null);
  readonly busy = signal(false);
  readonly open = signal<Set<number>>(new Set([0]));
  picked: string | null = null;

  @Input({ required: true }) set model(value: ProcessData) {
    this.data.set(value);
    this.analysis.set(null);
    this.picked = null;
    this.busy.set(true);
    // let the spinner paint first; the analysis of a big process can take a moment
    setTimeout(() => {
      this.analysis.set(analyseProcess(value));
      this.busy.set(false);
    }, 30);
  }

  readonly scenarios = computed<Scenario[]>(() => this.analysis()?.sc ?? []);
  readonly steps = computed(() => (this.data()?.D.acts ?? []).filter(a => a.k !== 'start'));

  readonly impact = computed(() => {
    const a = this.analysis();
    if (!a || !this.picked) {
      return null;
    }
    const id = this.picked;
    const through = a.paths.filter(p => p.p.includes(id));
    const name = (x: string) => a.g.A[x].name;
    const before = new Set<string>(through.length ? through[0].p.slice(0, through[0].p.indexOf(id)) : []);
    through.forEach(p => {
      const head = new Set(p.p.slice(0, p.p.indexOf(id)));
      before.forEach(x => {
        if (!head.has(x)) {
          before.delete(x);
        }
      });
    });
    const after = new Set<string>();
    through.forEach(p => p.p.slice(p.p.indexOf(id) + 1).forEach(x => after.add(x)));
    const hit = a.sc.filter(s => s.p.includes(id)).map(s => scenarioTitle(a, s));
    return {
      through: through.length,
      before: [...before].filter(x => a.g.A[x].k !== 'gw').map(name),
      after: [...after].filter(x => a.g.A[x].k !== 'gw').map(name),
      scenarios: hit
    };
  });

  title(s: Scenario): string {
    const a = this.analysis();
    return a ? scenarioTitle(a, s) : '';
  }

  narration(s: Scenario): { k: string; x: string }[] {
    const a = this.analysis();
    return a ? scenarioSteps(a, s) : [];
  }

  toggle(i: number): void {
    this.open.update(s => {
      const n = new Set(s);
      if (n.has(i)) {
        n.delete(i);
      } else {
        n.add(i);
      }
      return n;
    });
  }
}
