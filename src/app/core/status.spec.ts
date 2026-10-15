import { activityLook, instanceLook, requestLook } from './status';

describe('status looks', () => {
  it('gives every activity status a label and glyph', () => {
    for (const s of ['FAILED', 'RUNNING', 'SUSPENDED', 'TIMEOUT', 'PENDING', 'COMPLETED', 'UNKNOWN'] as const) {
      const look = activityLook(s);
      expect(look.label.length).toBeGreaterThan(0);
      expect(look.glyph.length).toBeGreaterThan(0);
    }
  });
  it('marks activities that were never reached as idle', () => {
    expect(activityLook(undefined).cls).toBe('idle');
  });
  it('maps engine instance statuses', () => {
    expect(instanceLook('STARTED').cls).toBe('running');
    expect(instanceLook('started').cls).toBe('running');
    expect(instanceLook('TERMINATED').cls).toBe('terminated');
    expect(instanceLook('Not Started').cls).toBe('pending');
    expect(instanceLook('weird').cls).toBe('unknown');
  });
  it('maps request statuses', () => {
    expect(requestLook('Request Timeout').cls).toBe('timeout');
    expect(requestLook('EXPIRED').cls).toBe('failed');
    expect(requestLook('Completed').cls).toBe('done');
    expect(requestLook(null).cls).toBe('unknown');
  });
});
