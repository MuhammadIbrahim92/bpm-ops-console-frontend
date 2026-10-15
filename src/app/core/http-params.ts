import { HttpParams } from '@angular/common/http';

export type ParamValue = string | number | boolean | null | undefined;

/** Builds query parameters, leaving out anything empty so the URL stays readable. */
export function toParams(values: Record<string, ParamValue>): HttpParams {
  let params = new HttpParams();
  for (const key of Object.keys(values)) {
    const v = values[key];
    if (v !== null && v !== undefined && v !== '') {
      params = params.set(key, String(v));
    }
  }
  return params;
}
