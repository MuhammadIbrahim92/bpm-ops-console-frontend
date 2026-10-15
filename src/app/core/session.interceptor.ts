import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * WebLogic owns the session. When it expires, an API call is answered with a redirect to the login page, which the
 * browser follows: the app sees HTML instead of JSON (or a 401). Reloading the page sends the person to sign in again.
 */
export function looksLikeLogin(err: HttpErrorResponse): boolean {
  if (err.status === 401) {
    return true;
  }
  if (err.status === 200) {
    const text = (err.error as { text?: unknown } | null)?.text;
    return typeof text === 'string' && /<html|<!doctype/i.test(text);
  }
  return false;
}

const KEY = 'bpm-console-reloaded-at';

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? '0');
    if (Date.now() - last < 10000) {
      return; // just reloaded: do not loop
    }
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage unavailable: reload anyway, once per error
  }
  location.reload();
}

export const sessionInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (looksLikeLogin(err)) {
        reloadOnce();
      }
      return throwError(() => err);
    })
  );
