import { HttpErrorResponse } from '@angular/common/http';
import { looksLikeLogin } from './session.interceptor';

describe('looksLikeLogin', () => {
  it('treats 401 as a lost session', () => {
    expect(looksLikeLogin(new HttpErrorResponse({ status: 401 }))).toBeTrue();
  });
  it('treats HTML returned with 200 as the login page', () => {
    const e = new HttpErrorResponse({ status: 200, error: { text: '<!DOCTYPE html><html><body>Sign in</body></html>' } });
    expect(looksLikeLogin(e)).toBeTrue();
  });
  it('leaves ordinary errors alone', () => {
    expect(looksLikeLogin(new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN' } }))).toBeFalse();
    expect(looksLikeLogin(new HttpErrorResponse({ status: 500 }))).toBeFalse();
    expect(looksLikeLogin(new HttpErrorResponse({ status: 200, error: { text: '{"a":1}' } }))).toBeFalse();
  });
});
