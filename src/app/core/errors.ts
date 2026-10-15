import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './models';

/** A sentence a person can act on, from whatever the HTTP layer threw. */
export function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiError> | null;
    if (body && typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
    if (err.status === 0) {
      return 'The server could not be reached. Check your connection and try again.';
    }
    if (err.status === 403) {
      return 'You are not allowed to do that.';
    }
    if (err.status === 404) {
      return 'That was not found.';
    }
    return `The server answered with an error (${err.status}).`;
  }
  return 'Something went wrong.';
}
