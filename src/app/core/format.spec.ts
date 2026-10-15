import { formatAge, formatDateTime, formatDuration, humanStatus, humanType } from './format';

describe('formatDuration', () => {
  it('uses seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(0)).toBe('0s');
  });
  it('pads seconds under ten', () => {
    expect(formatDuration(125)).toBe('2m 05s');
  });
  it('shows hours and minutes', () => {
    expect(formatDuration(3 * 3600 + 12 * 60 + 40)).toBe('3h 12m');
  });
  it('shows days and hours', () => {
    expect(formatDuration(2 * 86400 + 4 * 3600 + 900)).toBe('2d 4h');
  });
  it('gives a dash for unknown values', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
  });
});

describe('formatDateTime and formatAge', () => {
  it('handles missing and invalid input', () => {
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
    expect(formatAge(undefined)).toBe('—');
  });
  it('formats a local date', () => {
    const d = new Date(2026, 9, 5, 7, 4);
    expect(formatDateTime(d.toISOString())).toBe('2026-10-05 07:04');
  });
  it('measures age against a given clock', () => {
    const t = new Date(2026, 9, 5, 7, 0, 0).getTime();
    expect(formatAge(new Date(t - 90 * 60 * 1000).toISOString(), t)).toBe('1h 30m ago');
  });
  it('never reports a negative age', () => {
    const t = Date.now();
    expect(formatAge(new Date(t + 5000).toISOString(), t)).toBe('0s ago');
  });
});

describe('labels', () => {
  it('softens upper-case statuses only', () => {
    expect(humanStatus('EXPIRED')).toBe('Expired');
    expect(humanStatus('Request Timeout')).toBe('Request Timeout');
    expect(humanStatus(null)).toBe('—');
  });
  it('turns issue types into words', () => {
    expect(humanType('FAILED_ACTIVITY')).toBe('Failed activity');
  });
});
