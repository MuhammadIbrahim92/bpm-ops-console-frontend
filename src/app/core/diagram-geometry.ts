import { DiagramEdge, DiagramGraph, DiagramNode, NodeKind, Point } from './models';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The drawing's bounds plus a margin, never smaller than a usable minimum. */
export function viewBoxOf(graph: DiagramGraph, margin = 30): ViewBox {
  const w = Math.max(graph.maxX - graph.minX, 200);
  const h = Math.max(graph.maxY - graph.minY, 120);
  return { x: graph.minX - margin, y: graph.minY - margin, w: w + 2 * margin, h: h + 2 * margin };
}

function center(n: DiagramNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

/**
 * Where the line from the centre of a node towards `toward` leaves the node's rectangle.
 * Diamonds and circles are clipped as rectangles too; the difference is a few pixels and keeps arrows tidy.
 */
export function clipToNode(n: DiagramNode, toward: Point): Point {
  const c = center(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) {
    return c;
  }
  const hw = n.width / 2;
  const hh = n.height / 2;
  const scale = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

/** The polyline of an arrow, from the edge of the source node to the edge of the target node. */
export function edgePoints(edge: DiagramEdge, byActivity: Map<string, DiagramNode>): Point[] {
  const s = byActivity.get(edge.sourceActivityId);
  const t = byActivity.get(edge.targetActivityId);
  if (!s || !t) {
    return [];
  }
  const via = edge.points ?? [];
  const first = via.length ? via[0] : center(t);
  const last = via.length ? via[via.length - 1] : center(s);
  return [clipToNode(s, first), ...via, clipToNode(t, last)];
}

export function toPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ');
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Splits a label into at most `maxLines` lines of about `maxChars`, adding an ellipsis when cut. */
export function wrapLabel(text: string | undefined, maxChars: number, maxLines: number): string[] {
  const words = (text ?? '').trim().split(/\s+/).filter(w => w.length > 0);
  if (!words.length || maxChars < 1 || maxLines < 1) {
    return [];
  }
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    const next = line ? line + ' ' + w : w;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) {
        break;
      }
    }
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    i = words.length;
  }
  const cut = i < words.length || lines.length > maxLines;
  const out = lines.slice(0, maxLines).map(l => (l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l));
  if (cut && out.length) {
    const last = out[out.length - 1];
    out[out.length - 1] = last.endsWith('…') ? last : (last.length >= maxChars ? last.slice(0, maxChars - 1) : last) + '…';
  }
  return out;
}

export type Shape = 'circle' | 'double-circle' | 'diamond' | 'task';

export function shapeOf(kind: NodeKind): Shape {
  switch (kind) {
    case 'START':
      return 'circle';
    case 'END':
    case 'ERROR_EVENT':
      return 'double-circle';
    case 'GATEWAY_EXCLUSIVE':
    case 'GATEWAY_FORK':
      return 'diamond';
    default:
      return 'task';
  }
}

/** Short text shown in the corner of a task so people can tell human tasks from automatic ones. */
export function kindTag(kind: NodeKind): string {
  switch (kind) {
    case 'USER_TASK':
      return 'USER';
    case 'SCRIPT_TASK':
      return 'SCRIPT';
    case 'DATABASE_TASK':
      return 'DB';
    case 'SERVICE_TASK':
      return 'SERVICE';
    case 'SUB_PROCESS':
      return 'SUB';
    case 'GATEWAY_EXCLUSIVE':
      return 'XOR';
    case 'GATEWAY_FORK':
      return 'AND';
    default:
      return '';
  }
}

/** Full name of a node's task type, for annotations next to steps. Empty for unknown shapes. */
export function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'START':
      return 'Start event';
    case 'END':
      return 'End event';
    case 'USER_TASK':
      return 'User task';
    case 'SCRIPT_TASK':
      return 'Script task';
    case 'DATABASE_TASK':
      return 'Database task';
    case 'SERVICE_TASK':
      return 'Service task';
    case 'SUB_PROCESS':
      return 'Sub-process';
    case 'GATEWAY_EXCLUSIVE':
      return 'Exclusive gateway';
    case 'GATEWAY_FORK':
      return 'Parallel gateway';
    case 'ERROR_EVENT':
      return 'Error event';
    default:
      return '';
  }
}

export function diamondPoints(n: DiagramNode): string {
  const cx = n.x + n.width / 2;
  const cy = n.y + n.height / 2;
  return `${cx},${n.y} ${n.x + n.width},${cy} ${cx},${n.y + n.height} ${n.x},${cy}`;
}
