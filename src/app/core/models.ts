/** Shapes returned by the backend. Optional fields are omitted by the server when null. */

export type ConsoleFunction = 'VIEW_INSTANCES' | 'VIEW_DIAGRAM' | 'VIEW_ISSUES' | 'VIEW_REQUESTS' | 'RETRY_REQUEST' | 'VIEW_DEFINITIONS';

export interface Me {
  login: string;
  displayName: string;
  roles: string[];
  operations: boolean;
  functions: ConsoleFunction[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface InstanceSummary {
  id: number;
  name?: string;
  processId: number;
  processName?: string;
  version?: string;
  status?: string;
  created?: string;
  createdBy?: string;
  finished?: string;
  test: boolean;
  runningActivities: number;
  failedActivities: number;
}

export interface ActivityRecord {
  activityInstanceId: number;
  activityId: string;
  status?: string;
  creation?: string;
  start?: string;
  finish?: string;
}

export type NodeKind =
  | 'START' | 'END' | 'USER_TASK' | 'SCRIPT_TASK' | 'DATABASE_TASK' | 'SERVICE_TASK'
  | 'SUB_PROCESS' | 'GATEWAY_EXCLUSIVE' | 'GATEWAY_FORK' | 'ERROR_EVENT' | 'OTHER';

export interface DiagramNode {
  id: string;
  activityId: string;
  name?: string;
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DiagramEdge {
  id: string;
  transitionId?: string;
  sourceActivityId: string;
  targetActivityId: string;
  points: Point[];
}

export interface DiagramGraph {
  packageName?: string;
  processName?: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type ActivityStatus = 'FAILED' | 'RUNNING' | 'SUSPENDED' | 'TIMEOUT' | 'PENDING' | 'COMPLETED' | 'UNKNOWN';

export interface ActivityState {
  activityId: string;
  status: ActivityStatus;
  executions: number;
  running: number;
  failed: number;
  firstStart?: string;
  lastFinish?: string;
  totalSeconds: number;
  currentSeconds: number;
  performers: string[];
  overdue: boolean;
}

export interface Overlay {
  activities: ActivityState[];
  takenEdges: string[];
  unknownActivities: string[];
}

export interface InstanceDiagram {
  instance: InstanceSummary;
  graph?: DiagramGraph;
  diagramError?: string;
  overlay: Overlay;
}

export type IssueType =
  | 'FAILED_ACTIVITY' | 'TIMED_OUT_ACTIVITY' | 'STUCK_ACTIVITY' | 'OVERDUE_WORK_ITEM'
  | 'SUSPENDED_INSTANCE' | 'ORPHAN_INSTANCE' | 'STUCK_REQUEST';

export interface Issue {
  activityInstanceId?: number;
  activityName?: string;
  activityStatus?: string;
  activityType?: string;
  type: IssueType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  instanceId?: number;
  instanceName?: string;
  processName?: string;
  activityId?: string;
  since?: string;
  detail?: string;
  requestId?: number;
}

export interface ActivityStat {
  activityId: string;
  executions: number;
  running: number;
  failed: number;
  avgSeconds?: number;
  maxSeconds?: number;
  longestRunningSeconds?: number;
}

export interface RequestRow {
  id: number;
  type?: string;
  requestDate?: string;
  status?: string;
  executionTime: number;
  command?: string;
  notes?: string;
  rejectionReason?: string;
  engineId?: string;
  fetchDate?: string;
  finishDate?: string;
  instanceId?: number;
  retryable: boolean;
  requestLength?: number;
  userType?: string;
  priority?: string;
  activityLevel?: number;
}

export interface TimerRequestRow {
  id: number;
  type?: string;
  status?: string;
  requestDate?: string;
  endDate?: string;
  processId?: number;
  processVersion?: string;
  activityId?: string;
  activityInstanceId?: string;
  instanceId?: string;
  command?: string;
  repeated: boolean;
  period?: number;
  unit?: string;
  scriptType?: string;
  exceptionName?: string;
  recId?: number;
  reminder: boolean;
  duration: boolean;
  terminateTask: boolean;
  priority?: string;
  notes?: string;
  engineId?: string;
}

export interface Lookups {
  processes: { id: number; name: string }[];
  instanceStatuses: string[];
  requestStatuses: string[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface AttributeValue {
  name: string;
  type?: string;
  value?: string;
  value1?: string;
  tabular: boolean;
}

/** Attributes of one data object (DO_ID). */
export interface AttributeSection {
  doId: number;
  doName: string;
  attributes: AttributeValue[];
}

export interface WorkItemHtml {
  workItemId: number;
  name?: string;
  status?: string;
  taskType?: string;
  assignedUser?: string;
  finishedBy?: string;
  endDate?: string;
  html: string;
}

/** One page of attribute rows, grouped by data object. total counts attribute rows. */
export interface AttributePage {
  sections: AttributeSection[];
  total: number;
  page: number;
  size: number;
}

export interface StartForm {
  html: string;
  createdBy?: string;
  created?: string;
}

/** One step in the paged step list. taskType is the work item task type (absent for automatic steps). */
export interface StepRow {
  activityInstanceId: number;
  activityId: string;
  status?: string;
  taskType?: string;
  /** The engine request that ran the step (EXC_ACTIVITY_INSTANCE.REQUEST_UUID); shown for service tasks. */
  requestUuid?: string;
  creation?: string;
  start?: string;
  finish?: string;
}

/** What bulk retry is asked to retry: a failed activity instance, or a whole process instance. */
export interface BulkTarget {
  activityInstanceId?: number | null;
  instanceId?: number | null;
}

export interface BulkRow {
  instanceId?: number;
  activityInstanceIds: number[];
  activities?: string;
  requestId?: number;
  requestType?: string;
  requestStatus?: string;
  requestDate?: string;
  command?: string;
  outcome: 'READY' | 'RETRIED' | 'SKIPPED' | 'FAILED';
  reason?: string;
}

export interface BulkResult {
  rows: BulkRow[];
  ready: number;
  retried: number;
  skipped: number;
  failed: number;
}

export interface BulkImport {
  targets: BulkTarget[];
  warnings: string[];
}

/** A process that has stored definitions, from the repository or the configuration schema. */
export interface DefinitionProcess {
  id: number;
  name: string;
  versions: number;
  latestVersion: string;
  activeVersion?: string;
}

export interface DefinitionVersion {
  versionNo: string;
  active: boolean;
  status?: string;
  publishDate?: string;
  description?: string;
  sizeBytes: number;
}

export interface DefinitionSource {
  key: string;
  label: string;
}
