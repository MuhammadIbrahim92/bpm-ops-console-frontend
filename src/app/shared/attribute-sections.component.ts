import { Component, Input } from '@angular/core';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AttributeSection } from '../core/models';

/** Attributes grouped by data object (DO_ID): one collapsible panel per data object. */
@Component({
  selector: 'app-attribute-sections',
  standalone: true,
  imports: [PanelModule, TableModule, TagModule],
  template: `
    @for (s of sections; track s.doId) {
      <p-panel [toggleable]="true" styleClass="mb-4">
        <ng-template #header>
          <div class="flex items-center gap-2">
            <span class="font-semibold">{{ s.doName }}</span>
            <p-tag [value]="'DO ' + s.doId" severity="secondary" />
            <span class="text-muted-color text-sm">{{ s.attributes.length }} attributes</span>
          </div>
        </ng-template>
        <p-table [value]="s.attributes" size="small" [rowHover]="true">
          <ng-template #header>
            <tr><th>Attribute</th><th>Type</th><th>Value</th></tr>
          </ng-template>
          <ng-template #body let-a>
            <tr>
              <td>{{ a.name }} @if (a.tabular) { <span class="text-muted-color">(table)</span> }</td>
              <td class="text-muted-color">{{ a.type }}</td>
              <td class="val">{{ a.value }}@if (a.value1) { <span class="text-muted-color"> / {{ a.value1 }}</span> }</td>
            </tr>
          </ng-template>
        </p-table>
      </p-panel>
    } @empty {
      <p class="text-muted-color">{{ emptyText }}</p>
    }
  `,
  styles: [`
    .val { white-space: pre-wrap; word-break: break-word; }
  `]
})
export class AttributeSectionsComponent {
  @Input() sections: AttributeSection[] = [];
  @Input() emptyText = 'No attributes.';
}
