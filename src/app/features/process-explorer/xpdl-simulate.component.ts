import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Activity, KIND_LABEL, ProcessData, SimState, Simulator, createSimulator, plainName } from './xpdl';

/**
 * Walks the process step by step. Enter the starting data, then run: automatic steps and decisions are worked out,
 * and at web-service calls and user tasks you give the response (or let the step time out).
 */
@Component({
  selector: 'app-xpdl-simulate',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    @if (!state()) {
      <p class="text-muted-color">Enter the starting data, then run. At web-service and user steps you will be asked for the response.</p>
      <div class="section">Inputs</div>
      @for (i of inputs; track i.name) {
        <div class="field">
          <label [for]="'in-' + i.name"><b>{{ plain(i.name) }}</b></label>
          <input pInputText [id]="'in-' + i.name" [attr.list]="'dl-' + i.name" [ngModel]="start[i.name]" (ngModelChange)="start[i.name] = $event" fluid />
          <datalist [id]="'dl-' + i.name">@for (v of i.values; track v) { <option [value]="v"></option> }</datalist>
          <small class="text-muted-color">{{ hint(i) }}</small>
        </div>
      } @empty {
        <p class="text-muted-color">This process needs no starting data.</p>
      }
      <div class="section">Other variables (optional)</div>
      <textarea class="p-inputtext w-full" rows="3" placeholder="name=value, one per line" [(ngModel)]="extra"></textarea>
      <div class="mt-3"><p-button type="button" label="Start simulation" icon="pi pi-play" (onClick)="begin()" /></div>
      <small class="text-muted-color block mt-2">
        Responses are lists separated by commas, for example <code>Success,Paid</code>. Scripts read item 1, item 2 and so on.
        In conditions, &amp; binds tighter than |.
      </small>
    } @else if (state(); as s) {
      <div class="mb-2"><b>{{ s.done ? 'Finished' : 'Next step' }}:</b> {{ current(s).name }}
        <span class="text-muted-color">({{ kind(current(s)) }}) · {{ s.n }} steps run</span></div>
      <div class="flex flex-wrap gap-2 mb-3">
        <p-button type="button" label="Step" size="small" severity="secondary" [outlined]="true" [disabled]="s.done || !!s.wait" (onClick)="step()" />
        <p-button type="button" label="Run" icon="pi pi-play" size="small" [disabled]="s.done || !!s.wait" (onClick)="runOn()" />
        <p-button type="button" label="Show on diagram" icon="pi pi-share-alt" size="small" severity="secondary" [outlined]="true" (onClick)="show.emit(s.path)" />
        <p-button type="button" label="Restart" icon="pi pi-refresh" size="small" severity="secondary" [outlined]="true" (onClick)="restart()" />
        <p-button type="button" label="Exit" size="small" severity="secondary" [text]="true" (onClick)="restart()" />
      </div>

      @if (s.wait; as w) {
        <div class="box wait">
          <b>{{ w.k === 'ws' ? 'Web service call: ' + (w.det['Web service operation'] || w.name) : 'User task: ' + w.name }}</b>
          @if (w.k === 'ws' && w.ins.length) {
            <div class="small">Sent: @for (v of w.ins; track v; let last = $last) { {{ plain(v) }}={{ s.V[v] ?? 'null' }}{{ last ? '' : ', ' }} }</div>
          }
          @for (o of fields(w); track o) {
            <div class="mt-2">
              <small>{{ w.k === 'ws' ? 'Response stored in' : 'Field' }} <code>{{ o }}</code></small>
              <input pInputText class="mt-1" [ngModel]="answer[o]" (ngModelChange)="answer[o] = $event" fluid />
              @if (w.k === 'ws') {
                <div class="flex flex-wrap gap-1 mt-1">
                  @for (p of suggestions(o); track p) { <button type="button" class="chip" (click)="answer[o] = p">{{ p }}</button> }
                </div>
              }
            </div>
          } @empty {
            <small class="text-muted-color">{{ w.k === 'ws' ? 'No output variable is mapped for this call.' : 'Waiting for the user to submit.' }}</small>
          }
          <div class="flex gap-2 mt-3">
            <p-button type="button" [label]="w.k === 'ws' ? 'Return response' : 'Submit'" size="small" (onClick)="submit(false)" />
            @if (hasTimeout(w)) { <p-button type="button" label="Time out" icon="pi pi-clock" size="small" severity="secondary" [outlined]="true" (onClick)="submit(true)" /> }
          </div>
        </div>
      }

      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-12 lg:col-span-5">
          <div class="section">Path so far ({{ s.path.length }})</div>
          <ol class="path">@for (id of s.path; track $index) { <li>{{ nameOf(id) }}</li> }</ol>
          <div class="section">Variables ({{ keys(s).length }})</div>
          <div class="scroll">
            @for (k of keys(s); track k) {
              <div [class.changed]="s.chg.has(k)"><code>{{ k }}</code> = {{ s.V[k] }}</div>
            }
          </div>
        </div>
        <div class="col-span-12 lg:col-span-7">
          <div class="section">Log</div>
          <div class="scroll log">
            @for (l of s.log.slice(-80); track $index) { <div [class]="'l-' + l.c">{{ l.m }}</div> }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 18px 0 6px; color: var(--p-text-muted-color, #667085); }
    .field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; max-width: 640px; }
    .box { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .box.wait { border-color: var(--p-primary-color, #2f5fd0); max-width: 640px; }
    .small { font-size: 12.5px; color: var(--p-text-muted-color, #667085); word-break: break-word; }
    .chip { border: 1px solid var(--p-content-border-color, #d5d9e0); background: transparent; color: inherit; border-radius: 99px; padding: 2px 10px; font-size: 12px; cursor: pointer; }
    code { font: 12px ui-monospace, Menlo, monospace; background: var(--p-content-hover-background, #f1f5f9); padding: 1px 4px; border-radius: 3px; }
    .scroll { max-height: 280px; overflow: auto; font-size: 12.5px; word-break: break-word; }
    .changed { color: var(--p-primary-color, #2f5fd0); font-weight: 600; }
    .path { margin-left: 18px; list-style: decimal; font-size: 13px; max-height: 200px; overflow: auto; }
    .l-a { font-weight: 600; } .l-d { color: var(--p-text-muted-color, #667085); } .l-w { color: #d1453b; } .l-ok { color: #2e9e5b; }
  `]
})
export class XpdlSimulateComponent {
  private data: ProcessData | null = null;
  private sim: Simulator | null = null;

  inputs: ReturnType<Simulator['inputs']> = [];
  start: Record<string, string> = {};
  extra = '';
  @Output() readonly show = new EventEmitter<string[]>();
  answer: Record<string, string> = {};
  readonly state = signal<SimState | null>(null);

  @Input({ required: true }) set model(value: ProcessData) {
    this.data = value;
    this.sim = createSimulator(value);
    this.inputs = this.sim.inputs();
    this.start = Object.fromEntries(this.inputs.map(i => [i.name, i.values[0] ?? '']));
    this.state.set(null);
  }

  plain = (v: string): string => plainName(v);
  kind = (a: Activity): string => KIND_LABEL[a.k];
  keys = (s: SimState): string[] => Object.keys(s.V).sort();

  hint(i: { values: string[]; checkedAt: string[] }): string {
    const at = i.checkedAt.length ? 'Checked at: ' + i.checkedAt.slice(0, 4).join('; ') + (i.checkedAt.length > 4 ? '…' : '') + '.' : '';
    const cmp = i.values.length ? ' Compared with: ' + i.values.slice(0, 6).join(', ') + '.' : '';
    return at + cmp || 'Sent to a service call. It does not change the route.';
  }

  current(s: SimState): Activity {
    return s.wait ?? this.data!.D.acts.find(a => a.id === s.cur)!;
  }

  nameOf(id: string): string {
    return this.data?.D.acts.find(a => a.id === id)?.name ?? id;
  }

  fields(w: Activity): string[] {
    return w.k === 'ws' ? w.outs : w.io;
  }

  suggestions(v: string): string[] {
    return this.sim?.suggestions(v) ?? [];
  }

  hasTimeout(w: Activity): boolean {
    return !!this.data?.D.acts.some(x => x.k === 'timer' && x.tgt === w.id);
  }

  begin(): void {
    const values: Record<string, string> = { ...this.start };
    this.extra.split('\n').forEach(l => {
      const i = l.indexOf('=');
      if (i > 0) {
        values[l.slice(0, i).trim().replace(/^\[|\]$/g, '')] = l.slice(i + 1).trim();
      }
    });
    this.state.set(this.sim!.start(values));
    this.afterMove();
  }

  step(): void {
    this.sim!.step(this.state()!);
    this.afterMove();
  }

  runOn(): void {
    this.sim!.run(this.state()!);
    this.afterMove();
  }

  submit(timeout: boolean): void {
    const s = this.state()!;
    const w = s.wait!;
    const values: Record<string, string> = {};
    this.fields(w).forEach(o => {
      if (this.answer[o] !== undefined && (this.answer[o] !== '' || w.k === 'ws')) {
        values[o] = this.answer[o];
      }
    });
    this.sim!.submit(s, values, timeout);
    this.afterMove();
  }

  restart(): void {
    this.state.set(null);
  }

  /** The state object is changed in place; hand the view a fresh reference and prepare the answer boxes. */
  private afterMove(): void {
    const s = this.state()!;
    this.state.set({ ...s });
    const w = s.wait;
    this.answer = {};
    if (w) {
      this.fields(w).forEach(o => {
        const cur = s.V[o];
        this.answer[o] = cur != null && cur !== 'null' ? cur : w.k === 'ws' ? this.suggestions(o)[0] ?? '' : '';
      });
    }
  }
}
