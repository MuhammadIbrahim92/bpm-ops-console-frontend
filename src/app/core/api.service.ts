import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toParams } from './http-params';
import {
  ActivityRecord, ActivityStat, InstanceDiagram, InstanceSummary, Issue, IssueType, Lookups, Me, Page, RequestRow
} from './models';

export interface InstanceQuery {
  status?: string;
  processId?: number | null;
  text?: string;
  from?: string;
  to?: string;
  olderThanHours?: number | null;
  includeTest?: boolean;
  page?: number;
  size?: number;
}

export interface RequestQuery {
  status?: string;
  type?: string;
  text?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

/** Relative URLs on purpose: the UI and the API are served from the same WAR, whatever its context root. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'api';

  constructor(private readonly http: HttpClient) {}

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

  activities(id: number): Observable<ActivityRecord[]> {
    return this.http.get<ActivityRecord[]>(`${this.base}/instances/${id}/activities`);
  }

  diagram(id: number): Observable<InstanceDiagram> {
    return this.http.get<InstanceDiagram>(`${this.base}/instances/${id}/diagram`);
  }

  instanceRequests(id: number): Observable<RequestRow[]> {
    return this.http.get<RequestRow[]>(`${this.base}/instances/${id}/requests`);
  }

  issueSummary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.base}/issues/summary`);
  }

  issues(type: IssueType, limit?: number): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/issues`, { params: toParams({ type, limit }) });
  }

  bottlenecks(processId: number, days: number, version?: string): Observable<ActivityStat[]> {
    return this.http.get<ActivityStat[]>(`${this.base}/processes/${processId}/bottlenecks`, {
      params: toParams({ days, version })
    });
  }

  requests(q: RequestQuery): Observable<Page<RequestRow>> {
    return this.http.get<Page<RequestRow>>(`${this.base}/requests`, { params: toParams({ ...q }) });
  }

  retry(id: number): Observable<RequestRow> {
    return this.http.post<RequestRow>(`${this.base}/requests/${id}/retry`, {});
  }
}
