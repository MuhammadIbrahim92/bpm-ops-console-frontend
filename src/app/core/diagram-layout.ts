/**
 * Moving things around on a diagram, shared by the process explorer and the instance diagram.
 *
 * Only the arrangement is changed, never the process: steps get an offset from where the definition put them, and an
 * arrow can have its middle segment pushed sideways. The arrangement is remembered in this browser, per process.
 */
export interface DiagramLayout {
  /** Step id to how far it was moved (x, y), in drawing units. */
  n: Record<string, [number, number]>;
  /** Arrow id to how far its middle segment was pushed, in drawing units. */
  b: Record<string, number>;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const emptyLayout = (): DiagramLayout => ({ n: {}, b: {} });

export const isEmptyLayout = (l: DiagramLayout): boolean => Object.keys(l.n).length === 0 && Object.keys(l.b).length === 0;

/** Moved steps snap to a small grid so they line up. */
export const snap = (v: number, grid = 10): number => Math.round(v / grid) * grid;

const PREFIX = 'bpm-console-layout:';

export function loadLayout(key: string): DiagramLayout {
  try {
    const text = localStorage.getItem(PREFIX + key);
    if (text) {
      const v = JSON.parse(text);
      if (v && typeof v === 'object' && v.n && v.b) {
        return { n: v.n, b: v.b };
      }
    }
  } catch {
    // storage blocked or not JSON: start from the definition's own layout
  }
  return emptyLayout();
}

export function saveLayout(key: string, layout: DiagramLayout): void {
  try {
    if (isEmptyLayout(layout)) {
      localStorage.removeItem(PREFIX + key);
    } else {
      localStorage.setItem(PREFIX + key, JSON.stringify(layout));
    }
  } catch {
    // storage blocked: the arrangement lasts until the page is closed
  }
}

export interface Route {
  d: string;
  /** Where the grip and the condition icon sit: the middle of the middle segment. */
  mx: number;
  my: number;
  /** True when the middle segment is vertical (so dragging moves it sideways). */
  horiz: boolean;
}

/** An arrow from one box to another in right angles, leaving and entering on the sides that face each other. */
export function orthogonal(a: Box, b: Box, bend = 0, margin = 2): Route {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sx = ax + Math.sign(dx || 1) * (a.w / 2 + margin);
    const tx = bx - Math.sign(dx || 1) * (b.w / 2 + margin);
    const mx = (sx + tx) / 2 + bend;
    return { d: `M${sx} ${ay}H${mx}V${by}H${tx}`, mx, my: (ay + by) / 2, horiz: true };
  }
  const sy = ay + Math.sign(dy) * (a.h / 2 + margin);
  const ty = by - Math.sign(dy) * (b.h / 2 + margin);
  const my = (sy + ty) / 2 + bend;
  return { d: `M${ax} ${sy}V${my}H${bx}V${ty}`, mx: (ax + bx) / 2, my, horiz: false };
}
