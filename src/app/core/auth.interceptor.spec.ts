import { HttpErrorResponse } from '@angular/common/http';
import { isSessionLost } from './auth.interceptor';

describe('isSessionLost', () => {
  it('treats a 401 on an API call as a rejected token', () => {
    expect(isSessionLost('api/instances', new HttpErrorResponse({ status: 401 }))).toBeTrue();
  });
  it('does not treat a failed sign-in as a lost session', () => {
    expect(isSessionLost('api/auth/login', new HttpErrorResponse({ status: 401 }))).toBeFalse();
  });
  it('leaves other errors alone', () => {
    expect(isSessionLost('api/me', new HttpErrorResponse({ status: 403 }))).toBeFalse();
    expect(isSessionLost('api/me', new HttpErrorResponse({ status: 500 }))).toBeFalse();
  });
});
