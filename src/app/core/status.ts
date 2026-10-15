import { ActivityStatus } from './models';

export interface StatusLook {
  /** CSS class suffix, styled in styles.css as .st-<cls> */
  cls: string;
  label: string;
  /** A symbol so state never depends on colour alone. */
  glyph: string;
}

const LOOKS: Record<ActivityStatus, StatusLook> = {
  FAILED: { cls: 'failed', label: 'Failed', glyph: '✕' },
  RUNNING: { cls: 'running', label: 'Running', glyph: '▶' },
  SUSPENDED: { cls: 'suspended', label: 'Suspended', glyph: '⏸' },
  TIMEOUT: { cls: 'timeout', label: 'Timed out', glyph: '⧖' },
  PENDING: { cls: 'pending', label: 'Waiting', glyph: '…' },
  COMPLETED: { cls: 'done', label: 'Completed', glyph: '✓' },
  UNKNOWN: { cls: 'unknown', label: 'Unknown', glyph: '?' }
};

export function activityLook(status: ActivityStatus | undefined): StatusLook {
  return status ? LOOKS[status] ?? LOOKS.UNKNOWN : { cls: 'idle', label: 'Not reached', glyph: '' };
}

/** Process instance status text from the engine (STARTED, SUSPENDED, ...) to the same look family. */
export function instanceLook(status: string | null | undefined): StatusLook {
  switch ((status ?? '').trim().toUpperCase()) {
    case 'STARTED':
      return LOOKS.RUNNING;
    case 'COMPLETED':
      return LOOKS.COMPLETED;
    case 'SUSPENDED':
      return LOOKS.SUSPENDED;
    case 'TERMINATED':
      return { cls: 'terminated', label: 'Terminated', glyph: '■' };
    case 'NOT STARTED':
      return LOOKS.PENDING;
    default:
      return LOOKS.UNKNOWN;
  }
}

/** Request queue status to a look. */
export function requestLook(status: string | null | undefined): StatusLook {
  switch ((status ?? '').trim().toUpperCase()) {
    case 'QUEUED':
      return LOOKS.PENDING;
    case 'FETCHED':
    case 'RUNNING':
      return LOOKS.RUNNING;
    case 'COMPLETED':
    case 'FINISHED':
    case 'CLOSED':
      return LOOKS.COMPLETED;
    case 'REQUEST TIMEOUT':
      return LOOKS.TIMEOUT;
    case 'EXPIRED':
      return LOOKS.FAILED;
    default:
      return LOOKS.UNKNOWN;
  }
}
