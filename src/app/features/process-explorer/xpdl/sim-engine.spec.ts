import { createSimulator, parseXpdl } from './index';

/** The impact analysis must agree with the original explorer on real definitions (testdata/impact-golden.json). */
const BASE = '/base/src/app/features/process-explorer/xpdl/testdata/';

async function text(name: string): Promise<string> {
  const r = await fetch(BASE + name);
  expect(r.ok).withContext(name).toBeTrue();
  return r.text();
}

describe('Parameter impact against the original explorer', () => {
  let golden: any[];

  beforeAll(async () => {
    golden = JSON.parse(await text('impact-golden.json'));
  });

  ['p4177-v5.xml', 'p4177-v6.xml', 'p4233-v16.xml'].forEach((name, i) => {
    it('gives the same usage and scenarios for ' + name, async () => {
      const sim = createSimulator(parseXpdl(await text(name), name));
      for (const g of golden[i].vars) {
        expect(sim.parameters().length).withContext(g.v).toBe(g.all);
        expect(sim.valuesOf(g.v)).toEqual(g.lits);
        const u = sim.usage(g.v);
        expect([...u.T].sort()).toEqual(g.taint);
        expect(u.conds.map(c => [c.f, c.to, c.cond, c.direct, c.via.slice().sort()])).toEqual(g.conds);
        expect(u.readers.map(r => [r.name, r.direct, r.sets.slice().sort()])).toEqual(g.readers);
        expect(u.passed.map(p => [p.act, p.formal])).toEqual(g.passed);
        for (const r of g.run) {
          const e = sim.explore(g.v, r.val, 1, u, 5000);
          expect(e.partial).toBe(r.partial);
          expect(e.found.map(f => [f.sig, f.out, f.assume.join(' ; ')]).sort()).withContext(g.v + '=' + r.val).toEqual(r.found);
        }
      }
    });
  });
});
