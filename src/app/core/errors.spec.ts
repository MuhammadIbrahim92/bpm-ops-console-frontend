import { HttpErrorResponse } from '@angular/common/http';
import { describeError } from './errors';

describe('describeError', () => {
  it('prefers the server message', () => {
    const e = new HttpErrorResponse({ status: 409, error: { code: 'NOT_RETRYABLE', message: 'Already completed.' } });
    expect(describeError(e)).toBe('Already completed.');
  });
  it('explains a lost connection', () => {
    expect(describeError(new HttpErrorResponse({ status: 0 }))).toContain('could not be reached');
  });
  it('falls back for unknown errors', () => {
    expect(describeError(new Error('x'))).toBe('Something went wrong.');
  });
});
