import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import {
  ImpactRun, ImpactScenario, ImpactTaint, ProcessData, Simulator, createSimulator, narrateRoute, plainCondition, plainName
} from './xpdl';

const OTHER = '__other__';

interface Group {
  name: string;
  values: string[];
  found: ImpactScenario[];
  partial: boolean;
  steps: Set<string>;
  outcomes: string[];
  calculated: string[];
}

interface Result {
  variable: string;
  values: string[];
  groups: Group[];
}

/**
 * Parameter impact: pick a parameter and see which decisions it drives, which values calculated from it matter, and
 * every distinct way the flow goes for each value (values that lead to the same flow are grouped).
 */
@Component({
  selector: 'app-xpdl-impact',
  standalone: true,
  imports: [FormsModule, ButtonModule, SelectModule, TagModule],
  template: `
    <p class="text-muted-color">Pick a parameter to see which decisions it drives and every scenario it produces.</p>

    <div class="grid grid-cols-12 gap-4 mb-4">
      <div class="col-span-12 md:col-span-5 flex flex-col gap-2">
        <label for="impParam">Parameter</label>
        <p-select inputId="impParam" [ngModel]="variable()" (ngModelChange)="choose($event)" [options]="parameters()"
          [filter]="true" placeholder="Choose a parameter" fluid>
          <ng-template #selectedItem let-p>{{ p }}</ng-template>
        </p-select>
      </div>
      <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
        <label for="impValues">Values to test <small class="text-muted-color">(one per line; "any other value" is always added)</small></label>
        <textarea id="impValues" rows="3" class="p-inputtext" [ngModel]="valuesText()" (ngModelChange)="valuesText.set($event)"></textarea>
      </div>
      <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
        <label for="impDev">Service failures to include</label>
        <p-select inputId="impDev" [(ngModel)]="deviations" [options]="deviationOptions" optionLabel="label" optionValue="value" fluid />
        <p-button type="button" label="Analyse impact" icon="pi pi-bullseye" [disabled]="!variable() || busy()" (onClick)="run()" />
        <small class="text-muted-color">{{ progress() }}</small>
      </div>
    </div>

    @if (usage(); as u) {
      <div class="section">Where “{{ name(variable()!) }}” is used</div>
      <p>
        @if (u.conds.length) {
          It influences <b>{{ u.conds.length }} decision branch{{ u.conds.length === 1 ? '' : 'es' }}</b>
          ({{ direct(u) }} directly, {{ u.conds.length - direct(u) }} through values calculated from it).
        } @else {
          <b>It does not influence any decision in this process.</b>
        }
        @if (u.passed.length) { It is sent to {{ u.passed.length }} system call{{ u.passed.length === 1 ? '' : 's' }}, whose behaviour is outside this model. }
      </p>
      @if (calculated(u).length) {
        <p><b>Values calculated from it:</b>
          @for (c of calculated(u); track c; let last = $last) { <code>{{ name(c) }}</code> (set in “{{ u.why[c].act }}”){{ last ? '.' : ', ' }} }
        </p>
      }
      @if (u.conds.length) {
        <details open>
          <summary>Decisions it influences ({{ byStep(u).length }})</summary>
          @for (g of byStep(u); track g[0]) {
            <div class="box"><b>{{ g[0] }}</b>
              @for (c of g[1]; track $index) {
                <div class="small">&rarr; “{{ c.to }}” when {{ condition(c.cond) }}
                  <span [class]="c.direct ? 'direct' : 'via'">{{ c.direct ? '(direct)' : '(via ' + viaNames(c.via) + ')' }}</span></div>
              }
            </div>
          }
        </details>
      }
      @if (u.readers.length) {
        <details>
          <summary>Automatic steps that use it ({{ u.readers.length }})</summary>
          @for (r of u.readers; track r.name) {
            <div class="box"><b>{{ r.name }}</b>
              @if (r.sets.length) { <small class="text-muted-color"> sets {{ viaNames(r.sets) }}</small> }
              <div class="small">@for (l of r.lines.slice(0, 10); track $index) { <div>{{ l }}</div> }@if (r.lines.length > 10) { <div>…</div> }</div>
            </div>
          }
        </details>
      }
      @if (u.passed.length) {
        <details>
          <summary>Sent to systems ({{ u.passed.length }})</summary>
          @for (p of u.passed; track $index) { <div class="box">{{ p.act }} <small class="text-muted-color">as parameter <code>{{ p.formal }}</code></small></div> }
        </details>
      }
    }

    @if (result(); as r) {
      <div class="section">Impact on the flow</div>
      @if (r.groups.length === 1) {
        <p><b>The flow is identical for every value of “{{ name(r.variable) }}”.</b>
          It produces {{ r.groups[0].found.length }} scenario{{ r.groups[0].found.length === 1 ? '' : 's' }} regardless of the value.</p>
      } @else {
        <p><b>The values fall into {{ r.groups.length }} groups with different flows.</b></p>
      }
      @for (g of r.groups; track g.name) {
        <div class="box">
          <b>{{ g.name }}</b> · {{ g.found.length }} scenario{{ g.found.length === 1 ? '' : 's' }}
          @if (g.partial) { <small class="warn"> (search stopped early; more may exist)</small> }
          <div class="my-1">@for (v of g.values; track v) { <code class="mr-1">{{ label(v) }}</code> }</div>
          <small class="text-muted-color">Can end as: {{ g.outcomes.join('; ') }}</small>
          @if (g.calculated.length) { <div class="small">Calculated values: {{ g.calculated.join(' · ') }}</div> }
          @if (r.groups.length > 1 && only(r, g).length) {
            <div class="small"><b>Reaches:</b> {{ quoted(only(r, g).slice(0, 10)) }}{{ only(r, g).length > 10 ? '…' : '' }}</div>
          }
        </div>
      }
      @if (r.groups.length > 1 && different(r).length) {
        <details>
          <summary>Steps that depend on the value ({{ different(r).length }})</summary>
          <div class="overflow-auto">
            <table>
              <thead><tr><th>Step</th>@for (g of r.groups; track g.name) { <th>{{ g.name }}</th> }</tr></thead>
              <tbody>
                @for (s of different(r); track s) {
                  <tr><td>{{ s }}</td>@for (g of r.groups; track g.name) { <td>{{ g.steps.has(s) ? '✔' : '—' }}</td> }</tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }

      <div class="section">All scenarios</div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <p-select [(ngModel)]="selected" [options]="groupOptions(r)" optionLabel="label" optionValue="value" />
        <p-button type="button" label="Copy all as text" icon="pi pi-copy" severity="secondary" [outlined]="true" size="small" (onClick)="copy(r)" />
      </div>
      @for (f of shown(r); track $index) {
        <div class="box">
          <b>{{ $index + 1 }}. Ends as {{ f.out }}</b>
          @if (f.n > 1) { <small class="text-muted-color"> · {{ f.n }} variants with the same steps</small> }
          @if (f.assume.length) { <div class="small"><b>Assumes:</b> {{ f.assume.join('; ') }}</div> }
          <p-button type="button" label="Show on diagram" icon="pi pi-share-alt" size="small" severity="secondary" [outlined]="true" class="block mt-2" (onClick)="show.emit(f.p)" />
          <details>
            <summary>Step by step</summary>
            <ol>@for (x of steps(f); track $index) { <li [class]="'k-' + x.k">{{ x.x }}</li> }</ol>
          </details>
        </div>
      }
      @if (groupOf(r).found.length > 150) {
        <small class="text-muted-color">… and {{ groupOf(r).found.length - 150 }} more scenarios (use Copy all as text).</small>
      }
    }
  `,
  styles: [`
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 20px 0 6px; color: var(--p-text-muted-color, #667085); }
    .box { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; padding: 8px 10px; margin: 6px 0; }
    .small { font-size: 12.5px; color: var(--p-text-muted-color, #667085); word-break: break-word; margin-top: 3px; }
    .direct { color: #d1453b; } .via { color: #e8a317; } .warn { color: #e8a317; }
    details { margin: 8px 0; } summary { cursor: pointer; font-size: 13px; }
    code { font: 12px ui-monospace, Menlo, monospace; background: var(--p-content-hover-background, #f1f5f9); padding: 1px 4px; border-radius: 3px; }
    ol { margin: 6px 0 0 18px; list-style: decimal; } li { font-size: 13px; }
    li.k-dec { color: #e8a317; } li.k-to { color: #d1453b; } li.k-man { color: #d9712b; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; } th, td { text-align: left; padding: 3px 8px; border-top: 1px solid var(--p-content-border-color, #e5e7eb); }
  `]
})
export class XpdlImpactComponent {
  readonly deviationOptions = [
    { label: 'None, only the normal path', value: 0 },
    { label: 'One failure or timeout per scenario', value: 1 },
    { label: 'Up to two', value: 2 },
    { label: 'Up to three (includes retry limits)', value: 3 }
  ];

