/** What the explorer knows about a process definition after reading its XPDL. */

export type Kind = 'start' | 'end' | 'gw' | 'ws' | 'app' | 'user' | 'script' | 'timer' | 'task';

export const KIND_LABEL: Record<Kind, string> = {
  start: 'Start',
  end: 'End',
  gw: 'Gateway',
  ws: 'Web service',
  app: 'Stored procedure',
  user: 'User task',
  script: 'Script',
  timer: 'Timeout event',
  task: 'Task'
};

export interface Activity {
  id: string;
  name: string;
  k: Kind;
  /** Display details: web service operation, stored procedure, gateway type, performer, script text... */
  det: Record<string, string>;
  /** For a timeout event: the activity id it is attached to. */
  tgt: string | null;
  ins: string[];
  outs: string[];
  /** Fields a person edits at a user task. */
  io: string[];
  src: string;
  loc: string;
  rs: string;
  dl: string;
  params: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Transition {
  ct: string;
  id: string;
  f: string;
  t: string;
  name: string;
  cond: string;
  desc: string;
}

export type Severity = 'ok' | 'warn' | 'fail' | 'info';

export interface Check {
  s: Severity;
  l: string;
  d: string;
  items: string[];
  fix: string;
  cat: string;
}

export interface IntegrationParam {
  name: string;
  mode: 'IN' | 'OUT' | 'INOUT';
  type: string;
  req: boolean;
}

export interface Integration {
  id: string;
  name: string;
  kind: 'ws' | 'db' | 'other';
  tech: Record<string, string>;
  params: IntegrationParam[];
  usedBy: { act: string; map: { name: string; mode: string; to: string }[] }[];
}

export interface ProcessMeta {
  file: string;
  size: number;
  ns: string;
  pkg: string;
  proc: string;
  procs: string[];
  pi: number;
  checks: Check[];
  ver: string;
  layout: 'from file' | 'automatic';
  kinds: Partial<Record<Kind, number>>;
  nAct: number;
  nTr: number;
  starts: string[];
  ends: string[];
  ws: string[];
  apps: string[];
  users: string[];
  timers: string[];
  vars: [string, number][];
  participants: number;
  datafields: number;
  applications: number;
  lanes: number;
  integ: Integration[];
}

export interface ProcessExtras {
  header: Record<string, string>;
  dfs: { scope: string; name: string; type: string; init: string }[];
  apl: { name: string; sig: string }[];
  pts: { name: string; type: string }[];
  ext: { scope: string; name: string; h: string; v: string | null; long: boolean; sens: boolean }[];
}

export interface ProcessData {
  D: { acts: Activity[]; trs: Transition[] };
  M: ProcessMeta;
  X: ProcessExtras;
}
