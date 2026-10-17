import { engine, parseXpdl } from './index';

/**
 * The engine was lifted unchanged from the XPDL Workflow Explorer. testdata/golden.json holds what the ORIGINAL tool
 * made of the three fixtures (definitions exported through the console, secrets masked, internal addresses
 * replaced). These tests fail if the engine ever stops agreeing with it.
 */
const BASE = '/base/src/app/features/process-explorer/xpdl/testdata/';

async function text(name: string): Promise<string> {
  const r = await fetch(BASE + name);
  expect(r.ok).withContext(name).toBeTrue();
  return r.text();
}

describe('XPDL engine against the original explorer', () => {
  let golden: any;
  const names = ['p4177-v5.xml', 'p4177-v6.xml', 'p4233-v16.xml'];
  const parsed: any[] = [];

  beforeAll(async () => {
    golden = JSON.parse(await text('golden.json'));
    for (const n of names) {
      parsed.push(parseXpdl(await text(n), n));
    }
  });

  names.forEach((n, i) => {
    describe(n, () => {
      it('reads the same activities, transitions and layout', () => {
        const g = golden.files[i], p = parsed[i];
        expect(p.M.nAct).toBe(g.nAct);
        expect(p.M.nTr).toBe(g.nTr);
        expect(p.M.layout).toBe(g.layout);
        expect(p.M.kinds).toEqual(g.kinds);
        expect(p.D.acts.map((a: any) => [a.id, a.name, a.k, Math.round(a.x), Math.round(a.y)])).toEqual(g.acts);
        expect(p.D.trs.map((t: any) => [t.id, t.f, t.t, t.cond])).toEqual(g.trs);
      });

      it('reports the same checks', () => {
        expect(parsed[i].M.checks.map((c: any) => [c.s, c.l, c.d])).toEqual(golden.files[i].checks);
      });

      it('lists the same integrations and attributes, masking secrets', () => {
        const g = golden.files[i], p = parsed[i];
        expect(p.M.integ.map((a: any) => [a.name, a.kind, a.usedBy.length])).toEqual(g.integ);
        expect(p.X.ext.map((e: any) => [e.scope, e.name, e.sens])).toEqual(g.ext);
      });

      it('finds the same routes through the process', () => {
        const g = golden.files[i], I = engine.analyse(parsed[i].D);
        expect(I.paths.length).toBe(g.paths);
        expect(I.all).toBe(g.all);
        expect(I.happy ? I.happy.p : null).toEqual(g.happy);
        expect(I.sc.length).toBe(g.scenarios);
        expect([...new Set(I.paths.map((pe: any) => pe.out))].sort()).toEqual(g.outcomes);
      });

      it('describes every step in the same words', () => {
        expect(parsed[i].D.acts.map((a: any) => engine.bizStep(a, parsed[i].D))).toEqual(golden.files[i].steps);
      });
    });
  });

  it('compares two versions exactly like the original (technical and business)', () => {
    const r = engine.diffVersions(parsed[0], parsed[1]);
    expect(r.S.map((s: any) => [s.key, s.items.length])).toEqual(golden.diff.sections);
    expect(r.rows).toEqual(golden.diff.rows);
    expect(r.notes).toEqual(golden.diff.notes);
    expect(r.biz.map((x: any) => [x.imp, x.theme, x.text])).toEqual(golden.diff.biz);
    expect(engine.diffText(r)).toBe(golden.diff.text);
    expect(engine.bizText(r)).toBe(golden.diff.bizText);
  });

  it('refuses text that is not XML or not a process', () => {
    expect(() => parseXpdl('not xml at all <<', 'x.xml')).toThrowError(/not well-formed/);
    expect(() => parseXpdl('<Package/>', 'x.xml')).toThrowError(/No WorkflowProcess/);
  });
});