  private data: ProcessData | null = null;
  private sim: Simulator | null = null;

  readonly parameters = signal<string[]>([]);
  readonly variable = signal<string | null>(null);
  readonly valuesText = signal('');
  readonly usage = signal<ImpactTaint | null>(null);
  readonly result = signal<Result | null>(null);
  readonly busy = signal(false);
  readonly progress = signal('');
  deviations = 1;
  @Output() readonly show = new EventEmitter<string[]>();
  selected = 0;

  @Input({ required: true }) set model(value: ProcessData) {
    this.data = value;
    this.sim = createSimulator(value);
    const all = this.sim.parameters();
    this.parameters.set(all);
    this.result.set(null);
    // the original opens on a request-type parameter when there is one, else the first process input
    const first = all.find(x => /request.?type/i.test(x)) ?? all.find(x => this.sim!.valuesOf(x).length > 0) ?? all[0] ?? null;
    this.choose(first);
  }

  choose(v: string | null): void {
    this.variable.set(v);
    this.result.set(null);
    this.selected = 0;
    if (v && this.sim) {
      this.valuesText.set(this.sim.valuesOf(v).join('\n'));
      this.usage.set(this.sim.usage(v));
    } else {
      this.valuesText.set('');
      this.usage.set(null);
    }
  }

