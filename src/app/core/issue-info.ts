import { IssueType } from './models';

export interface IssueInfo {
  title: string;
  hint: string;
}

/** Plain-language names for the detectors, shared by the dashboard and the issue list. */
export const ISSUE_INFO: Record<IssueType, IssueInfo> = {
  FAILED_ACTIVITY: { title: 'Failed steps', hint: 'Steps that failed or timed out in instances still open' },
  STUCK_ACTIVITY: { title: 'Stuck automatic steps', hint: 'Automatic steps that have been running for too long' },
  OVERDUE_WORK_ITEM: { title: 'Overdue tasks', hint: 'People tasks past their due date' },
  SUSPENDED_INSTANCE: { title: 'Suspended instances', hint: 'Instances that were suspended and not resumed' },
  ORPHAN_INSTANCE: { title: 'Instances going nowhere', hint: 'Started, but no step is running or waiting' },
  STUCK_REQUEST: { title: 'Engine requests in trouble', hint: 'Requests that timed out, expired or stayed fetched' }
};

export const ISSUE_ORDER: IssueType[] = [
  'FAILED_ACTIVITY', 'ORPHAN_INSTANCE', 'STUCK_ACTIVITY', 'OVERDUE_WORK_ITEM', 'SUSPENDED_INSTANCE', 'STUCK_REQUEST'
];

export function isIssueType(value: string | null | undefined): value is IssueType {
  return !!value && Object.prototype.hasOwnProperty.call(ISSUE_INFO, value);
}
