import { Component, Input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DiagramNode } from '../core/models';

/**
 * What a step does, as the process definition says: the text of a script step, or the stored procedure a database step
 * calls with its parameters and the process variables they are tied to.
 */
@Component({
  selector: 'app-step-definition',
  standalone: true,
  imports: [ButtonModule],
  template: `
    @if (node.script) {
      <div class="flex items-center gap-2 mt-3 mb-1">
        <span class="font-semibold"><i class="pi pi-code mr-1"></i>Script</span>
        <span class="flex-1"></span>
        <p-button type="button" icon="pi pi-copy" label="Copy" size="small" severity="secondary" [text]="true" (onClick)="copy(node.script)" />
      </div>
      <pre class="script">{{ node.script }}</pre>
    }
    @if (node.dbCall; as call) {
      <div class="font-semibold mt-3 mb-1"><i class="pi pi-database mr-1"></i>Stored procedure</div>
      <dl class="facts col">
        <div><dt>Procedure</dt><dd class="mono">{{ call.procedure || call.application }}</dd></div>
        @if (call.connection) { <div><dt>Connection</dt><dd class="mono">{{ call.connection }}</dd></div> }
        @if (call.application && call.application !== call.procedure) { <div><dt>Application</dt><dd>{{ call.application }}</dd></div> }
      </dl>
      @if (call.parameters.length > 0) {
        <table class="params">
          <thead><tr><th>Parameter</th><th>Direction</th><th>Type</th><th>Process variable</th></tr></thead>
          <tbody>
            @for (p of call.parameters; track $index) {
              <tr>
                <td class="mono">{{ p.name }}</td>
                <td>{{ direction(p.mode) }}</td>
                <td class="text-muted-color">{{ p.type }}</td>
                <td>@if (p.variable) { {{ p.variable }} } @else { <span class="text-muted-color">–</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: [`
    .script { margin: 0; padding: 10px 12px; max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-word;
      font: 12.5px ui-monospace, Menlo, Consolas, monospace; background: var(--surface-2, rgba(128, 128, 128, .08));
      border: 1px solid var(--border); border-radius: 8px; }
    .params { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 6px; }
    .params th, .params td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); }
    .params th { color: var(--muted); font-weight: 600; }
  `]
})
export class StepDefinitionComponent {
  @Input({ required: true }) node!: DiagramNode;

  direction(mode: string): string {
    const m = (mode ?? '').toUpperCase();
    return m === 'IN' ? 'Sent' : m === 'OUT' ? 'Returned' : m === 'INOUT' ? 'Sent and returned' : mode;
  }

  copy(text: string | null | undefined): void {
    if (text) {
      navigator.clipboard?.writeText(text);
    }
  }
}