  name = (v: string): string => plainName(v);
  condition = (c: string): string => plainCondition(c);
  label = (v: string): string => (v === OTHER ? 'any other value' : v);
  quoted = (l: string[]): string => l.map(s => '“' + s + '”').join(', ');
  viaNames = (l: string[]): string => l.map(plainName).join(', ');

  direct(u: ImpactTaint): number {
    return u.conds.filter(c => c.direct).length;
  }

  calculated(u: ImpactTaint): string[] {
    return [...u.T].filter(x => x !== this.variable());
  }

  byStep(u: ImpactTaint): [string, ImpactTaint['conds']][] {
    const by = new Map<string, ImpactTaint['conds']>();
    u.conds.forEach(c => by.set(c.f, [...(by.get(c.f) ?? []), c]));
    return [...by.entries()];
  }

  async run(): Promise<void> {
    const v = this.variable();
    const u = this.usage();
    if (!v || !u || !this.sim || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.result.set(null);
    const given = this.valuesText().split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const list = [...new Set(given)];
    list.push(OTHER);
    const out = new Map<string, ImpactRun>();
    for (let i = 0; i < list.length; i++) {
      this.progress.set(`Analysing ${this.label(list[i])} (${i + 1} of ${list.length})…`);
      // yield so the progress text paints between values
      await new Promise(r => setTimeout(r, 20));
      out.set(list[i], this.sim.explore(v, list[i], this.deviations, u));
    }
    const sets = new Map<string, string[]>();
    list.forEach(x => {
      const key = out.get(x)!.found.map(f => f.sig).sort().join('¦');
      sets.set(key, [...(sets.get(key) ?? []), x]);
    });
    const groups = [...sets.values()].sort((a, b) => b.length - a.length).map((vals, i): Group => {
      const first = out.get(vals[0])!;
      const calc = new Map<string, string[]>();
      vals.forEach(x => {
        const d = out.get(x)!.found[0]?.derived ?? {};
        const text = Object.entries(d).map(([a, b]) => plainName(a) + ' = ' + b).join(', ');
        if (text) {
          calc.set(text, [...(calc.get(text) ?? []), this.label(x)]);
        }
      });
      const calculated = [...calc.entries()].slice(0, 6).map(([t, l]) =>
        t + (calc.size > 1 ? ' for ' + l.slice(0, 3).join(', ') + (l.length > 3 ? ' and ' + (l.length - 3) + ' more' : '') : ' (all values in this group)'));
      return {
        name: 'Group ' + (i + 1),
        values: vals,
        found: first.found,
        partial: vals.some(x => out.get(x)!.partial),
        steps: new Set(first.found.flatMap(f => f.names)),
        outcomes: [...new Set(first.found.map(f => f.out))],
        calculated: this.calculated(u).length ? calculated : []
      };
    });
    this.result.set({ variable: v, values: list, groups });
    this.selected = 0;
    this.progress.set('');
    this.busy.set(false);
  }

  private allSteps(r: Result): string[] {
    return [...new Set(r.groups.flatMap(g => [...g.steps]))].sort();
  }

  different(r: Result): string[] {
    return this.allSteps(r).filter(s => r.groups.some(g => g.steps.has(s)) && r.groups.some(g => !g.steps.has(s)));
  }

  only(r: Result, g: Group): string[] {
    const diff = this.different(r);
    return [...g.steps].filter(s => diff.includes(s));
  }

  groupOptions(r: Result): { label: string; value: number }[] {
    return r.groups.map((g, i) => ({
      label: g.name + ': ' + g.values.slice(0, 3).map(x => this.label(x)).join(', ') + (g.values.length > 3 ? '…' : ''),
      value: i
    }));
  }

  groupOf(r: Result): Group {
    return r.groups[Math.min(this.selected, r.groups.length - 1)];
  }

  shown(r: Result): ImpactScenario[] {
    return this.groupOf(r).found.slice(0, 150);
  }

  steps(f: ImpactScenario): { k: string; x: string }[] {
    return this.data ? narrateRoute(this.data, f) : [];
  }

  copy(r: Result): void {
    let o = `Parameter impact: ${r.variable}\nValues tested: ${r.values.map(x => this.label(x)).join(', ')}\n`;
    r.groups.forEach(g => {
      o += `\n## ${g.name} (${g.values.map(x => this.label(x)).join(', ')}) - ${g.found.length} scenarios\n`;
      g.found.forEach((f, i) => {
        o += `\n${i + 1}. Ends as ${f.out}\n`;
        if (f.assume.length) {
          o += `   Assumes: ${f.assume.join('; ')}\n`;
        }
        this.steps(f).forEach(x => (o += `   - ${x.x}\n`));
      });
    });
    navigator.clipboard?.writeText(o);
  }
}
