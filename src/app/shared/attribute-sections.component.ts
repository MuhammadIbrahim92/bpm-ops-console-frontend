import { Component, Input } from '@angular/core';
import { AttributeSection } from '../core/models';

/** Attributes grouped by data object (DO_ID): one titled section per data object. */
@Component({
  selector: 'app-attribute-sections',
  standalone: true,
  template: `
    @for (s of sections; track s.doId) {
      <section class="attr-section">
        <h3>{{ s.doName }} <span class="muted mono">DO {{ s.doId }}</span></h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Attribute</th><th>Type</th><th>Value</th></tr></thead>
            <tbody>
              @for (a of s.attributes; track $index) {
                <tr>
                  <td>{{ a.name }} @if (a.tabular) { <span class="muted">(table)</span> }</td>
                  <td class="muted">{{ a.type }}</td>
                  <td class="val">{{ a.value }}@if (a.value1) { <span class="muted"> / {{ a.value1 }}</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @empty {
      <p class="empty">{{ emptyText }}</p>
    }
  `,
  styles: [`
    .attr-section { margin-bottom: 16px; }
    h3 { margin: 0 0 6px; font-size: 14px; }
    .val { white-space: pre-wrap; word-break: break-word; }
  `]
})
export class AttributeSectionsComponent {
  @Input() sections: AttributeSection[] = [];
  @Input() emptyText = 'No attributes.';
}
