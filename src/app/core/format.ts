/** Small formatting helpers shared by the screens. */

/** 45s, 12m 05s, 3h 12m, 2d 4h. A dash when the value is unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const s = Math.round(seconds);
  if (s < 60) {
    return `${s}s`;
  }
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r < 10 ? '0' : ''}${r}s`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return `${d}d ${h}h`;
}

/** 2026-10-15 14:32 in the viewer's time zone; a dash when missing or invalid. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    return '—';
  }
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** How long ago, in the same units as formatDuration. */
export function formatAge(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) {
    return '—';
  }
  const t = new Date(iso).getTime();
  if (isNaN(t)) {
    return '—';
  }
  return formatDuration(Math.max(0, (now - t) / 1000)) + ' ago';
}

/** Upper-case words to Sentence case: "Request Timeout" stays, "EXPIRED" becomes "Expired". */
export function humanStatus(status: string | null | undefined): string {
  if (!status) {
    return '—';
  }
  const t = status.trim();
  if (t === t.toUpperCase()) {
    return t.charAt(0) + t.slice(1).toLowerCase();
  }
  return t;
}

/** ISSUE_TYPE to a readable label. */
export function humanType(type: string): string {
  const t = type.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
