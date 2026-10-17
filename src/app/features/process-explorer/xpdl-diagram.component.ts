import { Component, ElementRef, HostListener, Input, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { Activity, KIND_LABEL, Kind, ProcessData, Transition, describeCondition, describeStep } from './xpdl';

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

interface Icon {
  d: string;
  /** Solid shapes are filled; the rest are drawn as lines. */
  solid?: boolean;
}

/** One icon per kind of step, drawn on a 24 by 24 grid. Used on the shapes, the legend and the panel. */
const ICONS: Record<Kind, Icon> = {
  start: { d: 'M8 5v14l11-7z', solid: true },
  end: { d: 'M6.5 6.5h11v11h-11z', solid: true },
  gw: { d: 'M12 4v6M12 10l-6 9M12 10l6 9M3.5 16.5L6 19l-2.5 .5M20.5 16.5L18 19l2.5 .5' },
  ws: { d: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18' },
  app: { d: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3' },
  user: { d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 21c0-4 3.4-7 7.5-7s7.5 3 7.5 7' },
  script: { d: 'M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 5l-3 14' },
  timer: { d: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2' },
  task: { d: 'M5 12.5l4.5 4.5L19 7.5' }
};

/** Fill colour of each kind of step (same palette as the original explorer). */
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

interface Edge extends Transition {
  /** A timeout event hangs off the step it guards; drawn dashed. */
  link?: boolean;
}

/**
 * The process drawing. Shapes come from the file's own geometry (or an automatic layout) and carry an icon for the
 * kind of step. Drag to pan, Ctrl and wheel to zoom, search a step by name, follow the flow with the trace
 * (numbered path, the next steps pulse and can be clicked, arrow keys step through it).
 */
@Component({
  selector: 'app-xpdl-diagram',
  standalone: true,
  imports: [FormsModule, ButtonModule, SelectModule],
  template: `
    <div class="toolbar">
      <p-button type="button" icon="pi pi-play" label="Trace from start" size="small" (onClick)="startTrace()" />
      <span class="sep"></span>
      <p-button type="button" icon="pi pi-search-plus" size="small" severity="secondary" [outlined]="true" (onClick)="zoomBy(0.2)" ariaLabel="Zoom in" />
      <button type="button" class="pct" (click)="zoomTo(1)" title="Back to 100%">{{ zoomPct() }}%</button>
      <p-button type="button" icon="pi pi-search-minus" size="small" severity="secondary" [outlined]="true" (onClick)="zoomBy(-0.2)" ariaLabel="Zoom out" />
      <p-button type="button" icon="pi pi-expand" size="small" severity="secondary" [outlined]="true" (onClick)="fit()" ariaLabel="Fit to window" />
      <span class="sep"></span>
      <p-select [ngModel]="null" (ngModelChange)="goTo($event)" [options]="stepOptions()" optionLabel="name" optionValue="id"
        [filter]="true" filterBy="name" placeholder="Find a step" styleClass="find" [showClear]="false" />
      <span class="legend">
        @for (k of presentKinds(); track k) {
          <button type="button" class="kind" [class.off]="hidden().has(k)" (click)="toggleKind(k)"
                  [attr.aria-pressed]="!hidden().has(k)" [title]="label[k] + ' (' + count(k) + ')'">
            <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="12" [attr.fill]="colour[k]" /><g transform="translate(4.8 4.8) scale(0.6)" [attr.fill]="icons[k].solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons[k].d" /></g></svg>
            <b>{{ count(k) }}</b>
          </button>
        }
        <span class="kind plain" title="Arrow with a condition"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#667085" stroke-width="2" /><path d="M12 7v6M12 16.5v.5" stroke="#667085" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg></span>
        <span class="kind plain" title="Timeout link"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M2 12h20" stroke="#c4457a" stroke-width="2.4" stroke-dasharray="4 3" fill="none" /></svg></span>
      </span>
    </div>

    @if (mode().kind === 'trace') {
      <div class="tracebar" role="group" aria-label="Trace controls">
        <p-button type="button" icon="pi pi-step-backward" size="small" severity="secondary" [outlined]="true" [disabled]="trace().length < 2" (onClick)="undoTrace()" ariaLabel="Back one step" />
        <p-button type="button" icon="pi pi-step-forward" size="small" [disabled]="options().length !== 1" (onClick)="follow(options()[0])" ariaLabel="Next step" />
        <p-button type="button" icon="pi pi-forward" size="small" severity="secondary" [outlined]="true" [disabled]="options().length !== 1" (onClick)="runToDecision()" ariaLabel="Go to the next decision" />
        <p-button type="button" icon="pi pi-refresh" size="small" severity="secondary" [outlined]="true" (onClick)="startTrace()" ariaLabel="Restart" />
        <p-button type="button" icon="pi pi-times" size="small" severity="secondary" [text]="true" (onClick)="clear()" ariaLabel="Exit trace" />
        <span class="crumbs">
          @for (id of trace(); track $index; let last = $last) {
            <button type="button" class="crumb" [class.cur]="last" (click)="cutTrace($index)" [title]="nameOf(id)">
              <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(id)]" /></svg>
              <span>{{ $index + 1 }}</span>
            </button>
            @if (!last) { <i class="pi pi-angle-right"></i> }
          }
        </span>
      </div>
    }

    <div class="grid grid-cols-12 gap-4">
      <div class="col-span-12 xl:col-span-8 stage">
        <div #canvas class="canvas" tabindex="0" (scroll)="onScroll()" (wheel)="onWheel($event)" (pointerdown)="down($event)"
             (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="up($event)" [class.drag]="dragging()">
          <svg [attr.width]="geometry().w * zoom()" [attr.height]="geometry().h * zoom()"
               [attr.viewBox]="'0 0 ' + geometry().w + ' ' + geometry().h" role="group" aria-label="Process diagram">
            <defs>
              <marker id="xd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8a94a6" /></marker>
              <marker id="xd-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#2f5fd0" /></marker>
              <marker id="xd-arrow-to" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c4457a" /></marker>
              <filter id="xd-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-opacity="0.28" /></filter>
            </defs>

            @for (e of geometry().edges; track e.t.id) {
              <g [class.dim]="dimEdge(e.t.id)">
                <path [attr.d]="e.d" class="e" [class.link]="e.t.link" [class.hl]="highlightEdge(e.t.id)" [class.flow]="flowEdge(e.t.id)" [class.next]="nextEdge(e.t.id)"
                      [attr.marker-end]="e.t.link ? 'url(#xd-arrow-to)' : (highlightEdge(e.t.id) || nextEdge(e.t.id)) ? 'url(#xd-arrow-hl)' : 'url(#xd-arrow)'" />
                <path [attr.d]="e.d" class="eh" (click)="pickEdge(e.t.id, $event)" />
                @if (e.t.cond) {
                  <g class="cond" [attr.transform]="'translate(' + e.mx + ' ' + e.my + ')'" (click)="pickEdge(e.t.id, $event)">
                    <title>{{ plain(e.t.cond) }}</title>
                    <circle r="7.5" />
                    <path d="M0 -3.4v4M0 3.6v.4" />
                  </g>
                }
              </g>
            }

            @for (n of geometry().nodes; track n.a.id) {
              <g class="n" [class.dim]="dimNode(n.a)" [class.sel]="isSelected(n.a.id)" [class.cur]="isCurrent(n.a.id)"
                 [class.hid]="hidden().has(n.a.k)" tabindex="0" role="button" [attr.aria-label]="n.a.name + ', ' + label[n.a.k]"
                 (click)="pickNode(n.a.id, $event)" (keydown.enter)="pickNode(n.a.id, $event)">
                <title>{{ n.a.name }} ({{ label[n.a.k] }})</title>
                @if (isNext(n.a.id)) {
                  <circle class="ring" [attr.cx]="n.cx" [attr.cy]="n.cy" [attr.r]="Math.max(n.a.w, n.a.h) / 2 + 9" />
                }
                @switch (n.shape) {
                  @case ('circle') { <circle class="sh" filter="url(#xd-shadow)" [attr.cx]="n.cx" [attr.cy]="n.cy" [attr.r]="n.r" [attr.fill]="colour[n.a.k]" /> }
                  @case ('diamond') { <path class="sh" filter="url(#xd-shadow)" [attr.d]="n.d" [attr.fill]="colour[n.a.k]" /> }
                  @default { <rect class="sh" filter="url(#xd-shadow)" [attr.x]="n.cx - n.a.w / 2" [attr.y]="n.cy - n.a.h / 2" [attr.width]="n.a.w" [attr.height]="n.a.h" rx="9" [attr.fill]="colour[n.a.k]" /> }
                }
                <g [attr.transform]="n.iconTransform" [attr.fill]="icons[n.a.k].solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" class="ic">
                  <path [attr.d]="icons[n.a.k].d" />
                </g>
                <text [attr.x]="n.cx" [attr.y]="n.cy + n.a.h / 2 + (n.a.k === 'gw' ? 16 : 12)" text-anchor="middle">{{ short(n.a.name) }}</text>
                @if (order(n.a.id); as o) {
                  <g class="badge" [attr.transform]="'translate(' + (n.cx - n.a.w / 2 - 2) + ' ' + (n.cy - n.a.h / 2 - 2) + ')'">
                    <circle r="9" /><text y="3.4" text-anchor="middle">{{ o }}</text>
                  </g>
                }
              </g>
            }
          </svg>
        </div>

        <svg class="mini" [attr.viewBox]="'0 0 ' + geometry().w + ' ' + geometry().h" preserveAspectRatio="xMidYMid meet" (click)="miniClick($event)" aria-hidden="true">
          <rect [attr.width]="geometry().w" [attr.height]="geometry().h" class="mbg" />
          @for (n of geometry().nodes; track n.a.id) {
            <circle [attr.cx]="n.cx" [attr.cy]="n.cy" [attr.r]="Math.max(6, geometry().w / 140)" [attr.fill]="colour[n.a.k]" [attr.opacity]="dimNode(n.a) ? 0.25 : 1" />
          }
          <rect class="view" [attr.x]="view().x" [attr.y]="view().y" [attr.width]="view().w" [attr.height]="view().h" />
        </svg>
      </div>

      <aside class="col-span-12 xl:col-span-4 panel" aria-live="polite">
        @switch (mode().kind) {
          @case ('none') {
            <p class="text-muted-color"><i class="pi pi-info-circle mr-1"></i>Select a step or an arrow to see its details, or press <b>Trace from start</b> to follow the flow.</p>
            <p class="text-muted-color small"><i class="pi pi-arrows-alt mr-1"></i>Drag to move around. Ctrl and wheel to zoom.</p>
          }
          @case ('node') {
            @if (selectedNode(); as a) {
              <div class="head">
                <svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="12" [attr.fill]="colour[a.k]" /><g transform="translate(4.8 4.8) scale(0.6)" [attr.fill]="icons[a.k].solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons[a.k].d" /></g></svg>
                <div><div class="font-semibold text-lg">{{ a.name }}</div><div class="mono text-muted-color">{{ label[a.k] }} · {{ a.id }}</div></div>
              </div>
              <div class="section"><i class="pi pi-comment"></i> In business terms</div>
              <div>{{ describe(a) }}</div>
              @if (detailEntries(a).length > 0) {
                <div class="section"><i class="pi pi-list"></i> Details</div>
                @for (d of detailEntries(a); track d[0]) {
                  <div class="kv"><b>{{ d[0] }}:</b> @if (d[0] === 'Script') { <code>{{ d[1] }}</code> } @else { {{ d[1] }} }</div>
                }
              }
              <div class="section"><i class="pi pi-arrow-circle-right"></i> Comes from ({{ incoming(a.id).length }})</div>
              @for (t of incoming(a.id); track t.id) {
                <button type="button" class="row" (click)="pickNode(t.f, $event)">
                  <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(t.f)]" /></svg>
                  <span><b>{{ nameOf(t.f) }}</b>@if (t.cond) { <small><i class="pi pi-question-circle"></i> {{ plain(t.cond) }}</small> }</span>
                </button>
              } @empty { <small class="text-muted-color">None</small> }
              <div class="section"><i class="pi pi-arrow-circle-left"></i> Goes to ({{ outgoing(a.id).length }})</div>
              @for (t of outgoing(a.id); track t.id) {
                <button type="button" class="row" (click)="pickNode(t.t, $event)">
                  <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(t.t)]" /></svg>
                  <span><b>{{ nameOf(t.t) }}</b>@if (t.cond) { <small><i class="pi pi-question-circle"></i> {{ plain(t.cond) }}</small> }</span>
                </button>
              } @empty { <small class="text-muted-color">None</small> }
            }
          }
          @case ('edge') {
            @if (selectedEdge(); as t) {
              <div class="font-semibold text-lg">{{ t.link ? 'Timeout link' : t.name || 'Transition' }}</div>
              <span class="mono text-muted-color">{{ t.id }}</span>
              <div class="section"><i class="pi pi-sort-alt"></i> Path</div>
              <button type="button" class="row" (click)="pickNode(t.f, $event)"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(t.f)]" /></svg><span><b>{{ nameOf(t.f) }}</b></span></button>
              <div class="text-center text-muted-color"><i class="pi pi-arrow-down"></i></div>
              <button type="button" class="row" (click)="pickNode(t.t, $event)"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(t.t)]" /></svg><span><b>{{ nameOf(t.t) }}</b></span></button>
              <div class="section"><i class="pi pi-question-circle"></i> Condition</div>
              @if (t.link) {
                <div class="text-muted-color"><i class="pi pi-clock mr-1"></i>Taken when the step takes too long.</div>
              } @else if (t.cond) {
                <div><code>{{ t.cond }}</code></div>
                <div class="text-muted-color mt-1">{{ plain(t.cond) }}</div>
              } @else { <div class="text-muted-color">{{ t.ct ? 'Default path (' + t.ct.toLowerCase() + ')' : 'Always taken (no condition)' }}</div> }
              @if (t.desc) { <div class="section"><i class="pi pi-align-left"></i> Description</div><div>{{ t.desc }}</div> }
            }
          }
          @case ('trace') {
            @if (current(); as a) {
              <div class="head">
                <svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="12" [attr.fill]="colour[a.k]" /><g transform="translate(4.8 4.8) scale(0.6)" [attr.fill]="icons[a.k].solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons[a.k].d" /></g></svg>
                <div><div class="text-muted-color small">Step {{ trace().length }}</div><div class="font-semibold text-lg">{{ a.name }}</div></div>
              </div>
              <div class="mt-2">{{ describe(a) }}</div>
              @for (d of detailEntries(a, true); track d[0]) { <div class="kv"><b>{{ d[0] }}:</b> {{ d[1] }}</div> }
              @if (options().length > 0) {
                <div class="section"><i class="pi pi-directions"></i> Next ({{ options().length }})@if (options().length > 1) { <span> · pick one here or on the diagram</span> }</div>
                @for (o of options(); track $index) {
                  <button type="button" class="row go" (click)="follow(o)">
                    <svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="12" [attr.fill]="colour[kindOf(o.to)]" /><g transform="translate(4.8 4.8) scale(0.6)" [attr.fill]="icons[kindOf(o.to)].solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons[kindOf(o.to)].d" /></g></svg>
                    <span><b>{{ nameOf(o.to) }}</b>
                      @if (o.cond) { <small><i class="pi pi-question-circle"></i> {{ plain(o.cond) }}</small> }
                      @if (o.label && !o.cond && !o.timeout) { <small>{{ o.label }}</small> }
                      @if (o.timeout) { <small><i class="pi pi-clock"></i> If the step takes too long</small> }
                    </span>
                    <i class="pi pi-arrow-right"></i>
                  </button>
                }
              } @else {
                <div class="section"><i class="pi pi-flag"></i> End of this path</div>
              }
            }
          }
        }
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 10px; }
    .sep { width: 1px; height: 22px; background: var(--p-content-border-color, #d5d9e0); margin: 0 4px; }
    .pct { border: 0; background: transparent; color: inherit; font: 600 12px ui-monospace, Menlo, monospace; min-width: 44px; cursor: pointer; }
    :host ::ng-deep .find { width: 190px; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
    .kind { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--p-content-border-color, #d5d9e0); background: var(--p-content-background, #fff); color: inherit; border-radius: 99px; padding: 2px 9px 2px 3px; font-size: 12px; cursor: pointer; }
    .kind.plain { padding: 2px 3px; cursor: default; }
    .kind.off { opacity: 0.4; }
    .tracebar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; margin-bottom: 10px; border-radius: 10px; background: color-mix(in srgb, var(--p-primary-color, #2f5fd0) 9%, transparent); border: 1px solid color-mix(in srgb, var(--p-primary-color, #2f5fd0) 35%, transparent); }
    .crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; margin-left: 8px; color: var(--p-text-muted-color, #667085); }
    .crumb { display: inline-flex; align-items: center; gap: 3px; border: 0; background: transparent; color: inherit; font-size: 12px; cursor: pointer; padding: 1px 4px; border-radius: 6px; }
    .crumb:hover { background: var(--p-content-hover-background, #f1f5f9); }
    .crumb.cur { font-weight: 700; color: var(--p-primary-color, #2f5fd0); background: color-mix(in srgb, var(--p-primary-color, #2f5fd0) 14%, transparent); }
    .stage { position: relative; }
    .canvas { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 12px; overflow: auto; height: 68vh; background:
      radial-gradient(circle, color-mix(in srgb, var(--p-text-muted-color, #667085) 28%, transparent) 1px, transparent 1.2px) 0 0 / 22px 22px, var(--p-content-background, #fff); cursor: grab; outline: none; }
    .canvas.drag { cursor: grabbing; }
    .canvas:focus-visible { box-shadow: 0 0 0 2px var(--p-primary-color, #2f5fd0); }
    .mini { position: absolute; right: 14px; bottom: 14px; width: 170px; height: 110px; border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; background: color-mix(in srgb, var(--p-content-background, #fff) 90%, transparent); box-shadow: 0 2px 8px rgba(0,0,0,.15); cursor: pointer; }
    .mini .mbg { fill: transparent; }
    .mini .view { fill: color-mix(in srgb, var(--p-primary-color, #2f5fd0) 15%, transparent); stroke: var(--p-primary-color, #2f5fd0); stroke-width: 3; vector-effect: non-scaling-stroke; }
    .panel { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 12px; padding: 14px; max-height: 68vh; overflow: auto; align-self: start; }
    .head { display: flex; align-items: center; gap: 10px; }
    .small { font-size: 12px; }
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--p-text-muted-color, #667085); margin: 14px 0 5px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
    .kv { margin: 3px 0; word-break: break-word; }
    .kv b { color: var(--p-text-muted-color, #667085); font-weight: 600; }
    .row { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px; border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; margin-bottom: 5px; cursor: pointer; background: transparent; color: inherit; font: inherit; }
    .row > span { flex: 1; min-width: 0; }
    .row:hover { border-color: var(--p-primary-color, #2f5fd0); background: var(--p-content-hover-background, #f8fafc); }
    .row.go { border-color: color-mix(in srgb, var(--p-primary-color, #2f5fd0) 45%, transparent); }
    .row small { display: block; color: var(--p-text-muted-color, #667085); word-break: break-word; }
    code { font: 12px ui-monospace, Menlo, monospace; background: var(--p-content-hover-background, #f1f5f9); padding: 1px 4px; border-radius: 3px; word-break: break-word; }
    svg .n { cursor: pointer; outline: none; transition: opacity .15s; }
    svg .n text { fill: var(--p-text-color, #1d2330); font-size: 9.5px; font-weight: 500; pointer-events: none; paint-order: stroke; stroke: var(--p-content-background, #fff); stroke-width: 3px; stroke-linejoin: round; }
    svg .n .ic { pointer-events: none; }
    svg .n:hover .sh, svg .n:focus-visible .sh { stroke: var(--p-primary-color, #2f5fd0); stroke-width: 2.4; }
    svg .sh { stroke: var(--p-content-background, #fff); stroke-width: 1.4; }
    svg .n.sel .sh { stroke: var(--p-primary-color, #2f5fd0); stroke-width: 3.2; }
    svg .n.cur .sh { stroke: var(--p-primary-color, #2f5fd0); stroke-width: 4; }
    svg .n.hid { opacity: 0.12; }
    svg .ring { fill: none; stroke: var(--p-primary-color, #2f5fd0); stroke-width: 2.5; stroke-dasharray: 5 4; animation: xd-pulse 1.1s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
    svg .badge circle { fill: var(--p-primary-color, #2f5fd0); stroke: var(--p-content-background, #fff); stroke-width: 1.5; }
    svg .badge text { fill: #fff; font-size: 9.5px; font-weight: 700; stroke: none; }
    svg .e { stroke: var(--p-text-muted-color, #667085); stroke-width: 1.3; fill: none; opacity: 0.55; stroke-linejoin: round; }
    svg .e.link { stroke: #c4457a; stroke-dasharray: 5 4; opacity: 0.8; }
    svg .e.hl { stroke: #2f5fd0; stroke-width: 2.6; opacity: 1; }
    svg .e.flow { stroke-dasharray: 8 5; animation: xd-flow 0.8s linear infinite; }
    svg .e.next { stroke: #2f5fd0; stroke-width: 2.2; opacity: 1; stroke-dasharray: 3 4; }
    svg .eh { stroke: transparent; stroke-width: 12; fill: none; cursor: pointer; }
    svg .cond { cursor: pointer; }
    svg .cond circle { fill: var(--p-content-background, #fff); stroke: var(--p-text-muted-color, #667085); stroke-width: 1.4; }
    svg .cond path { stroke: var(--p-text-muted-color, #667085); stroke-width: 1.9; stroke-linecap: round; fill: none; }
    svg .cond:hover circle { stroke: var(--p-primary-color, #2f5fd0); }
    svg .dim { opacity: 0.14; }
    @keyframes xd-flow { to { stroke-dashoffset: -26; } }
    @keyframes xd-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(1.07); } }
    @media (prefers-reduced-motion: reduce) { svg .ring, svg .e.flow { animation: none; } }
  `]
})
export class XpdlDiagramComponent {
  readonly colour = KIND_COLOUR;
  readonly label = KIND_LABEL;
  readonly icons = ICONS;
  readonly Math = Math;

  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;

  private readonly model = signal<ProcessData | null>(null);

  @Input({ required: true }) set data(value: ProcessData) {
    this.model.set(value);
    this.mode.set({ kind: 'none' });
    this.hidden.set(new Set());
    this.zoom.set(1);
    setTimeout(() => this.fit(), 0);
  }

  readonly mode = signal<Mode>({ kind: 'none' });
  readonly hidden = signal<Set<Kind>>(new Set());
  readonly zoom = signal(1);
  readonly dragging = signal(false);
  private readonly scroll = signal({ l: 0, t: 0, w: 1, h: 1 });

  readonly zoomPct = computed(() => Math.round(this.zoom() * 100));

  private readonly acts = computed<Activity[]>(() => this.model()?.D.acts ?? []);
  private readonly trs = computed<Transition[]>(() => this.model()?.D.trs ?? []);
  private readonly byId = computed(() => new Map(this.acts().map(a => [a.id, a] as const)));

  /** Transitions plus the dashed links from a step to its timeout event. */
  private readonly edgesAll = computed<Edge[]>(() => {
    const links: Edge[] = this.acts()
      .filter(x => x.k === 'timer' && x.tgt && this.byId().has(x.tgt))
      .map(x => ({ id: 'to:' + x.id, f: x.tgt!, t: x.id, name: '', cond: '', desc: '', ct: '', link: true }));
    return [...this.trs(), ...links];
  });

  readonly presentKinds = computed<Kind[]>(() => {
    const present = new Set(this.acts().map(a => a.k));
    return (Object.keys(KIND_LABEL) as Kind[]).filter(k => present.has(k));
  });
  readonly stepOptions = computed(() => this.acts().map(a => ({ id: a.id, name: a.name })));

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
      return { w: 100, h: 100, nodes: [], edges: [] as { t: Edge; d: string; mx: number; my: number }[] };
    }
    const pad = 44;
    const centre = (a: Activity): [number, number] => [a.x - minx + pad + a.w / 2, a.y - miny + pad + a.h / 2];
    const nodes = acts.map(a => {
      const [cx, cy] = centre(a);
      const shape = a.k === 'start' || a.k === 'end' || a.k === 'timer' ? 'circle' : a.k === 'gw' ? 'diamond' : 'box';
      const d = `M${cx} ${cy - a.h / 2 - 3}L${cx + a.w / 2 + 3} ${cy}L${cx} ${cy + a.h / 2 + 3}L${cx - a.w / 2 - 3} ${cy}z`;
      const s = Math.max(12, Math.min(a.w, a.h) * (shape === 'diamond' ? 0.5 : 0.58));
      const iconTransform = `translate(${cx - s / 2} ${cy - s / 2}) scale(${s / 24})`;
      return { a, cx, cy, shape, r: a.w / 2 + (a.k === 'timer' ? 0 : 1), d, iconTransform };
    });
    const edges: { t: Edge; d: string; mx: number; my: number }[] = [];
    for (const t of this.edgesAll()) {
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
      let mx: number;
      let my: number;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const sx = ax + Math.sign(dx || 1) * (a.w / 2 + 2);
        const tx = bx - Math.sign(dx || 1) * (b.w / 2 + 2);
        mx = (sx + tx) / 2;
        my = (ay + by) / 2;
        d = `M${sx} ${ay}H${mx}V${by}H${tx}`;
      } else {
        const sy = ay + Math.sign(dy) * (a.h / 2 + 2);
        const ty = by - Math.sign(dy) * (b.h / 2 + 2);
        my = (sy + ty) / 2;
        mx = (ax + bx) / 2;
        d = `M${ax} ${sy}V${my}H${bx}V${ty}`;
      }
      edges.push({ t, d, mx, my });
    }
    return { w: maxx - minx + pad * 2, h: maxy - miny + pad * 2 + 20, nodes, edges };
  });

  /** The visible window in drawing coordinates, for the minimap. */
  readonly view = computed(() => {
    const z = this.zoom();
    const s = this.scroll();
    return { x: s.l / z, y: s.t / z, w: s.w / z, h: s.h / z };
  });

  readonly selectedNode = computed(() => {
    const m = this.mode();
    return m.kind === 'node' ? this.byId().get(m.id) ?? null : null;
  });
  readonly selectedEdge = computed(() => {
    const m = this.mode();
    return m.kind === 'edge' ? this.edgesAll().find(t => t.id === m.id) ?? null : null;
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
    return a ? this.optionsOf(a, true) : [];
  });
  private readonly nextIds = computed(() => new Set(this.options().map(o => o.to)));

  // what is lit up while something is selected
  private readonly focus = computed(() => {
    const m = this.mode();
    const nodes = new Set<string>();
    const edges = new Set<string>();
    const selected = new Set<string>();
    const flow = new Set<string>();
    const order = new Map<string, number>();
    const all = this.edgesAll();
    if (m.kind === 'node') {
      selected.add(m.id);
      nodes.add(m.id);
      all.filter(t => t.f === m.id || t.t === m.id).forEach(t => {
        edges.add(t.id);
        nodes.add(t.f);
        nodes.add(t.t);
      });
    } else if (m.kind === 'edge') {
      edges.add(m.id);
      const t = all.find(x => x.id === m.id);
      if (t) {
        nodes.add(t.f);
        nodes.add(t.t);
      }
    } else if (m.kind === 'trace') {
      m.path.forEach((id, i) => {
        nodes.add(id);
        selected.add(id);
        if (!order.has(id)) {
          order.set(id, i + 1);
        }
        if (i) {
          const t = all.find(x => x.f === m.path[i - 1] && x.t === id);
          if (t) {
            edges.add(t.id);
            flow.add(t.id);
          }
        }
      });
      const cur = m.path[m.path.length - 1];
      this.nextIds().forEach(id => {
        nodes.add(id);
        const t = all.find(x => x.f === cur && x.t === id);
        if (t) {
          edges.add(t.id);
        }
      });
    }
    return { nodes, edges, selected, flow, order, active: m.kind !== 'none' };
  });

  private optionsOf(a: Activity, withLabel: boolean): Option[] {
    const o: Option[] = this.trs().filter(t => t.f === a.id).map(t => ({ to: t.t, label: t.name, cond: t.cond, timeout: false }));
    this.acts().filter(x => x.k === 'timer' && x.tgt === a.id)
      .forEach(x => o.push({ to: x.id, label: withLabel ? 'Timeout / error event' : '', cond: '', timeout: true }));
    return o;
  }

  dimNode(a: Activity): boolean {
    const f = this.focus();
    return f.active && !f.nodes.has(a.id);
  }
  dimEdge(id: string): boolean {
    const f = this.focus();
    return f.active && !f.edges.has(id);
  }
  highlightEdge(id: string): boolean {
    return this.focus().edges.has(id) && !this.nextEdge(id);
  }
  flowEdge(id: string): boolean {
    return this.focus().flow.has(id);
  }
  nextEdge(id: string): boolean {
    const m = this.mode();
    if (m.kind !== 'trace') {
      return false;
    }
    const t = this.edgesAll().find(x => x.id === id);
    return !!t && t.f === m.path[m.path.length - 1] && this.nextIds().has(t.t);
  }
  isSelected(id: string): boolean {
    return this.focus().selected.has(id);
  }
  isNext(id: string): boolean {
    return this.mode().kind === 'trace' && this.nextIds().has(id);
  }
  isCurrent(id: string): boolean {
    const p = this.trace();
    return p.length > 0 && p[p.length - 1] === id;
  }
  order(id: string): number | null {
    return this.focus().order.get(id) ?? null;
  }

  count(k: Kind): number {
    return this.acts().filter(a => a.k === k).length;
  }
  short(name: string): string {
    return name.length > 24 ? name.slice(0, 23) + '…' : name;
  }
  nameOf(id: string): string {
    return this.byId().get(id)?.name ?? id;
  }
  kindOf(id: string): Kind {
    return this.byId().get(id)?.k ?? 'task';
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

  // ---- zoom, pan, minimap ----
  zoomBy(step: number): void {
    this.zoomTo(this.zoom() + step);
  }
  zoomTo(z: number): void {
    const el = this.canvas?.nativeElement;
    const old = this.zoom();
    const next = Math.max(0.2, Math.min(2.5, Math.round(z * 100) / 100));
    if (el) {
      // keep the middle of the window where it is
      const cx = (el.scrollLeft + el.clientWidth / 2) / old;
      const cy = (el.scrollTop + el.clientHeight / 2) / old;
      this.zoom.set(next);
      setTimeout(() => {
        el.scrollLeft = cx * next - el.clientWidth / 2;
        el.scrollTop = cy * next - el.clientHeight / 2;
        this.onScroll();
      }, 0);
    } else {
      this.zoom.set(next);
    }
  }
  fit(): void {
    const el = this.canvas?.nativeElement;
    const g = this.geometry();
    if (!el || !el.clientWidth) {
      return;
    }
    const z = Math.min(el.clientWidth / g.w, el.clientHeight / g.h, 1.4);
    this.zoom.set(Math.max(0.2, Math.round(z * 100) / 100));
    setTimeout(() => {
      el.scrollLeft = 0;
      el.scrollTop = 0;
      this.onScroll();
    }, 0);
  }
  onScroll(): void {
    const el = this.canvas?.nativeElement;
    if (el) {
      this.scroll.set({ l: el.scrollLeft, t: el.scrollTop, w: el.clientWidth, h: el.clientHeight });
    }
  }
  @HostListener('window:resize')
  onResize(): void {
    this.onScroll();
  }
  onWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
    }
  }

  private drag: { x: number; y: number; l: number; t: number; moved: boolean } | null = null;
  down(e: PointerEvent): void {
    const el = this.canvas?.nativeElement;
    if (!el || e.button !== 0 || (e.target as Element).closest('.n, .eh, .cond')) {
      return;
    }
    this.drag = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, moved: false };
    el.setPointerCapture(e.pointerId);
  }
  move(e: PointerEvent): void {
    const el = this.canvas?.nativeElement;
    if (!this.drag || !el) {
      return;
    }
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      this.drag.moved = true;
      this.dragging.set(true);
    }
    el.scrollLeft = this.drag.l - dx;
    el.scrollTop = this.drag.t - dy;
  }
  up(e: PointerEvent): void {
    const el = this.canvas?.nativeElement;
    if (this.drag && el) {
      el.releasePointerCapture?.(e.pointerId);
      // a click on the empty background (no drag) closes the details, but never ends a trace
      if (!this.drag.moved && this.mode().kind !== 'trace') {
        this.clear();
      }
    }
    this.drag = null;
    this.dragging.set(false);
  }
  miniClick(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    const el = this.canvas?.nativeElement;
    if (!el) {
      return;
    }
    const box = svg.getBoundingClientRect();
    const g = this.geometry();
    // the minimap keeps the aspect ratio, so work out where the drawing sits inside it
    const scale = Math.min(box.width / g.w, box.height / g.h);
    const offX = (box.width - g.w * scale) / 2;
    const offY = (box.height - g.h * scale) / 2;
    const x = (e.clientX - box.left - offX) / scale;
    const y = (e.clientY - box.top - offY) / scale;
    el.scrollTo({ left: x * this.zoom() - el.clientWidth / 2, top: y * this.zoom() - el.clientHeight / 2, behavior: 'smooth' });
  }

  // ---- selection and trace ----
  pickNode(id: string, e?: Event): void {
    e?.stopPropagation();
    const m = this.mode();
    if (m.kind === 'trace') {
      const next = this.options().find(o => o.to === id);
      if (next) {
        this.follow(next);
        return;
      }
      const at = m.path.indexOf(id);
      if (at >= 0) {
        this.cutTrace(at);
      }
      return;
    }
    this.mode.set({ kind: 'node', id });
    this.reveal(id);
  }
  pickEdge(id: string, e?: Event): void {
    e?.stopPropagation();
    if (this.mode().kind === 'trace') {
      return;
    }
    this.mode.set({ kind: 'edge', id });
  }
  clear(): void {
    this.mode.set({ kind: 'none' });
  }
  goTo(id: string | null): void {
    if (!id) {
      return;
    }
    if (this.mode().kind === 'trace') {
      this.reveal(id);
      return;
    }
    this.pickNode(id);
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
      this.canvas?.nativeElement.focus({ preventScroll: true });
    }
  }
  follow(o: Option): void {
    const m = this.mode();
    if (m.kind === 'trace') {
      this.mode.set({ kind: 'trace', path: [...m.path, o.to] });
      this.reveal(o.to);
    }
  }
  /** Follows the flow while there is only one way on, and stops at a decision, the end, or a loop. */
  runToDecision(): void {
    const m = this.mode();
    if (m.kind !== 'trace') {
      return;
    }
    const path = [...m.path];
    for (let guard = 0; guard < 300; guard++) {
      const a = this.byId().get(path[path.length - 1]);
      const o = a ? this.optionsOf(a, false) : [];
      if (o.length !== 1 || path.includes(o[0].to)) {
        break;
      }
      path.push(o[0].to);
    }
    this.mode.set({ kind: 'trace', path });
    this.reveal(path[path.length - 1]);
  }
  cutTrace(index: number): void {
    const m = this.mode();
    if (m.kind === 'trace') {
      this.mode.set({ kind: 'trace', path: m.path.slice(0, index + 1) });
      this.reveal(m.path[index]);
    }
  }
  undoTrace(): void {
    const m = this.mode();
    if (m.kind === 'trace' && m.path.length > 1) {
      this.mode.set({ kind: 'trace', path: m.path.slice(0, -1) });
      this.reveal(m.path[m.path.length - 2]);
    }
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.mode().kind !== 'trace' || (e.target as Element).closest('input, textarea, .p-select')) {
      return;
    }
    if (e.key === 'ArrowRight' && this.options().length === 1) {
      e.preventDefault();
      this.follow(this.options()[0]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.undoTrace();
    } else if (e.key === 'Escape') {
      this.clear();
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
