import { Component, ElementRef, Input, ViewChild, computed, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Activity, KIND_LABEL, Kind, ProcessData, Transition } from './xpdl';
import { describeCondition, describeStep } from './xpdl';

type Mode =
  | { kind: 'none' }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'trace'; path: string[] };

interface Option {
  to: string;
  label: string;
  cond: string;
  timeout: boolean;
}

/** Fill colour of each kind of activity (same palette as the original explorer). */
const KIND_COLOUR: Record<Kind, string> = {
  start: '#2e9e5b',
  end: '#d1453b',
  gw: '#e8a317',
  task: '#8a94a6',
  ws: '#3b82c4',
  app: '#7c5cc4',
  user: '#d9712b',
  script: '#4aa39b',
  timer: '#c4457a'
};

/**
 * The process drawing: shapes from the file's own geometry (or an automatic layout), click a step or an arrow to
 * see its details, or trace the flow from the start one branch at a time.
 */
@Component({
  selector: 'app-xpdl-diagram',
  standalone: true,
  imports: [ButtonModule, TagModule],
  template: `
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <p-button type="button" icon="pi pi-play" label="Trace from start" size="small" (onClick)="startTrace()" />
      <p-button type="button" icon="pi pi-search-plus" size="small" severity="secondary" [outlined]="true" (onClick)="zoomBy(0.2)" ariaLabel="Zoom in" />
      <p-button type="button" icon="pi pi-search-minus" size="small" severity="secondary" [outlined]="true" (onClick)="zoomBy(-0.2)" ariaLabel="Zoom out" />
      <span class="ml-2 flex flex-wrap gap-1">
        @for (k of presentKinds(); track k) {
          <button type="button" class="chip" [class.off]="hidden().has(k)" (click)="toggleKind(k)" [attr.aria-pressed]="!hidden().has(k)">
            <i [style.background]="colour[k]"></i>{{ label[k] }}
          </button>
        }
      </span>
    </div>

    <div class="grid grid-cols-12 gap-4">
      <div #canvas class="col-span-12 xl:col-span-8 canvas">
        <svg [attr.width]="geometry().w * zoom()" [attr.height]="geometry().h * zoom()"
             [attr.viewBox]="'0 0 ' + geometry().w + ' ' + geometry().h" (click)="clear()" role="group"
             aria-label="Process diagram">
          <defs>
            <marker id="xd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8a94a6" /></marker>
            <marker id="xd-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2f5fd0" /></marker>
          </defs>
          @for (e of geometry().edges; track e.t.id) {
            <g [class.dim]="dimEdge(e.t.id)">
              <path [attr.d]="e.d" class="e" [class.hl]="highlightEdge(e.t.id)"
                    [attr.marker-end]="highlightEdge(e.t.id) ? 'url(#xd-arrow-hl)' : 'url(#xd-arrow)'" />
              <path [attr.d]="e.d" class="eh" (click)="pickEdge(e.t.id, $event)" />
            </g>
          }
          @for (n of geometry().nodes; track n.a.id) {
            <g class="n" [class.dim]="dimNode(n.a)" [class.sel]="isSelected(n.a.id)" tabindex="0" role="button"
               [attr.aria-label]="n.a.name + ', ' + label[n.a.k]" [style.opacity]="hidden().has(n.a.k) ? 0.12 : null"
               (click)="pickNode(n.a.id, $event)" (keydown.enter)="pickNode(n.a.id, $event)">
              <title>{{ n.a.name }}</title>
              @switch (n.shape) {
                @case ('circle') { <circle class="sh" [attr.cx]="n.cx" [attr.cy]="n.cy" [attr.r]="n.r" [attr.fill]="colour[n.a.k]" /> }
                @case ('diamond') { <path class="sh" [attr.d]="n.d" [attr.fill]="colour[n.a.k]" /> }
                @default { <rect class="sh" [attr.x]="n.cx - n.a.w / 2" [attr.y]="n.cy - n.a.h / 2" [attr.width]="n.a.w" [attr.height]="n.a.h" rx="6" [attr.fill]="colour[n.a.k]" /> }
              }
              <text [attr.x]="n.cx" [attr.y]="n.cy + n.a.h / 2 + (n.a.k === 'gw' ? 14 : 11)" text-anchor="middle">{{ short(n.a.name) }}</text>
            </g>
          }
        </svg>
      </div>

      <aside class="col-span-12 xl:col-span-4 panel" aria-live="polite">
        @switch (mode().kind) {
          @case ('none') {
            <p class="text-muted-color">Select a step or an arrow to see its details, or trace the flow from the start.</p>
          }
          @case ('node') {
            @if (selectedNode(); as a) {
              <div class="font-semibold text-lg">{{ a.name }}</div>
              <p-tag [value]="label[a.k]" [style]="{ background: colour[a.k], color: '#fff' }" />
              <span class="mono text-muted-color ml-2">{{ a.id }}</span>
              <div class="section">In business terms</div>
              <div>{{ describe(a) }}</div>
              @if (detailEntries(a).length > 0) {
                <div class="section">Details</div>
                @for (d of detailEntries(a); track d[0]) {
                  <div class="kv"><b>{{ d[0] }}:</b> @if (d[0] === 'Script') { <code>{{ d[1] }}</code> } @else { {{ d[1] }} }</div>
                }
              }
              <div class="section">Comes from ({{ incoming(a.id).length }})</div>
              @for (t of incoming(a.id); track t.id) {
                <button type="button" class="row" (click)="pickNode(t.f, $event)"><b>{{ nameOf(t.f) }}</b>@if (t.name) { <small>{{ t.name }}</small> }@if (t.cond) { <small><code>{{ t.cond }}</code></small> }</button>
              } @empty { <small class="text-muted-color">None</small> }
              <div class="section">Goes to ({{ outgoing(a.id).length }})</div>
              @for (t of outgoing(a.id); track t.id) {
                <button type="button" class="row" (click)="pickNode(t.t, $event)"><b>{{ nameOf(t.t) }}</b>@if (t.name) { <small>{{ t.name }}</small> }@if (t.cond) { <small><code>{{ t.cond }}</code></small> }</button>
              } @empty { <small class="text-muted-color">None</small> }
            }
          }
          @case ('edge') {
            @if (selectedEdge(); as t) {
              <div class="font-semibold text-lg">{{ t.name || 'Transition' }}</div>
              <span class="mono text-muted-color">{{ t.id }}</span>
              <div class="section">Path</div>
              <button type="button" class="row" (click)="pickNode(t.f, $event)"><b>{{ nameOf(t.f) }}</b></button>
              <div class="text-center text-muted-color">&darr;</div>
              <button type="button" class="row" (click)="pickNode(t.t, $event)"><b>{{ nameOf(t.t) }}</b></button>
              <div class="section">Condition</div>
              @if (t.cond) {
                <div><code>{{ t.cond }}</code></div>
                <div class="text-muted-color mt-1">{{ plain(t.cond) }}</div>
              } @else { <div class="text-muted-color">{{ t.ct ? 'Default path (' + t.ct.toLowerCase() + ')' : 'Always taken (no condition)' }}</div> }
              @if (t.desc) { <div class="section">Description</div><div>{{ t.desc }}</div> }
            }
          }
          @case ('trace') {
            <div class="font-semibold text-lg">Trace mode</div>
            <small class="text-muted-color">Step {{ trace().length }}. Pick the branch to follow.</small>
            <div class="section">Path so far</div>
            @for (id of trace(); track $index) {
              <button type="button" class="row" (click)="cutTrace($index)"><b>{{ $index + 1 }}. {{ nameOf(id) }}</b></button>
            }
            @if (current(); as a) {
              <div class="section">Now at: {{ a.name }} <p-tag [value]="label[a.k]" [style]="{ background: colour[a.k], color: '#fff' }" /></div>
              @for (d of detailEntries(a, true); track d[0]) { <div class="kv"><b>{{ d[0] }}:</b> {{ d[1] }}</div> }
              @if (options().length > 0) {
                <div class="section">Next options ({{ options().length }})</div>
                @for (o of options(); track $index) {
                  <button type="button" class="row" (click)="follow(o)"><b>&rarr; {{ nameOf(o.to) }}</b>@if (o.label) { <small>{{ o.label }}</small> }@if (o.cond) { <small><code>{{ o.cond }}</code></small> }@if (o.timeout) { <small>If the step takes too long or fails</small> }</button>
                }
              } @else {
                <div class="section">End of this path</div>
              }
            }
            <div class="mt-3 flex gap-2">
              <p-button type="button" label="Undo" icon="pi pi-undo" size="small" severity="secondary" [outlined]="true" (onClick)="undoTrace()" />
              <p-button type="button" label="Restart" icon="pi pi-refresh" size="small" severity="secondary" [outlined]="true" (onClick)="startTrace()" />
              <p-button type="button" label="Exit" size="small" severity="secondary" [text]="true" (onClick)="clear()" />
            </div>
          }
        }
      </aside>
    </div>
  `,
  styles: [`
    .canvas { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 10px; overflow: auto; height: 68vh; background: var(--p-content-background, #fff); }
    .panel { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 10px; padding: 14px; max-height: 68vh; overflow: auto; align-self: start; }
    .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--p-content-border-color, #d5d9e0); background: var(--p-content-background, #fff); color: inherit; border-radius: 99px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
    .chip i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .chip.off { opacity: 0.4; }
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color, #667085); margin: 14px 0 4px; font-weight: 600; }
    .kv { margin: 3px 0; word-break: break-word; }
    .kv b { color: var(--p-text-muted-color, #667085); font-weight: 600; }
    .row { display: block; width: 100%; text-align: left; padding: 6px 8px; border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 6px; margin-bottom: 5px; cursor: pointer; background: transparent; color: inherit; font: inherit; }
    .row:hover { border-color: var(--p-primary-color, #2f5fd0); }
    .row small { display: block; color: var(--p-text-muted-color, #667085); word-break: break-word; }
    code { font: 12px ui-monospace, Menlo, monospace; background: var(--p-content-hover-background, #f1f5f9); padding: 1px 4px; border-radius: 3px; word-break: break-word; }
    svg .n { cursor: pointer; }
    svg .n text { fill: var(--p-text-color, #1d2330); font-size: 9px; pointer-events: none; }
    svg .n:hover .sh { stroke: var(--p-primary-color, #2f5fd0); stroke-width: 2; }
    svg .sh { stroke: var(--p-content-background, #fff); }
    svg .n.sel .sh { stroke: var(--p-primary-color, #2f5fd0); stroke-width: 3; }
    svg .e { stroke: var(--p-text-muted-color, #667085); stroke-width: 1.2; fill: none; opacity: 0.55; stroke-linejoin: round; }
    svg .e.hl { stroke: #2f5fd0; stroke-width: 2.2; opacity: 1; }
    svg .eh { stroke: transparent; stroke-width: 10; fill: none; cursor: pointer; }
    svg .dim { opacity: 0.15; }
  `]
})
export class XpdlDiagramComponent {
  readonly colour = KIND_COLOUR;
  readonly label = KIND_LABEL;

  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;

