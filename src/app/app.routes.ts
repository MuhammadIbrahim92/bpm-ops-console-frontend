import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InstanceListComponent } from './features/instances/instance-list.component';
import { InstanceDetailComponent } from './features/instances/instance-detail.component';
import { IssueListComponent } from './features/issues/issue-list.component';
import { ProcessHealthComponent } from './features/processes/process-health.component';
import { RequestListComponent } from './features/requests/request-list.component';
import { BulkRetryPageComponent } from './features/bulk/bulk-retry-page.component';
import { AppLayout } from './layout/component/app.layout';
import { requireFunction } from './core/auth.guard';

const pages: Routes = [
  { path: '', component: DashboardComponent, title: 'Dashboard' },
  { path: 'instances', component: InstanceListComponent, title: 'Instances', canActivate: [requireFunction('VIEW_INSTANCES')] },
  { path: 'instances/:id', component: InstanceDetailComponent, title: 'Instance', canActivate: [requireFunction('VIEW_INSTANCES')] },
  { path: 'issues', component: IssueListComponent, title: 'Issues', canActivate: [requireFunction('VIEW_ISSUES')] },
  { path: 'processes', component: ProcessHealthComponent, title: 'Process health', canActivate: [requireFunction('VIEW_ISSUES')] },
  { path: 'bulk-retry', component: BulkRetryPageComponent, title: 'Bulk retry', canActivate: [requireFunction('RETRY_REQUEST')] },
  { path: 'work-orders', loadComponent: () => import('./features/work-orders/work-order-tasks.component').then(m => m.WorkOrderTasksComponent), title: 'Work order tasks', canActivate: [requireFunction('VIEW_WORK_ORDERS')] },
  { path: 'logs', loadComponent: () => import('./features/logs/engine-logs.component').then(m => m.EngineLogsComponent), title: 'Engine logs', canActivate: [requireFunction('VIEW_LOGS')] },
  { path: 'assistant', loadComponent: () => import('./features/assistant/assistant.component').then(m => m.AssistantComponent), title: 'Assistant', canActivate: [requireFunction('USE_AGENT')] },
  { path: 'definitions', loadComponent: () => import('./features/process-explorer/process-explorer.component').then(m => m.ProcessExplorerComponent), title: 'Process explorer', canActivate: [requireFunction('VIEW_DEFINITIONS')] },
  { path: 'requests', component: RequestListComponent, title: 'Request queue', canActivate: [requireFunction('VIEW_REQUESTS')] },
];

export const routes: Routes = [
  { path: '', component: AppLayout, children: pages },
  { path: '**', redirectTo: '' }
];
