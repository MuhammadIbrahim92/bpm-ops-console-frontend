import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toParams } from './http-params';
import {
  ActivityStat, LogFile, LogFindResult, WorkOrderAttributes, WorkOrderTask, LogHit, LogPage, AgentAnswer, AgentStatus, AttributePage, AttributeValue, ParentRef, SubProcessLink, TabularTable, DefinitionProcess, DefinitionSource, DefinitionVersion, BulkImport, BulkResult, BulkTarget, StartForm, StepRow, TimerRequestRow, WorkItemHtml, InstanceDiagram, InstanceSummary, Issue, IssueType, Lookups, Me, Page, RequestRow
} from './models';

export interface InstanceQuery {
  status?: string;
  processId?: number | null;
  text?: string;
  workOrderId?: string;
  from?: string;
  to?: string;
  olderThanHours?: number | null;
  includeTest?: boolean;
  createdBy?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface WorkOrderQuery {
  workOrderId?: string;
  instanceId?: number | null;
  woStatus?: string;
  taskStatus?: string;
  workSpec?: string;
  requestType?: string;
  owner?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface RequestQuery {
  status?: string;
  type?: string;
  text?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

/** Relative URLs on purpose: the UI and the API are served from the same WAR, whatever its context root. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'api';

  constructor(private readonly http: HttpClient) {}

  login(username: string, password: string): Observable<{ token: string; expiresInSeconds: number }> {
    return this.http.post<{ token: string; expiresInSeconds: number }>(`${this.base}/auth/login`, { username, password });
  }

  me(): Observable<Me> {
    return this.http.get<Me>(`${this.base}/me`);
  }

  lookups(): Observable<Lookups> {
    return this.http.get<Lookups>(`${this.base}/lookups`);
  }

  instances(q: InstanceQuery): Observable<Page<InstanceSummary>> {
    return this.http.get<Page<InstanceSummary>>(`${this.base}/instances`, {
      params: toParams({ ...q })
    });
  }

  instance(id: number): Observable<InstanceSummary> {
    return this.http.get<InstanceSummary>(`${this.base}/instances/${id}`);
  }

  activities(id: number, page = 0, size = 50, activityId?: string, sort?: string, dir?: 'asc' | 'desc'): Observable<Page<StepRow>> {
    return this.http.get<Page<StepRow>>(`${this.base}/instances/${id}/activities`,
      { params: toParams({ page, size, activityId: activityId ?? '', sort: sort ?? '', dir: sort ? dir ?? 'asc' : '' }) });
  }

  processAttributes(id: number, page = 0, size = 50): Observable<AttributePage> {
    return this.http.get<AttributePage>(`${this.base}/instances/${id}/attributes`, { params: toParams({ page, size }) });
  }

  /** The instance's tabular data objects, each with its first page of rows. */
  /** Current values of the named process attributes (the ones that exist). */
  attributeValues(id: number, names: string[]): Observable<AttributeValue[]> {
    return this.http.get<AttributeValue[]>(`${this.base}/instances/${id}/attribute-values`,
      { params: new HttpParams({ fromObject: { names } }) });
  }

  workOrderTasks(q: WorkOrderQuery): Observable<Page<WorkOrderTask>> {
    return this.http.get<Page<WorkOrderTask>>(`${this.base}/work-orders/tasks`, { params: toParams({ ...q }) });
  }

  workOrderAttributes(workOrderId: string): Observable<WorkOrderAttributes> {
    return this.http.get<WorkOrderAttributes>(`${this.base}/work-orders/${encodeURIComponent(workOrderId)}/attributes`);
  }

  workOrderOptions(): Observable<{ workOrderStatuses: string[]; taskStatuses: string[] }> {
    return this.http.get<{ workOrderStatuses: string[]; taskStatuses: string[] }>(`${this.base}/work-orders/options`);
  }

  logFiles(): Observable<{ configured: boolean; files: LogFile[] }> {
    return this.http.get<{ configured: boolean; files: LogFile[] }>(`${this.base}/logs/files`);
  }

  logPage(file: string, offset: number, lines: number, direction: 'forward' | 'backward'): Observable<LogPage> {
    return this.http.get<LogPage>(`${this.base}/logs/page`, { params: toParams({ file, offset, lines, direction }) });
  }

  logFind(files: string[], text: string, startFile: number, from: number, limit: number): Observable<LogFindResult> {
    return this.http.get<LogFindResult>(`${this.base}/logs/find`, { params: files.reduce((p, f) => p.append('file', f), toParams({ text, startFile, from, limit })) });
  }

  logSearch(file: string, text: string, from: number, direction: 'forward' | 'backward', skipCurrent: boolean): Observable<LogHit> {
    return this.http.get<LogHit>(`${this.base}/logs/search`, { params: toParams({ file, text, from, direction, skipCurrent }) });
  }

  agentStatus(): Observable<AgentStatus> {
    return this.http.get<AgentStatus>(`${this.base}/agent/status`);
  }

  agentAsk(body: {
    question: string; language: string; history?: { role: string; content: string }[];
    context?: { instanceId: number; activityId?: string };
  }): Observable<AgentAnswer> {
    return this.http.post<AgentAnswer>(`${this.base}/agent/ask`, body);
  }

  agentFeedback(body: { question: string; answer: string; rating: string; note?: string; language?: string; tools?: string[] }): Observable<void> {
    return this.http.post<void>(`${this.base}/agent/feedback`, body);
  }

  agentDigest(): Observable<{ date?: string; text?: string }> {
    return this.http.get<{ date?: string; text?: string }>(`${this.base}/agent/digest`);
  }

  agentMakeDigest(language: string): Observable<{ date?: string; text?: string }> {
    return this.http.post<{ date?: string; text?: string }>(`${this.base}/agent/digest`, { language });
  }

  subProcesses(id: number): Observable<SubProcessLink[]> {
    return this.http.get<SubProcessLink[]>(`${this.base}/instances/${id}/sub-processes`);
  }

  /** The instance that started this one; a 404 means it is not a sub-process instance. */
  parentOf(id: number): Observable<ParentRef> {
    return this.http.get<ParentRef>(`${this.base}/instances/${id}/parent`);
  }

  processTables(id: number, size = 25): Observable<TabularTable[]> {
    return this.http.get<TabularTable[]>(`${this.base}/instances/${id}/tables`, { params: toParams({ size }) });
  }

  processTable(id: number, doId: number, page: number, size: number): Observable<TabularTable> {
    return this.http.get<TabularTable>(`${this.base}/instances/${id}/tables/${doId}`, { params: toParams({ page, size }) });
  }

  stepTables(id: number, activityInstanceId: number, size = 25): Observable<TabularTable[]> {
    return this.http.get<TabularTable[]>(`${this.base}/instances/${id}/activities/${activityInstanceId}/tables`,
      { params: toParams({ size }) });
  }

  stepTable(id: number, activityInstanceId: number, doId: number, page: number, size: number): Observable<TabularTable> {
    return this.http.get<TabularTable>(`${this.base}/instances/${id}/activities/${activityInstanceId}/tables/${doId}`,
      { params: toParams({ page, size }) });
  }

  stepAttributes(id: number, activityInstanceId: number, page = 0, size = 50): Observable<AttributePage> {
    return this.http.get<AttributePage>(`${this.base}/instances/${id}/activities/${activityInstanceId}/attributes`,
      { params: toParams({ page, size }) });
  }

  stepForms(id: number, activityInstanceId: number): Observable<WorkItemHtml[]> {
    return this.http.get<WorkItemHtml[]>(`${this.base}/instances/${id}/activities/${activityInstanceId}/forms`);
  }

  startForm(id: number): Observable<StartForm> {
    return this.http.get<StartForm>(`${this.base}/instances/${id}/start-form`);
  }

  diagram(id: number): Observable<InstanceDiagram> {
    return this.http.get<InstanceDiagram>(`${this.base}/instances/${id}/diagram`);
  }

  instanceRequests(id: number): Observable<RequestRow[]> {
    return this.http.get<RequestRow[]>(`${this.base}/instances/${id}/requests`);
  }

  instanceTimerRequests(id: number): Observable<TimerRequestRow[]> {
    return this.http.get<TimerRequestRow[]>(`${this.base}/instances/${id}/timer-requests`);
  }

  issueSummary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/issues/summary`);
  }

  issues(type: IssueType, limit?: number): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/issues`, { params: toParams({ type, limit }) });
  }

