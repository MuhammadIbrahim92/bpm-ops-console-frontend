import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { ActivityState, DiagramGraph, DiagramNode, Overlay } from '../core/models';
import {
  Shape, ViewBox, diamondPoints, edgePoints, kindTag, shapeOf, toPath, viewBoxOf, wrapLabel
} from '../core/diagram-geometry';
import { formatDuration } from '../core/format';
import { activityLook } from '../core/status';

interface DrawNode {
  n: DiagramNode;
  shape: Shape;
  diamond: string;
  cx: number;
  cy: number;
  lines: string[];
  textY: number;
  tag: string;
  cls: string;
  meta: string;
  overdue: boolean;
  aria: string;
}

interface DrawEdge {
  id: string;
  d: string;
  taken: boolean;
}

/**
 * The process drawing with the live state of one instance on top: every step is coloured by what happened to it,
 * running and failed steps show how long they have been there, and arrows already travelled are drawn heavier.
 * Pan by dragging, zoom with the wheel or the buttons.
 */
@Component({
  selector: 'app-diagram-view',
  standalone: true,
  imports: [ButtonModule, TagModule],
  template: `
    <div class="dv-toolbar">
      <p-button type="button" icon="pi pi-search-plus" size="small" severity="secondary" [outlined]="true" (onClick)="zoom(1.25)" ariaLabel="Zoom in" />
      <p-button type="button" icon="pi pi-search-minus" size="small" severity="secondary" [outlined]="true" (onClick)="zoom(0.8)" ariaLabel="Zoom out" />
      <p-button type="button" label="Fit" icon="pi pi-expand" size="small" severity="secondary" [outlined]="true" (onClick)="fit()" />
      <span class="dv-spacer"></span>
      <span class="dv-legend" aria-label="Legend">
        <p-tag severity="info" value="&#9654; Running" />
        <p-tag severity="success" value="&#10003; Completed" />
        <p-tag severity="danger" value="&#10005; Failed" />
        <p-tag severity="warn" value="&#9208; Suspended" />
        <p-tag severity="secondary" value="Not reached" />
      </span>
    </div>
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
      </defs>
      @for (e of edges; track e.id) {
        <path class="dv-edge" [class.taken]="e.taken" [attr.d]="e.d"
              [attr.marker-end]="e.taken ? 'url(#dv-arrow-taken)' : 'url(#dv-arrow)'"></path>
      }
      @for (d of nodes; track d.n.id) {
        <g [class]="'dv-node st-' + d.cls" [class.selected]="d.n.activityId === selectedId" tabindex="0" role="button"
           [attr.aria-label]="d.aria" (click)="pick(d)" (keydown.enter)="pick(d)" (keydown.space)="pick(d); $event.preventDefault()">
          <title>{{ d.aria }}</title>
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
              <rect class="dv-shape" [attr.x]="d.n.x" [attr.y]="d.n.y" [attr.width]="d.n.width" [attr.height]="d.n.height" rx="6"></rect>
            }
          }
          @for (line of d.lines; track $index) {
            <text class="dv-label" text-anchor="middle" [attr.x]="d.cx" [attr.y]="d.textY + $index * 12">{{ line }}</text>
          }
          @if (d.tag) {
            <text class="dv-tag" [attr.x]="d.n.x + 4" [attr.y]="d.n.y + 10">{{ d.tag }}</text>
          }
          @if (d.meta) {
            <text class="dv-meta" text-anchor="middle" [attr.x]="d.cx" [attr.y]="d.n.y + d.n.height + 13">{{ d.meta }}</text>
          }
          @if (d.overdue) {
            <circle class="dv-overdue" [attr.cx]="d.n.x + d.n.width - 2" [attr.cy]="d.n.y + 2" r="8"></circle>
            <text class="dv-overdue-mark" text-anchor="middle" [attr.x]="d.n.x + d.n.width - 2" [attr.y]="d.n.y + 6">!</text>
          }
        </g>
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .dv-toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .dv-legend { display: flex; gap: 6px; flex-wrap: wrap; }
    .dv-spacer { flex: 1 1 auto; }
    .dv-svg {
      width: 100%;
      height: 62vh;
      min-height: 360px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      touch-action: none;
      cursor: grab;
      user-select: none;
    }
    .dv-svg:active { cursor: grabbing; }
    .dv-edge { fill: none; stroke: var(--c-idle); stroke-width: 1.4; opacity: 0.75; }
    .dv-edge.taken { stroke: var(--text); stroke-width: 2.4; opacity: 1; }
    .dv-arrow { fill: var(--c-idle); }
    .dv-arrow.taken { fill: var(--text); }
    .dv-node { cursor: pointer; }
    .dv-shape { fill: var(--surface); stroke: var(--st, var(--c-idle)); stroke-width: 1.6; }
    .dv-shape.inner { fill: none; }
    .dv-node.st-running .dv-shape { fill: color-mix(in srgb, var(--st) 14%, var(--surface)); stroke-width: 2.6; }
    .dv-node.st-failed .dv-shape,
    .dv-node.st-timeout .dv-shape { fill: color-mix(in srgb, var(--st) 16%, var(--surface)); stroke-width: 2.8; }
    .dv-node.st-suspended .dv-shape { fill: color-mix(in srgb, var(--st) 14%, var(--surface)); stroke-width: 2.4; stroke-dasharray: 5 3; }
    .dv-node.st-done .dv-shape { fill: color-mix(in srgb, var(--st) 10%, var(--surface)); }
    .dv-node.st-idle { opacity: 0.6; }
    .dv-node.selected .dv-shape { stroke-width: 3.6; filter: drop-shadow(0 0 3px var(--st, var(--accent))); }
    .dv-node:focus-visible .dv-shape { stroke: var(--accent); stroke-width: 3.6; }
    .dv-label { fill: var(--text); font-size: 10.5px; pointer-events: none; }
    .dv-tag { fill: var(--muted); font-size: 8px; font-weight: 700; pointer-events: none; }
    .dv-meta { fill: var(--st, var(--muted)); font-size: 10px; font-weight: 700; pointer-events: none; }
    .dv-overdue { fill: var(--c-failed); }
    .dv-overdue-mark { fill: #fff; font-size: 11px; font-weight: 800; pointer-events: none; }
    @keyframes dv-pulse { 50% { opacity: 0.55; } }
    .dv-node.st-running .dv-shape { animation: dv-pulse 2.2s ease-in-out infinite; }
  `]
})
export class DiagramViewComponent implements OnChanges {
  @Input({ required: true }) graph!: DiagramGraph;
  @Input() overlay?: Overlay;
  @Input() selectedId?: string;
  @Output() selected = new EventEmitter<string>();
  @ViewChild('svg', { static: true }) svg!: ElementRef<SVGSVGElement>;

