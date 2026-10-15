/** Shapes returned by the backend. Optional fields are omitted by the server when null. */

export type ConsoleFunction = 'VIEW_INSTANCES' | 'VIEW_DIAGRAM' | 'VIEW_ISSUES' | 'VIEW_REQUESTS' | 'RETRY_REQUEST';

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
  | 'FAILED_ACTIVITY' | 'STUCK_ACTIVITY' | 'OVERDUE_WORK_ITEM'
  | 'SUSPENDED_INSTANCE' | 'ORPHAN_INSTANCE' | 'STUCK_REQUEST';

export interface Issue {
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
