import { applyConsoleProfile } from './console-profile';
import { Check } from './types';

const check = (l: string, s: Check['s']): Check => ({ s, l, d: '', items: [], fix: '', cat: '' });

describe('console profile', () => {
  it('moves vendor-format findings to notes and keeps real problems', () => {
    const r = applyConsoleProfile([
      check('XPDL namespace', 'warn'),
      check('Performers that do not exist', 'fail'),
      check('Script problems', 'fail'),
      check('Dead ends', 'warn'),
      check('Unused data fields', 'info'),
      check('Unique activity IDs', 'ok')
    ]);
    expect(r.problems.map(c => c.l)).toEqual(['Script problems', 'Dead ends']);
    expect(r.notes.map(c => c.l)).toEqual(['XPDL namespace', 'Performers that do not exist', 'Unused data fields']);
    expect(r.notes.every(c => c.s === 'info')).toBeTrue();
    expect(r.passed.length).toBe(1);
  });
});