  nodes: DrawNode[] = [];
  edges: DrawEdge[] = [];
  vb: ViewBox = { x: 0, y: 0, w: 800, h: 400 };
  private fitBox: ViewBox = this.vb;
  private drag?: { px: number; py: number; vx: number; vy: number; moved: boolean };
  private suppressClick = false;

  get vbText(): string {
    return `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`;
  }

  ngOnChanges(): void {
    this.build();
  }

  private build(): void {
    const states = new Map<string, ActivityState>();
    for (const s of this.overlay?.activities ?? []) {
      states.set(s.activityId, s);
    }
    const taken = new Set(this.overlay?.takenEdges ?? []);
    const byActivity = new Map<string, DiagramNode>();
    for (const n of this.graph.nodes) {
      byActivity.set(n.activityId, n);
    }

    this.nodes = this.graph.nodes.map(n => {
      const s = states.get(n.activityId);
      const look = activityLook(s?.status);
      const shape = shapeOf(n.kind);
      const lines = shape === 'task' || shape === 'diamond'
        ? wrapLabel(n.name, Math.max(6, Math.floor((n.width - 10) / 5.6)), shape === 'diamond' ? 2 : 3)
        : [];
      const cx = n.x + n.width / 2;
      const cy = n.y + n.height / 2;
      const textY = cy - ((lines.length - 1) * 12) / 2 + 3;
      let meta = '';
      if (s && (s.status === 'RUNNING' || s.status === 'FAILED' || s.status === 'TIMEOUT' || s.status === 'SUSPENDED')) {
        meta = formatDuration(s.status === 'RUNNING' ? s.currentSeconds : s.totalSeconds);
      }
      if (s && s.executions > 1) {
        meta = (meta ? meta + ' ' : '') + '×' + s.executions;
      }
      const name = n.name?.trim() || n.activityId;
      const aria = s
        ? `${name}: ${look.label}${s.overdue ? ', overdue' : ''}${s.performers.length ? ', with ' + s.performers.join(', ') : ''}`
        : `${name}: not reached`;
      return {
        n, shape, diamond: shape === 'diamond' ? diamondPoints(n) : '', cx, cy, lines, textY,
        tag: kindTag(n.kind), cls: look.cls, meta, overdue: s?.overdue === true, aria
      };
    });

    this.edges = this.graph.edges
      .map(e => ({ id: e.id, d: toPath(edgePoints(e, byActivity)), taken: taken.has(e.id) }))
      .filter(e => e.d.length > 0);

    this.fitBox = viewBoxOf(this.graph);
    this.vb = { ...this.fitBox };
  }

  pick(d: DrawNode): void {
    if (this.suppressClick) {
      return;
    }
    this.selected.emit(d.n.activityId);
  }

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
    if ((e.target as Element).closest('.dv-node')) {
      return;
    }
    this.drag = { px: e.clientX, py: e.clientY, vx: this.vb.x, vy: this.vb.y, moved: false };
    this.svg.nativeElement.setPointerCapture(e.pointerId);
  }

  onMove(e: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const scale = this.scale();
    this.vb = {
      ...this.vb,
      x: this.drag.vx - (e.clientX - this.drag.px) * scale,
      y: this.drag.vy - (e.clientY - this.drag.py) * scale
    };
    this.drag.moved = true;
  }

  onUp(e: PointerEvent): void {
    if (this.drag) {
      try {
        this.svg.nativeElement.releasePointerCapture(e.pointerId);
      } catch {
        // capture already released
      }
      this.drag = undefined;
    }
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
