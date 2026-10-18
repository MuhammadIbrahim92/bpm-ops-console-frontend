import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';
import { PanelModule } from 'primeng/panel';
import { TagModule } from 'primeng/tag';
import { Integration, ProcessData } from './xpdl';

interface Category {
  kind: Integration['kind'];
  title: string;
  icon: string;
  used: Integration[];
  unused: Integration[];
}

/**
 * Every web service and stored procedure the process defines, one panel per category. Inside a panel the ones a step
 * uses come first (what is sent, what comes back, which steps use it), then the ones defined but used by no step.
 */
@Component({
  selector: 'app-xpdl-integrations',
  standalone: true,
  imports: [NgTemplateOutlet, PanelModule, TagModule],
  template: `
    @for (c of categories(); track c.kind) {
      <p-panel [toggleable]="true" styleClass="mb-4">
        <ng-template #header>
          <div class="flex flex-wrap items-center gap-2">
            <i [class]="'pi ' + c.icon"></i>
            <span class="font-semibold">{{ c.title }}</span>
            <p-tag [value]="c.used.length + ' used'" severity="success" />
            <p-tag [value]="c.unused.length + ' not used'" [severity]="c.unused.length ? 'warn' : 'secondary'" />
          </div>
        </ng-template>

        <button type="button" class="group" (click)="toggle(c.kind, 'used')" [attr.aria-expanded]="!isCollapsed(c.kind, 'used')">
          <i [class]="'pi ' + (isCollapsed(c.kind, 'used') ? 'pi-chevron-right' : 'pi-chevron-down')"></i>
          <i class="pi pi-check-circle"></i> Used ({{ c.used.length }})
        </button>
        @if (!isCollapsed(c.kind, 'used')) {
          @for (i of c.used; track i.id) {
            <ng-container *ngTemplateOutlet="card; context: { $implicit: i, used: true }" />
          } @empty {
            <p class="text-muted-color">No {{ c.title.toLowerCase() }} is used by a step.</p>
          }
        }

        <button type="button" class="group mt-4" (click)="toggle(c.kind, 'unused')" [attr.aria-expanded]="!isCollapsed(c.kind, 'unused')">
          <i [class]="'pi ' + (isCollapsed(c.kind, 'unused') ? 'pi-chevron-right' : 'pi-chevron-down')"></i>
          <i class="pi pi-minus-circle"></i> Not used ({{ c.unused.length }})
        </button>
        @if (!isCollapsed(c.kind, 'unused')) {
          @for (i of c.unused; track i.id) {
            <ng-container *ngTemplateOutlet="card; context: { $implicit: i, used: false }" />
          } @empty {
            <p class="text-muted-color">Every defined {{ c.title.toLowerCase() }} is used by a step.</p>
          }
        }
      </p-panel>
    } @empty {
      <p class="text-muted-color">This process does not define or call any web service or stored procedure.</p>
    }

    <ng-template #card let-i let-used="used">
      <div class="box" [class.unused]="!used">
        <div class="flex flex-wrap items-center gap-2">
          <b>{{ i.name }}</b>
          @if (used) {
            <span class="text-muted-color">used in {{ i.usedBy.length }} step{{ i.usedBy.length === 1 ? '' : 's' }}</span>
          } @else {
            <p-tag value="Not used by any step" severity="warn" />
          }
        </div>
        @if (techEntries(i).length) {
          <div class="mt-2">
            @for (t of techEntries(i); track t[0]) { <div class="kv"><b>{{ t[0] }}:</b> {{ t[1] }}</div> }
          </div>
        }
        @if (i.params.length) {
          <table class="mt-2">
            <thead><tr><th>Parameter</th><th>Direction</th><th>Type</th><th>Required</th></tr></thead>
            <tbody>
              @for (p of i.params; track $index) {
                <tr><td>{{ p.name }}</td><td>{{ p.mode === 'IN' ? 'Sent' : p.mode === 'OUT' ? 'Returned' : 'Sent and returned' }}</td><td>{{ p.type }}</td><td>{{ p.req ? 'Yes' : '' }}</td></tr>
              }
            </tbody>
          </table>
        }
        @if (used && i.usedBy.length) {
          <div class="mt-2 text-muted-color">Used by: {{ steps(i) }}</div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .group { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer;
      font: inherit; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 0 0 8px; padding: 4px 0;
      color: var(--p-text-muted-color, #667085); }
    .group:hover { color: var(--p-text-color, #1d2330); }
    .box { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
    .box.unused { border-style: dashed; opacity: .85; }
    .kv { word-break: break-word; }
    .kv b { color: var(--p-text-muted-color, #667085); font-weight: 600; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--p-content-border-color, #e5e7eb); }
    th { color: var(--p-text-muted-color, #667085); font-weight: 600; }
  `]
})
export class XpdlIntegrationsComponent {
  private readonly data = signal<ProcessData | null>(null);

  @Input({ required: true }) set model(value: ProcessData) {
    this.data.set(value);
  }

  /** Web services and databases always get a panel; other kinds of application only when the process has some. */
  readonly categories = computed<Category[]>(() => {
    const all = this.data()?.M.integ ?? [];
    const make = (kind: Integration['kind'], title: string, icon: string, always: boolean): Category | null => {
      const list = all.filter(i => i.kind === kind);
      if (!list.length && !always) {
        return null;
      }
      return {
        kind, title, icon,
        used: list.filter(i => i.usedBy.length > 0),
        unused: list.filter(i => i.usedBy.length === 0)
      };
    };
    return [
      make('ws', 'Web services', 'pi-globe', true),
      make('db', 'Databases (stored procedures)', 'pi-database', true),
      make('other', 'Other applications', 'pi-cog', false)
    ].filter((c): c is Category => c !== null);
  });

  /** Which "Used" and "Not used" lists are folded away, as "kind:used" or "kind:unused". Everything starts open. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  isCollapsed(kind: string, part: 'used' | 'unused'): boolean {
    return this.collapsed().has(kind + ':' + part);
  }

  toggle(kind: string, part: 'used' | 'unused'): void {
    const key = kind + ':' + part;
    const next = new Set(this.collapsed());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.collapsed.set(next);
  }

  techEntries(i: Integration): [string, string][] {
    return Object.entries(i.tech).filter(([, v]) => !!v);
  }

  steps(i: Integration): string {
    const names = new Map((this.data()?.D.acts ?? []).map(a => [a.id, a.name] as const));
    return i.usedBy.map(u => names.get(u.act) ?? u.act).join(', ');
  }
}
