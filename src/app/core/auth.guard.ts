import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ConsoleFunction } from './models';

/** Sends people who lack a function back to the dashboard instead of showing a page that would only fail. */
export function requireFunction(fn: ConsoleFunction): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    return auth.can(fn) ? true : inject(Router).parseUrl('/');
  };
}
