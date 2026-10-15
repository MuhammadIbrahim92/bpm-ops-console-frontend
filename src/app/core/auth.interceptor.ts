import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const LOGIN_URL = 'api/auth/login';

/** A 401 from any call other than the sign-in itself means the token is no longer accepted. */
export function isSessionLost(url: string, err: HttpErrorResponse): boolean {
  return err.status === 401 && !url.endsWith(LOGIN_URL);
}

/** Adds the Bearer token to API calls and returns to the sign-in form when the backend rejects it. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const outgoing = token && !req.url.endsWith(LOGIN_URL)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(outgoing).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isSessionLost(req.url, err)) {
        auth.sessionExpired();
      }
      return throwError(() => err);
    })
  );
};