  bottlenecks(processId: number, days: number, version?: string, includeTest = false): Observable<ActivityStat[]> {
    return this.http.get<ActivityStat[]>(`${this.base}/processes/${processId}/bottlenecks`, {
      params: toParams({ days, version, includeTest: includeTest ? 'true' : '' })
    });
  }

  requests(q: RequestQuery): Observable<Page<RequestRow>> {
    return this.http.get<Page<RequestRow>>(`${this.base}/requests`, { params: toParams({ ...q }) });
  }

  /** What a bulk retry would do. Changes nothing. */
  bulkPreview(targets: BulkTarget[]): Observable<BulkResult> {
    return this.http.post<BulkResult>(`${this.base}/requests/bulk-retry/preview`, { targets });
  }

  /** Re-queues the latest request of the instance of each named failed activity. */
  bulkRetry(targets: BulkTarget[]): Observable<BulkResult> {
    return this.http.post<BulkResult>(`${this.base}/requests/bulk-retry`, { targets });
  }

  /** Reads ids from an .xlsx or .csv sheet. Changes nothing. */
  bulkImport(file: File): Observable<BulkImport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<BulkImport>(`${this.base}/requests/bulk-retry/import`, form);
  }

  definitionSources(): Observable<DefinitionSource[]> {
    return this.http.get<DefinitionSource[]>(`${this.base}/definitions/sources`);
  }

  definitionProcesses(source: string): Observable<DefinitionProcess[]> {
    return this.http.get<DefinitionProcess[]>(`${this.base}/definitions/processes`, { params: toParams({ source }) });
  }

  definitionVersions(source: string, processId: number): Observable<DefinitionVersion[]> {
    return this.http.get<DefinitionVersion[]>(`${this.base}/definitions/versions`,
      { params: toParams({ source, processId }) });
  }

  /** The definition (XPDL with the diagram) as text; secrets are already masked by the server. */
  definitionXpdl(source: string, processId: number, version: string): Observable<string> {
    return this.http.get(`${this.base}/definitions/xpdl`, {
      params: toParams({ source, processId, version }),
      responseType: 'text'
    });
  }

  retry(id: number): Observable<RequestRow> {
    return this.http.post<RequestRow>(`${this.base}/requests/${id}/retry`, {});
  }
}
