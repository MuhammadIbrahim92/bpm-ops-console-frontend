import { Component, Input, computed, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { Integration, ProcessData } from './xpdl';

/** Every web service and stored procedure the process calls: what goes in, what comes back, and where it is used. */
@Component({
  selector: 'app-xpdl-integrations',
  standalone: true,
  imports: [TagModule],
  template: `
    @for (i of integrations(); track i.id) {
      <div class="box">
        <div class="flex flex-wrap items-center gap-2">
          <p-tag [value]="i.kind === 'ws' ? 'Web service' : i.kind === 'db' ? 'Stored procedure' : 'Other'" />
          <b>{{ i.name }}</b>
          <span class="text-muted-color">used in {{ i.usedBy.length }} step{{ i.usedBy.length === 1 ? '' : 's' }}</span>
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
        @if (i.usedBy.length) {
          <div class="mt-2 text-muted-color">Used by: {{ steps(i) }}</div>
        }
      </div>
    } @empty {
      <p class="text-muted-color">This process does not call any web service or stored procedure.</p>
    }
  `,
  styles: [`
    .box { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
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

  readonly integrations = computed(() => this.data()?.M.integ ?? []);

  techEntries(i: Integration): [string, string][] {
    return Object.entries(i.tech).filter(([, v]) => !!v);
  }

  steps(i: Integration): string {
    const names = new Map((this.data()?.D.acts ?? []).map(a => [a.id, a.name] as const));
    return i.usedBy.map(u => names.get(u.act) ?? u.act).join(', ');
  }
}
