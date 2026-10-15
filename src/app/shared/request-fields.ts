import { RequestRow, TimerRequestRow } from '../core/models';

export type Field = [label: string, value: unknown];

/** Every column of REC_REQUESTS. */
export function recFields(r: RequestRow): Field[] {
  return [
    ['REQUEST_ID', r.id], ['REQUEST_TYPE', r.type], ['REQUEST_DATE', r.requestDate],
    ['REQUEST_STATUS', r.status], ['REQUEST_LENGTH', r.requestLength], ['EXECUTION_TIME', r.executionTime],
    ['USER_TYPE', r.userType], ['REQUEST_PIRIORTY', r.priority], ['ACTIVITY_LEVEL', r.activityLevel],
    ['ENGINE_ID', r.engineId], ['FETCH_DATE', r.fetchDate], ['FINISH_DATE', r.finishDate],
    ['NOTES', r.notes], ['REJECTION_REASON', r.rejectionReason], ['REQUEST_COMMAND', r.command]
  ];
}

/** Every column of TIMER_REQUESTS. */
export function timerFields(r: TimerRequestRow): Field[] {
  return [
    ['REQUEST_ID', r.id], ['REQUEST_TYPE', r.type], ['REQUEST_STATUS', r.status],
    ['REQUEST_DATE', r.requestDate], ['END_DATE', r.endDate], ['PROCESS_ID', r.processId],
    ['PROCESS_VERSION', r.processVersion], ['INSTANCE_ID', r.instanceId], ['ACTIVITY_ID', r.activityId],
    ['ACTIVITY_INST_ID', r.activityInstanceId], ['REPEATED', r.repeated], ['PERIOD', r.period],
    ['UNIT', r.unit], ['SCRIPT_TYPE', r.scriptType], ['EXCEPTION_NAME', r.exceptionName],
    ['REC_ID', r.recId], ['IS_REMINDER', r.reminder], ['IS_DURATION', r.duration],
    ['TERMINATE_TASK', r.terminateTask], ['REQUEST_PRIORITY', r.priority], ['ENGINE_ID', r.engineId],
    ['NOTES', r.notes], ['REQUEST_COMMAND', r.command]
  ];
}

/** A table value as text: empty as a dash, yes/no flags, ISO dates in the local format. */
export function showValue(v: unknown): string {
  if (v === null || v === undefined || v === '') {
    return '-';
  }
  if (typeof v === 'boolean') {
    return v ? 'Yes' : 'No';
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString();
  }
  return String(v);
}
