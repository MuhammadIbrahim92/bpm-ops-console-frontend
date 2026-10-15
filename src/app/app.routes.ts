import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InstanceListComponent } from './features/instances/instance-list.component';
import { InstanceDetailComponent } from './features/instances/instance-detail.component';
import { IssueListComponent } from './features/issues/issue-list.component';
import { ProcessHealthComponent } from './features/processes/process-health.component';
import { RequestListComponent } from './features/requests/request-list.component';
import { requireFunction } from './core/auth.guard';

export const routes: Routes = [
  { path: '', component: DashboardComponent, title: 'Dashboard' },
  { path: 'instances', component: InstanceListComponent, title: 'Instances', canActivate: [requireFunction('VIEW_INSTANCES')] },
  { path: 'instances/:id', component: InstanceDetailComponent, title: 'Instance', canActivate: [requireFunction('VIEW_INSTANCES')] },
  { path: 'issues', component: IssueListComponent, title: 'Issues', canActivate: [requireFunction('VIEW_ISSUES')] },
  { path: 'processes', component: ProcessHealthComponent, title: 'Process health', canActivate: [requireFunction('VIEW_ISSUES')] },
  { path: 'requests', component: RequestListComponent, title: 'Request queue', canActivate: [requireFunction('VIEW_REQUESTS')] },
  { path: '**', redirectTo: '' }
];
