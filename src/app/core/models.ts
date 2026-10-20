/** Shapes returned by the backend. Optional fields are omitted by the server when null. */

export type ConsoleFunction = 'VIEW_INSTANCES' | 'VIEW_DIAGRAM' | 'VIEW_ISSUES' | 'VIEW_REQUESTS' | 'RETRY_REQUEST' | 'VIEW_DEFINITIONS' | 'USE_AGENT' | 'VIEW_LOGS';

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

/** One parameter of a stored procedure call and the process variable it is tied to. */
export interface DbParameter {
  name: string;
  mode: string;
  type: string;
  variable: string;
}

/** The stored procedure a database step calls. */
export interface DbCall {
  application: string;
  procedure: string;
  connection: string;
  parameters: DbParameter[];
}

export interface DiagramNode {
  id: string;
  activityId: string;
  /** For a sub-process step: the process and version the drawing names. */
  subProcessId?: string | null;
  subProcessVersion?: string | null;
  /** For a script step: the script text. */
  script?: string | null;
  /** For a database step: the procedure it calls. */
  dbCall?: DbCall | null;
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
  /** The transition's name from the XPDL. */
  name?: string;
  /** The condition that lets the flow take this arrow; absent when it has none. */
  condition?: string | null;
  conditionType?: string | null;
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
  /** The activity instance id of every execution of the step, oldest first. */
  activityInstanceIds: number[];
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
  | 'FAILED_ACTIVITY' | 'TIMED_OUT_ACTIVITY' | 'COMPLETED_WITH_FAILED_STEPS' | 'STUCK_ACTIVITY' | 'OVERDUE_WORK_ITEM'
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
  /** The step's name from the process definition, when it could be read. */
  name?: string | null;
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
  /** The attribute's id (ATT_ID), when known. */
  id?: string | null;
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
/** One row of a tabular data object: the engine's row id and the value of each column in it. */
export interface TabularRow {
  rowId: number;
  values: Record<string, string | null>;
}

/** A data object of type Table as columns and rows. */
export interface TabularTable {
  doId: number;
  doName: string;
  columns: string[];
  rows: TabularRow[];
  /** All rows of the table; `rows` is one page of them. */
  totalRows: number;
  page: number;
  size: number;
}

/** One run of a sub-process step and the instance it started (found exactly), if any. */
export interface SubProcessLink {
  activityId: string;
  activityName: string;
  activityInstanceId: number;
  status: string;
  start?: string;
  configuredProcessId?: string | null;
  configuredVersion?: string | null;
  matchedBy?: string | null;
  child: InstanceSummary | null;
  hidden: boolean;
}

/** What a sub-process instance records about the instance that started it. */
export interface ParentRef {
  instanceId: number;
  activityId?: string | null;
  activityName?: string | null;
  available: boolean;
  parentName?: string | null;
}

/** Whether the assistant is switched on and what it can reach. */
export interface AgentStatus {
  ready: boolean;
  model?: string | null;
  languages: string[];
  logsConfigured: boolean;
}

export interface AgentToolUse {
  name: string;
  arguments: string;
}

export interface AgentAnswer {
  answer: string;
  language: string;
  model: string;
  tools: AgentToolUse[];
}

/** An engine log file the console may read. */
export interface LogFile {
  id: string;
  name: string;
  folder: number;
  sizeBytes: number;
  modified: string;
}

export interface LogLine {
  /** Byte position of the start of the line. */
  offset: number;
  text: string;
  /** Characters cut from the end of a very long line. */
  cut: number;
}

export interface LogPage {
  file: string;
  size: number;
  startOffset: number;
  endOffset: number;
  lines: LogLine[];
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface LogHit {
  found: boolean;
  offset?: number | null;
  scannedBytes: number;
  stoppedAt?: number | null;
  reachedEdge: boolean;
}

/** A line found by a search over several log files. */
export interface LogFileHit {
  file: string;
  name: string;
  offset: number;
  text: string;
  cut: number;
}

export interface LogFindResult {
  hits: LogFileHit[];
  scannedBytes: number;
  resumeFile?: number | null;
  resumeOffset?: number | null;
  done: boolean;
}

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
