import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@/app/core/auth.service';
import { AppMenuitem } from './app.menuitem';

/** The sidebar menu. An entry appears only when the backend granted the person the matching function. */
@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            <li app-menuitem [item]="item" [root]="true"></li>
        }
    </ul> `
})
export class AppMenu {
    private readonly auth = inject(AuthService);

    readonly model = computed<MenuItem[]>(() => {
        const home: MenuItem[] = [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'] }];
        const work: MenuItem[] = [];
        if (this.auth.can('VIEW_INSTANCES')) {
            work.push({ label: 'Instances', icon: 'pi pi-fw pi-sitemap', routerLink: ['/instances'] });
        }
        if (this.auth.can('VIEW_ISSUES')) {
            work.push({ label: 'Issues', icon: 'pi pi-fw pi-exclamation-triangle', routerLink: ['/issues'] });
            work.push({ label: 'Process health', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/processes'] });
        }
        if (this.auth.can('VIEW_REQUESTS')) {
            work.push({ label: 'Request queue', icon: 'pi pi-fw pi-list', routerLink: ['/requests'] });
        }
        const menu: MenuItem[] = [{ label: 'Home', items: home }];
        if (work.length > 0) {
            menu.push({ label: 'Operations', items: work });
        }
        return menu;
    });
}
