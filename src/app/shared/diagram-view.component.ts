import { ButtonModule } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { ActivityState, DiagramGraph, DiagramNode, NodeKind, Overlay } from '../core/models';
import {
  Shape, ViewBox, diamondPoints, edgePoints, kindLabel, shapeOf, toPath, viewBoxOf, wrapLabel
} from '../core/diagram-geometry';
import { formatDuration } from '../core/format';
import { activityLook } from '../core/status';
import { DiagramLayout, emptyLayout, isEmptyLayout, loadLayout, orthogonal, saveLayout, snap } from '../core/diagram-layout';

interface Icon {
  d: string;
  solid?: boolean;
}

/** What a step is, as an icon on a 24 by 24 grid. */
const KIND_ICON: Record<NodeKind, Icon> = {
  START: { d: 'M8 5v14l11-7z', solid: true },
  END: { d: 'M6.5 6.5h11v11h-11z', solid: true },
  USER_TASK: { d: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 21c0-4 3.4-7 7.5-7s7.5 3 7.5 7' },
  SCRIPT_TASK: { d: 'M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 5l-3 14' },
  DATABASE_TASK: { d: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3' },
  SERVICE_TASK: { d: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18' },
  SUB_PROCESS: { d: 'M4 4h16v16H4zM9 9h6v6H9z' },
  GATEWAY_EXCLUSIVE: { d: 'M12 4v6M12 10l-6 9M12 10l6 9' },
  GATEWAY_FORK: { d: 'M12 5v14M5 12h14' },
  ERROR_EVENT: { d: 'M12 4l9 16H3zM12 10v4M12 17v.5' },
  OTHER: { d: 'M5 12.5l4.5 4.5L19 7.5' }
};

/** The state of a step, as an icon: drawn white on a coloured disc. */
const STATUS_ICON: Record<string, Icon> = {
  running: { d: 'M9.5 6.5v11l8.5-5.5z', solid: true },
  done: { d: 'M6 12.5l4 4 8-9' },
  failed: { d: 'M7 7l10 10M17 7L7 17' },
  timeout: { d: 'M12 6.5V12l3.5 2.2' },
  suspended: { d: 'M9 7v10M15 7v10' },
  pending: { d: 'M7 12h.01M12 12h.01M17 12h.01' },
  unknown: { d: 'M12 7v6M12 16.5v.5' }
};

const STATUS_TEXT: Record<string, string> = {
  running: 'Running', done: 'Completed', failed: 'Failed', timeout: 'Timed out', suspended: 'Suspended', pending: 'Waiting', unknown: 'Unknown'
};

interface DrawNode {
  n: DiagramNode;
  shape: Shape;
  diamond: string;
  cx: number;
  cy: number;
  lines: string[];
  textY: number;
  kindIcon: Icon;
  kindTransform: string;
  /** Style class of the state ('running', 'done'...), 'idle' when the instance never got here. */
  cls: string;
  meta: string;
  overdue: boolean;
  aria: string;
  /** The problems worth a look: failed, timed out, suspended, overdue. */
  problem: boolean;
}

interface DrawEdge {
  id: string;
  d: string;
  taken: boolean;
  source: string;
  target: string;
  /** Where the grip sits, and which way dragging it pushes the middle segment. */
  mx: number;
  my: number;
  horiz: boolean;
}

/**
 * The process drawing with the live state of one instance on top. Every step carries an icon for what it is and a
 * badge for what happened to it (running, done, failed, timed out, suspended), arrows already travelled are drawn
 * heavier and animated, and the run can be followed step by step in the order it happened. Pan by dragging, zoom
 * with the wheel or the buttons, find a step by name, jump between the steps that need a look.
 */
@Component({
  selector: 'app-diagram-view',
  standalone: true,
  imports: [ButtonModule, FormsModule, SelectModule],
  template: `
    <div class="dv-toolbar">
      <p-button type="button" icon="pi pi-play" label="Follow the run" size="small" [disabled]="order.length === 0" (onClick)="startReplay()" />
      <span class="dv-sep"></span>
      <p-button type="button" icon="pi pi-search-plus" size="small" severity="secondary" [outlined]="true" (onClick)="zoom(1.25)" ariaLabel="Zoom in" />
      <button type="button" class="dv-pct" (click)="fit()" title="Fit to window">{{ zoomPct }}%</button>
      <p-button type="button" icon="pi pi-search-minus" size="small" severity="secondary" [outlined]="true" (onClick)="zoom(0.8)" ariaLabel="Zoom out" />
      <p-button type="button" icon="pi pi-expand" size="small" severity="secondary" [outlined]="true" (onClick)="fit()" ariaLabel="Fit to window" />
      <span class="dv-sep"></span>
      <p-select [ngModel]="null" (ngModelChange)="find($event)" [options]="stepOptions" optionLabel="name" optionValue="id"
        [filter]="true" filterBy="name" placeholder="Find a step" styleClass="dv-find" />
      @if (problems.length > 0) {
        <span class="dv-issues" role="group" aria-label="Steps that need a look">
          <p-button type="button" icon="pi pi-chevron-left" size="small" severity="danger" [outlined]="true" (onClick)="nextProblem(-1)" ariaLabel="Previous step that needs a look" />
          <span class="dv-issue-count" title="Steps that failed, timed out, are suspended or overdue">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            {{ problems.length }}
          </span>
          <p-button type="button" icon="pi pi-chevron-right" size="small" severity="danger" [outlined]="true" (onClick)="nextProblem(1)" ariaLabel="Next step that needs a look" />
        </span>
      }
      @if (hasLayout) {
        <p-button type="button" icon="pi pi-undo" label="Reset layout" size="small" severity="secondary" [outlined]="true" (onClick)="resetLayout()" />
      }
      <span class="dv-spacer"></span>
      <span class="dv-legend" aria-label="Legend: click a state to focus on it">
        @for (s of legend; track s.cls) {
          <button type="button" class="dv-chip" [class.on]="focusState === s.cls" [style.--st]="'var(--c-' + s.cls + ')'" [title]="s.text + ' (' + s.count + ')'"
                  (click)="toggleState(s.cls)" [attr.aria-pressed]="focusState === s.cls">
            <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="12" class="dv-disc" /><g transform="translate(5 5) scale(0.58)" [attr.fill]="icons(s.cls).solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons(s.cls).d" /></g></svg>
            <b>{{ s.count }}</b>
          </button>
        }
        <span class="dv-chip plain" title="Step the instance has not reached"><svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="none" stroke="var(--c-idle)" stroke-width="2.4" stroke-dasharray="3 3" /></svg></span>
      </span>
    </div>

    @if (replay !== null) {
      <div class="dv-replay" role="group" aria-label="Follow the run">
        <p-button type="button" icon="pi pi-fast-backward" size="small" severity="secondary" [outlined]="true" [disabled]="replay === 0" (onClick)="goReplay(0)" ariaLabel="First step" />
        <p-button type="button" icon="pi pi-step-backward" size="small" severity="secondary" [outlined]="true" [disabled]="replay === 0" (onClick)="goReplay(replay - 1)" ariaLabel="Previous step" />
        <p-button type="button" icon="pi pi-step-forward" size="small" [disabled]="replay >= order.length - 1" (onClick)="goReplay(replay + 1)" ariaLabel="Next step" />
        <p-button type="button" icon="pi pi-fast-forward" size="small" severity="secondary" [outlined]="true" [disabled]="replay >= order.length - 1" (onClick)="goReplay(order.length - 1)" ariaLabel="Where it is now" />
        <p-button type="button" icon="pi pi-times" size="small" severity="secondary" [text]="true" (onClick)="stopReplay()" ariaLabel="Stop following" />
        <span class="dv-count">{{ replay + 1 }} of {{ order.length }}</span>
        <span class="dv-crumbs">
          @for (id of order; track id; let i = $index) {
            <button type="button" class="dv-crumb" [class.cur]="i === replay" [class.future]="i > replay" [style.--st]="'var(--c-' + stateOf(id) + ')'"
                    (click)="goReplay(i)" [title]="nameOf(id)"><i></i>{{ i + 1 }}</button>
          }
        </span>
      </div>
    }

    <div class="dv-stage">
      <svg #svg class="dv-svg" [attr.viewBox]="vbText" role="group" aria-label="Process diagram with instance state"
           (wheel)="onWheel($event)" (pointerdown)="onDown($event)" (pointermove)="onMove($event)"
           (pointerup)="onUp($event)" (pointercancel)="onUp($event)">
        <defs>
          <marker id="dv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" class="dv-arrow"></path>
          </marker>
          <marker id="dv-arrow-taken" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" class="dv-arrow taken"></path>
          </marker>
          <marker id="dv-arrow-next" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" class="dv-arrow next"></path>
          </marker>
        </defs>
        @for (e of edges; track e.id) {
          <g class="dv-eg">
            <path class="dv-edge" [class.taken]="e.taken" [class.flow]="isFlow(e)" [class.next]="isNextEdge(e)" [class.dim]="dimEdge(e)" [attr.d]="e.d"
                  [attr.marker-end]="isNextEdge(e) ? 'url(#dv-arrow-next)' : e.taken ? 'url(#dv-arrow-taken)' : 'url(#dv-arrow)'"></path>
            <path class="dv-eh" [attr.d]="e.d"></path>
            <circle class="dv-bend" [attr.cx]="e.mx" [attr.cy]="e.my" r="5" [attr.data-bend]="e.id" [attr.data-horiz]="e.horiz"><title>Drag to bend this arrow</title></circle>
          </g>
        }
        @for (d of nodes; track d.n.id) {
          <g [class]="'dv-node st-' + d.cls" [attr.data-id]="d.n.activityId" [class.selected]="d.n.activityId === selectedId" [class.dim]="dimNode(d)" [class.current]="isCurrent(d)"
             tabindex="0" role="button" [attr.aria-label]="d.aria" (click)="pick(d)" (keydown.enter)="pick(d)" (keydown.space)="pick(d); $event.preventDefault()">
            <title>{{ d.aria }}</title>
            @if (isNext(d)) {
              <ellipse class="dv-ring" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.rx]="d.n.width / 2 + 8" [attr.ry]="d.n.height / 2 + 8"></ellipse>
            }
            @switch (d.shape) {
              @case ('diamond') {
                <polygon class="dv-shape" [attr.points]="d.diamond"></polygon>
              }
              @case ('circle') {
                <ellipse class="dv-shape" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.rx]="d.n.width / 2" [attr.ry]="d.n.height / 2"></ellipse>
              }
              @case ('double-circle') {
                <ellipse class="dv-shape" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.rx]="d.n.width / 2" [attr.ry]="d.n.height / 2"></ellipse>
                <ellipse class="dv-shape inner" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.rx]="d.n.width / 2 - 4" [attr.ry]="d.n.height / 2 - 4"></ellipse>
              }
              @default {
                <rect class="dv-shape" [attr.x]="d.n.x" [attr.y]="d.n.y" [attr.width]="d.n.width" [attr.height]="d.n.height" rx="8"></rect>
              }
            }
            <g class="dv-kind" [attr.transform]="d.kindTransform" [attr.fill]="d.kindIcon.solid ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path [attr.d]="d.kindIcon.d" />
            </g>
            @for (line of d.lines; track $index) {
              <text class="dv-label" text-anchor="middle" [attr.x]="d.cx" [attr.y]="d.textY + $index * 12">{{ line }}</text>
            }
            @if (d.meta) {
              <text class="dv-meta" text-anchor="middle" [attr.x]="d.cx" [attr.y]="d.n.y + d.n.height + 13">{{ d.meta }}</text>
            }
            @if (d.cls !== 'idle') {
              <g class="dv-badge" [attr.transform]="'translate(' + (d.n.x + d.n.width - 2) + ' ' + (d.n.y + 2) + ')'">
                <circle r="9" class="dv-disc" />
                <g transform="translate(-6.2 -6.2) scale(0.52)" [attr.fill]="icons(d.cls).solid ? '#fff' : 'none'" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="icons(d.cls).d" /></g>
              </g>
            }
            @if (d.overdue) {
              <g class="dv-overdue" [attr.transform]="'translate(' + (d.n.x + 2) + ' ' + (d.n.y + 2) + ')'">
                <circle r="8" /><path d="M0 -3.6v4.4M0 4v.4" />
              </g>
            }
            @if (orderOf(d); as o) {
              <g class="dv-order" [attr.transform]="'translate(' + (d.n.x + 2) + ' ' + (d.n.y + d.n.height - 2) + ')'">
                <circle r="8" /><text y="3.2" text-anchor="middle">{{ o }}</text>
              </g>
            }
          </g>
        }
      </svg>

      <svg class="dv-mini" [attr.viewBox]="fitText" preserveAspectRatio="xMidYMid meet" (click)="miniClick($event)" aria-hidden="true">
        <rect [attr.x]="fitBox.x" [attr.y]="fitBox.y" [attr.width]="fitBox.w" [attr.height]="fitBox.h" fill="transparent" />
        @for (d of nodes; track d.n.id) {
          <circle [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="Math.max(5, fitBox.w / 150)" [style.fill]="'var(--c-' + d.cls + ')'" [attr.opacity]="dimNode(d) ? 0.25 : 1" />
        }
        <rect class="view" [attr.x]="vb.x" [attr.y]="vb.y" [attr.width]="vb.w" [attr.height]="vb.h" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dv-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .dv-sep { width: 1px; height: 22px; background: var(--border); margin: 0 2px; }
    .dv-pct { border: 0; background: transparent; color: inherit; font: 600 12px ui-monospace, Menlo, monospace; min-width: 44px; cursor: pointer; }
    :host ::ng-deep .dv-find { width: 180px; }
    .dv-issues { display: inline-flex; align-items: center; gap: 4px; }
    .dv-issue-count { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: var(--c-failed); }
    .dv-spacer { flex: 1 1 auto; }
    .dv-legend { display: flex; gap: 4px; flex-wrap: wrap; }
    .dv-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: var(--surface); color: inherit; border-radius: 99px; padding: 2px 9px 2px 3px; font-size: 12px; cursor: pointer; }
    .dv-chip.plain { padding: 2px 3px; cursor: default; }
    .dv-chip.on { border-color: var(--st); box-shadow: 0 0 0 2px color-mix(in srgb, var(--st) 30%, transparent); }
    .dv-disc { fill: var(--st, var(--c-idle)); }
    .dv-replay { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 10px; margin-bottom: 8px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 9%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
    .dv-count { font-size: 12px; font-weight: 700; margin: 0 6px; }
    .dv-crumbs { display: flex; flex-wrap: wrap; gap: 3px; }
    .dv-crumb { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: inherit; font-size: 11px; cursor: pointer; padding: 1px 5px; border-radius: 6px; }
    .dv-crumb i { width: 9px; height: 9px; border-radius: 50%; background: var(--st); display: inline-block; }
    .dv-crumb:hover { background: var(--surface-2, rgba(128,128,128,.12)); }
    .dv-crumb.cur { font-weight: 800; background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .dv-crumb.future { opacity: .4; }
    .dv-stage { position: relative; }
    .dv-svg {
      width: 100%;
      height: 62vh;
      min-height: 360px;
      background: radial-gradient(circle, color-mix(in srgb, var(--muted) 28%, transparent) 1px, transparent 1.2px) 0 0 / 22px 22px, var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      touch-action: none;
      cursor: grab;
      user-select: none;
    }
    .dv-svg:active { cursor: grabbing; }
    .dv-mini { position: absolute; right: 12px; bottom: 12px; width: 170px; height: 110px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface) 90%, transparent); box-shadow: 0 2px 8px rgba(0,0,0,.15); cursor: pointer; }
    .dv-mini .view { fill: color-mix(in srgb, var(--accent) 15%, transparent); stroke: var(--accent); stroke-width: 3; vector-effect: non-scaling-stroke; }
    .dv-edge { fill: none; stroke: var(--c-idle); stroke-width: 1.4; opacity: 0.75; }
    .dv-edge.taken { stroke: var(--text); stroke-width: 2.4; opacity: 1; }
    .dv-edge.flow { stroke-dasharray: 8 5; animation: dv-flow .9s linear infinite; }
    .dv-edge.next { stroke: var(--accent); stroke-width: 2.2; stroke-dasharray: 3 4; opacity: 1; }
    .dv-edge.dim { opacity: .12; }
    .dv-eh { fill: none; stroke: transparent; stroke-width: 12; }
    .dv-bend { fill: var(--accent); stroke: var(--surface); stroke-width: 1.5; opacity: 0; cursor: move; transition: opacity .12s; }
    .dv-eg:hover .dv-bend, .dv-bend:hover { opacity: .9; }
    .dv-node { touch-action: none; }
    .dv-arrow { fill: var(--c-idle); }
    .dv-arrow.taken { fill: var(--text); }
    .dv-arrow.next { fill: var(--accent); }
    .dv-node { cursor: pointer; transition: opacity .15s; }
    .dv-node.dim { opacity: .14; }
    .dv-shape { fill: var(--surface); stroke: var(--st, var(--c-idle)); stroke-width: 1.6; }
    .dv-shape.inner { fill: none; }
    .dv-kind { color: var(--st, var(--muted)); pointer-events: none; }
    .dv-node.st-running .dv-shape { fill: color-mix(in srgb, var(--st) 14%, var(--surface)); stroke-width: 2.6; }
    .dv-node.st-failed .dv-shape,
    .dv-node.st-timeout .dv-shape { fill: color-mix(in srgb, var(--st) 16%, var(--surface)); stroke-width: 2.8; }
    .dv-node.st-suspended .dv-shape { fill: color-mix(in srgb, var(--st) 14%, var(--surface)); stroke-width: 2.4; stroke-dasharray: 5 3; }
    .dv-node.st-done .dv-shape { fill: color-mix(in srgb, var(--st) 10%, var(--surface)); }
    .dv-node.st-idle { opacity: 0.6; }
    .dv-node.st-idle.dim { opacity: .1; }
    .dv-node.selected .dv-shape { stroke-width: 3.6; filter: drop-shadow(0 0 3px var(--st, var(--accent))); }
    .dv-node.current .dv-shape { stroke-width: 4; filter: drop-shadow(0 0 5px var(--accent)); }
    .dv-node:focus-visible .dv-shape { stroke: var(--accent); stroke-width: 3.6; }
    .dv-label { fill: var(--text); font-size: 10.5px; pointer-events: none; }
    .dv-meta { fill: var(--st, var(--muted)); font-size: 10px; font-weight: 700; pointer-events: none; }
    .dv-badge { pointer-events: none; }
    .dv-badge .dv-disc { stroke: var(--surface); stroke-width: 1.5; }
    .dv-overdue { pointer-events: none; }
    .dv-overdue circle { fill: var(--c-failed); }
    .dv-overdue path { stroke: #fff; stroke-width: 2.2; stroke-linecap: round; fill: none; }
    .dv-order { pointer-events: none; }
    .dv-order circle { fill: var(--accent); stroke: var(--surface); stroke-width: 1.5; }
    .dv-order text { fill: #fff; font-size: 9px; font-weight: 800; }
    .dv-ring { fill: none; stroke: var(--accent); stroke-width: 2.4; stroke-dasharray: 5 4; animation: dv-pulse2 1.1s ease-in-out infinite; pointer-events: none; }
    @keyframes dv-pulse { 50% { opacity: 0.55; } }
    @keyframes dv-pulse2 { 50% { opacity: .35; } }
    @keyframes dv-flow { to { stroke-dashoffset: -26; } }
    .dv-node.st-running .dv-shape { animation: dv-pulse 2.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .dv-edge.flow, .dv-ring, .dv-node.st-running .dv-shape { animation: none; } }
  `]
})
export class DiagramViewComponent implements OnChanges {
  @Input({ required: true }) graph!: DiagramGraph;
  @Input() overlay?: Overlay;
  @Input() selectedId?: string;
  /** A click on a step: the parent opens its details. */
  @Output() selected = new EventEmitter<string>();
  /** Moving the highlight (find, issues, following the run) without opening anything. An empty id clears it. */
  @Output() focused = new EventEmitter<string>();
  @ViewChild('svg', { static: true }) svg!: ElementRef<SVGSVGElement>;

  readonly Math = Math;
  nodes: DrawNode[] = [];
  edges: DrawEdge[] = [];
  vb: ViewBox = { x: 0, y: 0, w: 800, h: 400 };
  fitBox: ViewBox = this.vb;
  stepOptions: { id: string; name: string }[] = [];
  legend: { cls: string; text: string; count: number }[] = [];
  /** Steps the instance went through, in the order they started. */
  order: string[] = [];
  /** Steps that need a look, in the same order. */
  problems: string[] = [];
  replay: number | null = null;
  focusState: string | null = null;

  private focusNodes: Set<string> | null = null;
  private focusEdges: Set<string> | null = null;
  private flowEdges = new Set<string>();
  private nextNodes = new Set<string>();
  private orderIndex = new Map<string, number>();
  private byId = new Map<string, DrawNode>();
  private drag?: { px: number; py: number; vx: number; vy: number; moved: boolean };
  private moving?: { kind: 'node' | 'bend'; id: string; px: number; py: number; base: [number, number] | number; moved: boolean; horiz?: boolean };
  /** Set for the click that follows a drag, so letting go of a moved step does not also select it. */
  private suppress = false;
  private states = new Map<string, ActivityState>();
  private taken = new Set<string>();
  private layoutKey = '';
  layout: DiagramLayout = emptyLayout();

  get vbText(): string {
    return `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`;
  }
  get fitText(): string {
    return `${this.fitBox.x} ${this.fitBox.y} ${this.fitBox.w} ${this.fitBox.h}`;
  }
  get hasLayout(): boolean {
    return !isEmptyLayout(this.layout);
  }
  get zoomPct(): number {
    return Math.round((this.fitBox.w / this.vb.w) * 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] || changes['overlay']) {
      this.build();
      this.replay = null;
    }
    this.refresh();
  }

  icons(cls: string): Icon {
    return STATUS_ICON[cls] ?? STATUS_ICON['unknown'];
  }
  stateOf(id: string): string {
    return this.byId.get(id)?.cls ?? 'idle';
  }
  nameOf(id: string): string {
    const n = this.byId.get(id)?.n;
    return n?.name?.trim() || id;
  }

  private build(): void {
    this.states = new Map<string, ActivityState>();
    for (const st of this.overlay?.activities ?? []) {
      this.states.set(st.activityId, st);
    }
    this.taken = new Set(this.overlay?.takenEdges ?? []);
    // one arrangement per process, shared by every instance of it
    this.layoutKey = `inst:${this.graph.processName ?? ''}:${this.graph.nodes.length}:${this.graph.nodes[0]?.activityId ?? ''}`;
    this.layout = loadLayout(this.layoutKey);
    this.relayout();
    this.fitBox = this.currentFit();
    this.vb = { ...this.fitBox };
  }

  /** Where the drawing ends when steps have been moved: never smaller than the definition's own bounds. */
  private currentFit(): ViewBox {
    const g = this.graph;
    let minX = g.minX, minY = g.minY, maxX = g.maxX, maxY = g.maxY;
    for (const d of this.nodes) {
      minX = Math.min(minX, d.n.x);
      minY = Math.min(minY, d.n.y);
      maxX = Math.max(maxX, d.n.x + d.n.width);
      maxY = Math.max(maxY, d.n.y + d.n.height);
    }
    return viewBoxOf({ ...g, minX, minY, maxX, maxY });
  }

  /** Builds the shapes and arrows from the definition's layout plus whatever was moved. Keeps the zoom and position. */
  private relayout(): void {
    const states = this.states;
    const taken = this.taken;
    const lay = this.layout;
    const eff: DiagramNode[] = this.graph.nodes.map(n => {
      const o = lay.n[n.activityId];
      return o ? { ...n, x: n.x + o[0], y: n.y + o[1] } : n;
    });
    const byActivity = new Map<string, DiagramNode>();
    for (const n of eff) {
      byActivity.set(n.activityId, n);
    }

    this.nodes = eff.map(n => {
      const s = states.get(n.activityId);
      const look = activityLook(s?.status);
      const shape = shapeOf(n.kind);
      const lines = shape === 'task' || shape === 'diamond'
        ? wrapLabel(n.name, Math.max(6, Math.floor((n.width - 10) / 5.6)), shape === 'diamond' ? 2 : 3)
        : [];
      const cx = n.x + n.width / 2;
      const cy = n.y + n.height / 2;
      const textY = cy - ((lines.length - 1) * 12) / 2 + 3 + (shape === 'diamond' ? 5 : 0);
      let meta = '';
      if (s && (s.status === 'RUNNING' || s.status === 'FAILED' || s.status === 'TIMEOUT' || s.status === 'SUSPENDED')) {
        meta = formatDuration(s.status === 'RUNNING' ? s.currentSeconds : s.totalSeconds);
      }
      if (s && s.executions > 1) {
        meta = (meta ? meta + ' ' : '') + '×' + s.executions;
      }
      const name = n.name?.trim() || n.activityId;
      const what = kindLabel(n.kind);
      const aria = s
        ? `${name}${what ? ' (' + what + ')' : ''}: ${look.label}${s.overdue ? ', overdue' : ''}${s.performers.length ? ', with ' + s.performers.join(', ') : ''}`
        : `${name}${what ? ' (' + what + ')' : ''}: not reached`;
      // icon: centred on events, on top of a diamond's label, in the corner of a task
      let size = 14;
      let ix = n.x + 6;
      let iy = n.y + 6;
      if (shape === 'circle' || shape === 'double-circle') {
        size = Math.max(12, Math.min(n.width, n.height) * 0.5);
        ix = cx - size / 2;
        iy = cy - size / 2;
      } else if (shape === 'diamond') {
        size = 13;
        ix = cx - size / 2;
        iy = cy - n.height * 0.3;
      }
      return {
        n, shape, diamond: shape === 'diamond' ? diamondPoints(n) : '', cx, cy, lines, textY,
        kindIcon: KIND_ICON[n.kind] ?? KIND_ICON.OTHER,
        kindTransform: `translate(${ix} ${iy}) scale(${size / 24})`,
        cls: look.cls, meta, overdue: s?.overdue === true, aria,
        problem: !!s && (s.status === 'FAILED' || s.status === 'TIMEOUT' || s.status === 'SUSPENDED' || s.overdue)
      };
    });
    this.byId = new Map(this.nodes.map(d => [d.n.activityId, d] as const));

    const edges: DrawEdge[] = [];
    for (const e of this.graph.edges) {
      const s = byActivity.get(e.sourceActivityId);
      const t = byActivity.get(e.targetActivityId);
      if (!s || !t) {
        continue;
      }
      const bend = lay.b[e.id];
      let d: string;
      let mx: number;
      let my: number;
      let horiz: boolean;
      if (bend !== undefined || lay.n[s.activityId] || lay.n[t.activityId]) {
        // a moved step or a bent arrow is drawn in right angles between the two steps
        const r = orthogonal({ x: s.x, y: s.y, w: s.width, h: s.height }, { x: t.x, y: t.y, w: t.width, h: t.height }, bend ?? 0);
        ({ d, mx, my, horiz } = r);
      } else {
        const pts = edgePoints(e, byActivity);
        d = toPath(pts);
        const m = midPoint(pts);
        mx = m.x;
        my = m.y;
        // same rule as the right-angle route, so the first drag pushes the segment the way it looks like it should
        horiz = Math.abs(t.x + t.width / 2 - (s.x + s.width / 2)) >= Math.abs(t.y + t.height / 2 - (s.y + s.height / 2));
      }
      if (d.length > 0) {
        edges.push({ id: e.id, d, taken: taken.has(e.id), source: e.sourceActivityId, target: e.targetActivityId, mx, my, horiz });
      }
    }
    this.edges = edges;

    this.stepOptions = this.nodes.map(d => ({ id: d.n.activityId, name: d.n.name?.trim() || d.n.activityId }));

    const started = (id: string) => {
      const t = Date.parse(states.get(id)?.firstStart ?? '');
      return isNaN(t) ? 0 : t;
    };
    this.order = this.nodes.filter(d => states.has(d.n.activityId)).map(d => d.n.activityId)
      .map((id, i) => ({ id, i, t: started(id) })).sort((a, b) => a.t - b.t || a.i - b.i).map(x => x.id);
    this.orderIndex = new Map(this.order.map((id, i) => [id, i + 1] as const));
    this.problems = this.order.filter(id => this.byId.get(id)?.problem);

    const counts = new Map<string, number>();
    this.nodes.forEach(d => counts.set(d.cls, (counts.get(d.cls) ?? 0) + 1));
    this.legend = ['running', 'done', 'failed', 'timeout', 'suspended', 'pending', 'unknown']
      .filter(c => counts.has(c)).map(c => ({ cls: c, text: STATUS_TEXT[c], count: counts.get(c)! }));
  }

  /** Works out what is lit up: the followed run, the selected step and its neighbours, or one state. */
  private refresh(): void {
    this.nextNodes = new Set();
    this.flowEdges = new Set();
    this.focusNodes = null;
    this.focusEdges = null;
    const outgoing = (id: string) => this.edges.filter(e => e.source === id);
    if (this.replay !== null) {
      const upTo = new Set(this.order.slice(0, this.replay + 1));
      const cur = this.order[this.replay];
      this.focusNodes = new Set(upTo);
      this.focusEdges = new Set();
      this.edges.forEach(e => {
        if (e.taken && upTo.has(e.source) && upTo.has(e.target)) {
          this.flowEdges.add(e.id);
          this.focusEdges!.add(e.id);
        }
      });
      outgoing(cur).forEach(e => {
        this.nextNodes.add(e.target);
        this.focusNodes!.add(e.target);
        this.focusEdges!.add(e.id);
      });
    } else if (this.selectedId && this.byId.has(this.selectedId)) {
      const id = this.selectedId;
      this.focusNodes = new Set([id]);
      this.focusEdges = new Set();
      this.edges.forEach(e => {
        if (e.source === id || e.target === id) {
          this.focusNodes!.add(e.source);
          this.focusNodes!.add(e.target);
          this.focusEdges!.add(e.id);
          if (e.source === id) {
            this.nextNodes.add(e.target);
          }
        }
      });
    } else if (this.focusState) {
      this.focusNodes = new Set(this.nodes.filter(d => d.cls === this.focusState).map(d => d.n.activityId));
      this.focusEdges = new Set();
    }
  }

  isFlow(e: DrawEdge): boolean {
    return this.flowEdges.has(e.id);
  }
  isNextEdge(e: DrawEdge): boolean {
    const from = this.replay !== null ? this.order[this.replay] : this.selectedId;
    return !!from && e.source === from && this.nextNodes.has(e.target);
  }
  dimEdge(e: DrawEdge): boolean {
    return this.focusEdges !== null && !this.focusEdges.has(e.id);
  }
  dimNode(d: DrawNode): boolean {
    return this.focusNodes !== null && !this.focusNodes.has(d.n.activityId);
  }
  isNext(d: DrawNode): boolean {
    return this.nextNodes.has(d.n.activityId) && (this.replay !== null || d.n.activityId !== this.selectedId);
  }
  isCurrent(d: DrawNode): boolean {
    return this.replay !== null && this.order[this.replay] === d.n.activityId;
  }
  orderOf(d: DrawNode): number | null {
    return this.replay !== null ? this.orderIndex.get(d.n.activityId) ?? null : null;
  }

  // ---- selection, search, issues, following the run ----
  pick(d: DrawNode): void {
    if (this.suppress) {
      return;
    }
    if (this.replay !== null) {
      const i = this.order.indexOf(d.n.activityId);
      if (i >= 0) {
        this.goReplay(i);
        return;
      }
    }
    this.selected.emit(d.n.activityId);
  }

  find(id: string | null): void {
    if (!id) {
      return;
    }
    this.centerOn(id);
    this.focused.emit(id);
  }

  toggleState(cls: string): void {
    this.focusState = this.focusState === cls ? null : cls;
    this.refresh();
  }

  nextProblem(dir: number): void {
    if (!this.problems.length) {
      return;
    }
    const at = this.selectedId ? this.problems.indexOf(this.selectedId) : -1;
    const next = at < 0 ? (dir > 0 ? 0 : this.problems.length - 1) : (at + dir + this.problems.length) % this.problems.length;
    this.find(this.problems[next]);
  }

  startReplay(): void {
    if (this.order.length) {
      this.goReplay(0);
    }
  }
  goReplay(i: number): void {
    this.replay = Math.max(0, Math.min(this.order.length - 1, i));
    this.refresh();
    const id = this.order[this.replay];
    this.centerOn(id);
    this.focused.emit(id);
  }
  stopReplay(): void {
    this.replay = null;
    this.refresh();
    this.focused.emit('');
  }

  private centerOn(id: string): void {
    const d = this.byId.get(id);
    if (d) {
      this.vb = { ...this.vb, x: d.cx - this.vb.w / 2, y: d.cy - this.vb.h / 2 };
    }
  }

  // ---- zoom and pan ----
  fit(): void {
    this.vb = { ...this.fitBox };
  }

  zoom(factor: number, atX?: number, atY?: number): void {
    const cx = atX ?? this.vb.x + this.vb.w / 2;
    const cy = atY ?? this.vb.y + this.vb.h / 2;
    const w = this.vb.w / factor;
    if (w < 80 || w > this.fitBox.w * 6) {
      return;
    }
    const h = this.vb.h / factor;
    this.vb = { x: cx - (cx - this.vb.x) / factor, y: cy - (cy - this.vb.y) / factor, w, h };
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    const p = this.toUnits(e.clientX, e.clientY);
    this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }

  onDown(e: PointerEvent): void {
    const target = e.target as Element;
    const bendEl = target.closest('[data-bend]');
    const nodeEl = target.closest('.dv-node');
    if (bendEl || nodeEl) {
      if (bendEl) {
        const id = bendEl.getAttribute('data-bend')!;
        this.moving = { kind: 'bend', id, px: e.clientX, py: e.clientY, base: this.layout.b[id] ?? 0, moved: false, horiz: bendEl.getAttribute('data-horiz') === 'true' };
      } else {
        const id = nodeEl!.getAttribute('data-id')!;
        this.moving = { kind: 'node', id, px: e.clientX, py: e.clientY, base: this.layout.n[id] ?? [0, 0], moved: false };
      }
      this.svg.nativeElement.setPointerCapture(e.pointerId);
      return;
    }
    this.drag = { px: e.clientX, py: e.clientY, vx: this.vb.x, vy: this.vb.y, moved: false };
    this.svg.nativeElement.setPointerCapture(e.pointerId);
  }

  onMove(e: PointerEvent): void {
    const scale = this.scale();
    if (this.moving) {
      const m = this.moving;
      const dx = (e.clientX - m.px) * scale;
      const dy = (e.clientY - m.py) * scale;
      if (!m.moved && Math.abs(e.clientX - m.px) + Math.abs(e.clientY - m.py) < 4) {
        return;
      }
      m.moved = true;
      if (m.kind === 'node') {
        const base = m.base as [number, number];
        this.layout = { ...this.layout, n: { ...this.layout.n, [m.id]: [snap(base[0] + dx), snap(base[1] + dy)] } };
      } else {
        const delta = m.horiz ? dx : dy;
        this.layout = { ...this.layout, b: { ...this.layout.b, [m.id]: snap((m.base as number) + delta, 5) } };
      }
      this.relayout();
      this.refresh();
      return;
    }
    if (!this.drag) {
      return;
    }
    const dx = e.clientX - this.drag.px;
    const dy = e.clientY - this.drag.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      this.drag.moved = true;
    }
    this.vb = { ...this.vb, x: this.drag.vx - dx * scale, y: this.drag.vy - dy * scale };
  }

  onUp(e: PointerEvent): void {
    const release = () => {
      try {
        this.svg.nativeElement.releasePointerCapture(e.pointerId);
      } catch {
        // capture already released
      }
    };
    if (this.moving) {
      release();
      if (this.moving.moved) {
        this.suppress = true;
        setTimeout(() => (this.suppress = false), 0);
        saveLayout(this.layoutKey, this.layout);
        this.fitBox = this.currentFit();
      }
      this.moving = undefined;
      return;
    }
    if (this.drag) {
      release();
      const moved = this.drag.moved;
      this.drag = undefined;
      if (!moved && (e.target as Element) === this.svg.nativeElement && this.replay === null && this.selectedId) {
        // a click on the empty background clears the selection
        this.focused.emit('');
      }
    }
  }

  resetLayout(): void {
    this.layout = emptyLayout();
    saveLayout(this.layoutKey, this.layout);
    this.relayout();
    this.refresh();
    this.fitBox = this.currentFit();
  }

  miniClick(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    // the minimap keeps the aspect ratio, so work out where the drawing sits inside it
    const scale = Math.min(box.width / this.fitBox.w, box.height / this.fitBox.h);
    const offX = (box.width - this.fitBox.w * scale) / 2;
    const offY = (box.height - this.fitBox.h * scale) / 2;
    const x = (e.clientX - box.left - offX) / scale + this.fitBox.x;
    const y = (e.clientY - box.top - offY) / scale + this.fitBox.y;
    this.vb = { ...this.vb, x: x - this.vb.w / 2, y: y - this.vb.h / 2 };
  }

  /** Drawing units per screen pixel. The SVG keeps its aspect ratio, so the larger of the two ratios applies. */
  private scale(): number {
    const r = this.svg.nativeElement.getBoundingClientRect();
    return Math.max(this.vb.w / Math.max(r.width, 1), this.vb.h / Math.max(r.height, 1));
  }

  private toUnits(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.svg.nativeElement.getBoundingClientRect();
    const s = this.scale();
    const offX = (r.width - this.vb.w / s) / 2;
    const offY = (r.height - this.vb.h / s) / 2;
    return { x: (clientX - r.left - offX) * s + this.vb.x, y: (clientY - r.top - offY) * s + this.vb.y };
  }
}

/** The point half way along a polyline, where the grip for bending the arrow sits. */
function midPoint(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  let walk = total / 2;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (seg >= walk && seg > 0) {
      const f = walk / seg;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * f, y: points[i - 1].y + (points[i].y - points[i - 1].y) * f };
    }
    walk -= seg;
  }
  return points[points.length - 1];
}