  private readonly model = signal<ProcessData | null>(null);

  @Input({ required: true }) set data(value: ProcessData) {
    this.model.set(value);
    this.mode.set({ kind: 'none' });
    this.hidden.set(new Set());
    this.zoom.set(1);
  }

  readonly mode = signal<Mode>({ kind: 'none' });
  readonly hidden = signal<Set<Kind>>(new Set());
  readonly zoom = signal(1);

  private readonly acts = computed<Activity[]>(() => this.model()?.D.acts ?? []);
  private readonly trs = computed<Transition[]>(() => this.model()?.D.trs ?? []);
  private readonly byId = computed(() => new Map(this.acts().map(a => [a.id, a] as const)));

  readonly presentKinds = computed<Kind[]>(() => {
    const present = new Set(this.acts().map(a => a.k));
    return (Object.keys(KIND_LABEL) as Kind[]).filter(k => present.has(k));
  });

  /** Positions and paths, in the coordinates of the drawing. */
  readonly geometry = computed(() => {
    const acts = this.acts();
    let minx = 1e9, miny = 1e9, maxx = 0, maxy = 0;
    acts.forEach(a => {
      minx = Math.min(minx, a.x);
      miny = Math.min(miny, a.y);
      maxx = Math.max(maxx, a.x + a.w);
      maxy = Math.max(maxy, a.y + a.h);
    });
    if (!acts.length) {
      return { w: 100, h: 100, nodes: [], edges: [] as { t: Transition; d: string }[] };
    }
    const pad = 40;
    const centre = (a: Activity): [number, number] => [a.x - minx + pad + a.w / 2, a.y - miny + pad + a.h / 2];
    const nodes = acts.map(a => {
      const [cx, cy] = centre(a);
      const shape = a.k === 'start' || a.k === 'end' || a.k === 'timer' ? 'circle' : a.k === 'gw' ? 'diamond' : 'box';
      const d = `M${cx} ${cy - a.h / 2 - 3}L${cx + a.w / 2 + 3} ${cy}L${cx} ${cy + a.h / 2 + 3}L${cx - a.w / 2 - 3} ${cy}z`;
      return { a, cx, cy, shape, r: a.w / 2 + (a.k === 'timer' ? 0 : 1), d };
    });
    const edges: { t: Transition; d: string }[] = [];
    for (const t of this.trs()) {
      const a = this.byId().get(t.f);
      const b = this.byId().get(t.t);
      if (!a || !b) {
        continue;
      }
      const [ax, ay] = centre(a);
      const [bx, by] = centre(b);
      const dx = bx - ax;
      const dy = by - ay;
      let d: string;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const sx = ax + Math.sign(dx || 1) * (a.w / 2 + 2);
        const tx = bx - Math.sign(dx || 1) * (b.w / 2 + 2);
        const mx = (sx + tx) / 2;
        d = `M${sx} ${ay}H${mx}V${by}H${tx}`;
      } else {
        const sy = ay + Math.sign(dy) * (a.h / 2 + 2);
        const ty = by - Math.sign(dy) * (b.h / 2 + 2);
        const my = (sy + ty) / 2;
        d = `M${ax} ${sy}V${my}H${bx}V${ty}`;
      }
      edges.push({ t, d });
    }
    return { w: maxx - minx + pad * 2, h: maxy - miny + pad * 2 + 20, nodes, edges };
  });

  readonly selectedNode = computed(() => {
    const m = this.mode();
    return m.kind === 'node' ? this.byId().get(m.id) ?? null : null;
  });
  readonly selectedEdge = computed(() => {
    const m = this.mode();
    return m.kind === 'edge' ? this.trs().find(t => t.id === m.id) ?? null : null;
  });
  readonly trace = computed<string[]>(() => {
    const m = this.mode();
    return m.kind === 'trace' ? m.path : [];
  });
  readonly current = computed(() => {
    const path = this.trace();
    return path.length ? this.byId().get(path[path.length - 1]) ?? null : null;
  });
  readonly options = computed<Option[]>(() => {
    const a = this.current();
    if (!a) {
      return [];
    }
    const o: Option[] = this.trs().filter(t => t.f === a.id).map(t => ({ to: t.t, label: t.name, cond: t.cond, timeout: false }));
    this.acts().filter(x => x.k === 'timer' && x.tgt === a.id).forEach(x => o.push({ to: x.id, label: 'Timeout / error event', cond: '', timeout: false }));
    return o;
  });

  // what is lit up while something is selected
  private readonly focus = computed(() => {
    const m = this.mode();
    const nodes = new Set<string>();
    const edges = new Set<string>();
    const selected = new Set<string>();
    if (m.kind === 'node') {
      selected.add(m.id);
      nodes.add(m.id);
      this.trs().filter(t => t.f === m.id || t.t === m.id).forEach(t => {
        edges.add(t.id);
        nodes.add(t.f);
        nodes.add(t.t);
      });
    } else if (m.kind === 'edge') {
      edges.add(m.id);
      const t = this.trs().find(x => x.id === m.id);
      if (t) {
        nodes.add(t.f);
        nodes.add(t.t);
      }
    } else if (m.kind === 'trace') {
      m.path.forEach((id, i) => {
        nodes.add(id);
        selected.add(id);
        if (i) {
          const t = this.trs().find(x => x.f === m.path[i - 1] && x.t === id);
          if (t) {
            edges.add(t.id);
          }
        }
      });
    }
    return { nodes, edges, selected, active: m.kind !== 'none' };
  });

  dimNode(a: Activity): boolean {
    const f = this.focus();
    return f.active && !f.nodes.has(a.id);
  }
  dimEdge(id: string): boolean {
    const f = this.focus();
    return f.active && !f.edges.has(id);
  }
  highlightEdge(id: string): boolean {
    return this.focus().edges.has(id);
  }
  isSelected(id: string): boolean {
    return this.focus().selected.has(id);
  }

  short(name: string): string {
    return name.length > 22 ? name.slice(0, 21) + '…' : name;
  }
  nameOf(id: string): string {
    return this.byId().get(id)?.name ?? id;
  }
  incoming(id: string): Transition[] {
    return this.trs().filter(t => t.t === id);
  }
  outgoing(id: string): Transition[] {
    return this.trs().filter(t => t.f === id);
  }
  detailEntries(a: Activity, withoutScript = false): [string, string][] {
    return Object.entries(a.det).filter(([k]) => !withoutScript || k !== 'Script');
  }
  describe(a: Activity): string {
    const m = this.model();
    return m ? describeStep(a, m.D) : '';
  }
  plain(condition: string): string {
    return condition ? describeCondition(condition) : '';
  }

  toggleKind(k: Kind): void {
    this.hidden.update(s => {
      const next = new Set(s);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  }
  zoomBy(step: number): void {
    this.zoom.update(z => Math.max(0.5, Math.min(2.5, Math.round((z + step) * 10) / 10)));
  }

  pickNode(id: string, e?: Event): void {
    e?.stopPropagation();
    this.mode.set({ kind: 'node', id });
    this.reveal(id);
  }
  pickEdge(id: string, e?: Event): void {
    e?.stopPropagation();
    this.mode.set({ kind: 'edge', id });
  }
  clear(): void {
    this.mode.set({ kind: 'none' });
  }

  startAct(): Activity | undefined {
    const acts = this.acts();
    return acts.find(a => a.k === 'start')
      ?? acts.find(a => a.k !== 'timer' && !this.trs().some(t => t.t === a.id))
      ?? acts[0];
  }
  startTrace(): void {
    const s = this.startAct();
    if (s) {
      this.mode.set({ kind: 'trace', path: [s.id] });
      this.reveal(s.id);
    }
  }
  follow(o: Option): void {
    const m = this.mode();
    if (m.kind === 'trace') {
      this.mode.set({ kind: 'trace', path: [...m.path, o.to] });
      this.reveal(o.to);
    }
  }
  cutTrace(index: number): void {
    const m = this.mode();
    if (m.kind === 'trace') {
      this.mode.set({ kind: 'trace', path: m.path.slice(0, index + 1) });
    }
  }
  undoTrace(): void {
    const m = this.mode();
    if (m.kind === 'trace' && m.path.length > 1) {
      this.mode.set({ kind: 'trace', path: m.path.slice(0, -1) });
      this.reveal(m.path[m.path.length - 2]);
    }
  }

  /** Scrolls the drawing so the step is in view. */
  private reveal(id: string): void {
    const n = this.geometry().nodes.find(x => x.a.id === id);
    const el = this.canvas?.nativeElement;
    if (n && el) {
      el.scrollTo({
        left: n.cx * this.zoom() - el.clientWidth / 2,
        top: n.cy * this.zoom() - el.clientHeight / 2,
        behavior: 'smooth'
      });
    }
  }
}
