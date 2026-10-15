import { clipToNode, diamondPoints, edgePoints, kindTag, shapeOf, toPath, viewBoxOf, wrapLabel } from './diagram-geometry';
import { DiagramEdge, DiagramGraph, DiagramNode } from './models';

const node = (activityId: string, x: number, y: number, w = 100, h = 40): DiagramNode =>
  ({ id: 'n-' + activityId, activityId, kind: 'USER_TASK', x, y, width: w, height: h });

describe('viewBoxOf', () => {
  it('adds a margin around the drawing', () => {
    const g: DiagramGraph = { minX: 100, minY: 50, maxX: 700, maxY: 450, nodes: [], edges: [] };
    expect(viewBoxOf(g, 30)).toEqual({ x: 70, y: 20, w: 660, h: 460 });
  });
  it('keeps a minimum size for tiny or empty drawings', () => {
    const g: DiagramGraph = { minX: 0, minY: 0, maxX: 0, maxY: 0, nodes: [], edges: [] };
    const vb = viewBoxOf(g, 0);
    expect(vb.w).toBe(200);
    expect(vb.h).toBe(120);
  });
});

describe('clipToNode', () => {
  const n = node('A', 0, 0, 100, 40);
  it('leaves through the right side', () => {
    const p = clipToNode(n, { x: 300, y: 20 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(20);
  });
  it('leaves through the bottom when the target is below', () => {
    const p = clipToNode(n, { x: 50, y: 200 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(40);
  });
  it('returns the centre when the target is the centre', () => {
    expect(clipToNode(n, { x: 50, y: 20 })).toEqual({ x: 50, y: 20 });
  });
});

describe('edgePoints', () => {
  const a = node('A', 0, 0);
  const b = node('B', 300, 0);
  const map = new Map<string, DiagramNode>([['A', a], ['B', b]]);
  it('runs from node edge to node edge for a straight arrow', () => {
    const e: DiagramEdge = { id: 'e', sourceActivityId: 'A', targetActivityId: 'B', points: [] };
    const pts = edgePoints(e, map);
    expect(pts.length).toBe(2);
    expect(pts[0].x).toBeCloseTo(100);
    expect(pts[1].x).toBeCloseTo(300);
  });
  it('keeps the waypoints in between', () => {
    const e: DiagramEdge = { id: 'e', sourceActivityId: 'A', targetActivityId: 'B', points: [{ x: 150, y: 120 }, { x: 250, y: 120 }] };
    const pts = edgePoints(e, map);
    expect(pts.length).toBe(4);
    expect(pts[1]).toEqual({ x: 150, y: 120 });
  });
  it('gives nothing when an end is not drawn', () => {
    const e: DiagramEdge = { id: 'e', sourceActivityId: 'A', targetActivityId: 'Z', points: [] };
    expect(edgePoints(e, map)).toEqual([]);
  });
  it('builds an SVG path', () => {
    expect(toPath([{ x: 0, y: 0 }, { x: 10.04, y: 5 }])).toBe('M0 0 L10 5');
  });
});

describe('wrapLabel', () => {
  it('wraps on word boundaries', () => {
    expect(wrapLabel('Check Customer Site', 14, 3)).toEqual(['Check Customer', 'Site']);
  });
  it('cuts with an ellipsis when it runs out of lines', () => {
    const lines = wrapLabel('one two three four five six seven eight', 8, 2);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBeTrue();
  });
  it('shortens a single very long word', () => {
    const lines = wrapLabel('Supercalifragilistic', 8, 1);
    expect(lines[0].length).toBeLessThanOrEqual(8);
    expect(lines[0].endsWith('…')).toBeTrue();
  });
  it('returns nothing for empty text', () => {
    expect(wrapLabel('   ', 10, 2)).toEqual([]);
    expect(wrapLabel(undefined, 10, 2)).toEqual([]);
  });
});

describe('shapes', () => {
  it('maps kinds to shapes and tags', () => {
    expect(shapeOf('START')).toBe('circle');
    expect(shapeOf('END')).toBe('double-circle');
    expect(shapeOf('GATEWAY_EXCLUSIVE')).toBe('diamond');
    expect(shapeOf('USER_TASK')).toBe('task');
    expect(kindTag('USER_TASK')).toBe('USER');
    expect(kindTag('START')).toBe('');
  });
  it('draws a diamond through the middle of each side', () => {
    expect(diamondPoints(node('G', 0, 0, 40, 40))).toBe('20,0 40,20 20,40 0,20');
  });
});
