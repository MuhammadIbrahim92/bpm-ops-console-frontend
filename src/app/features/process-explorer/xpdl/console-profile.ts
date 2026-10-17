import { Check } from './types';

/**
 * Findings that describe how the vendor's designer writes XPDL, not a fault in the process. The original explorer
 * checks against the XPDL standard, so every definition from the console's designer gets these; they are shown as
 * notes instead of warnings so real problems stand out.
 */
const VENDOR_FORMAT = new Set([
  'XPDL namespace',
  'Package structure',
  'TransitionRef entries',
  'Performers that do not exist',
  'Undefined declared types',
  'Non-standard AccessLevel values',
  'Non-standard Parameter Mode values',
  'Non-standard data types',
  'Misspelled element names'
]);

export interface ProfiledChecks {
  problems: Check[];
  notes: Check[];
  passed: Check[];
}

export function applyConsoleProfile(checks: Check[]): ProfiledChecks {
  const problems: Check[] = [];
  const notes: Check[] = [];
  const passed: Check[] = [];
  for (const c of checks) {
    if (c.s === 'ok') {
      passed.push(c);
    } else if (VENDOR_FORMAT.has(c.l)) {
      notes.push({ ...c, s: 'info' });
    } else if (c.s === 'info') {
      notes.push(c);
    } else {
      problems.push(c);
    }
  }
  problems.sort((a, b) => (a.s === b.s ? 0 : a.s === 'fail' ? -1 : 1));
  return { problems, notes, passed };
}
