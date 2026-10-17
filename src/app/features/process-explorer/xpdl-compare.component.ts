import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { DefinitionVersion } from '../../core/models';
import { BUSINESS_THEMES, DiffResult, businessAsText, compareVersions, diffAsText, parseXpdl } from './xpdl';

/** What changed between two stored versions of a process, in business terms or in technical detail. */
@Component({
  selector: 'app-xpdl-compare',
  standalone: true,
  imports: [FormsModule, ButtonModule, MessageModule, SelectButtonModule, SelectModule, TagModule],
  template: `
    <div class="grid grid-cols-12 gap-4 items-end mb-4">
      <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
        <label for="cmpA">Older version</label>
        <p-select inputId="cmpA" [(ngModel)]="a" [options]="versions" optionValue="versionNo" optionLabel="versionNo" fluid />
      </div>
      <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
        <label for="cmpB">Newer version</label>
        <p-select inputId="cmpB" [(ngModel)]="b" [options]="versions" optionValue="versionNo" optionLabel="versionNo" fluid />
      </div>
      <div class="col-span-12 md:col-span-4 flex gap-2">
        <p-button type="button" label="Compare" icon="pi pi-arrow-right-arrow-left" [disabled]="!a || !b || a === b || busy()" (onClick)="run()" />
        @if (result()) {
          <p-button type="button" label="Copy as text" icon="pi pi-copy" severity="secondary" [outlined]="true" (onClick)="copy()" />
        }
      </div>
    </div>

    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-3" /> }
    @if (busy()) { <div class="text-muted-color"><i class="pi pi-spin pi-spinner mr-2"></i>Comparing…</div> }

    @if (result(); as r) {
      <div class="text-muted-color mb-3">@for (n of r.notes; track n) { <div>{{ n }}</div> }</div>
      <p-selectbutton [(ngModel)]="view" [options]="views" optionLabel="label" optionValue="value" [allowEmpty]="false" class="mb-3" />

      @if (view === 'business') {
        @for (t of themes(r); track t) {
          <div class="section">{{ t }}</div>
          @for (i of byTheme(r, t); track $index) {
            <div class="item">
              <p-tag [value]="i.imp === 'high' ? 'High' : i.imp === 'med' ? 'Medium' : 'Low'"
                     [severity]="i.imp === 'high' ? 'danger' : i.imp === 'med' ? 'warn' : 'secondary'" />
              <span class="ml-2">{{ i.text }}</span>
              @for (d of i.d; track $index) { <div class="detail">{{ d }}</div> }
            </div>
          }
        } @empty { <p class="text-muted-color">No differences found.</p> }
      } @else {
        <table class="counts">
          <thead><tr><th>Count</th><th>Older</th><th>Newer</th></tr></thead>
          <tbody>@for (row of r.rows; track row[0]) { <tr [class.changed]="row[1] !== row[2]"><td>{{ row[0] }}</td><td>{{ row[1] }}</td><td>{{ row[2] }}</td></tr> }</tbody>
        </table>
        @for (s of r.S; track s.key) {
          @if (s.items.length) {
            <div class="section">{{ s.title }} ({{ s.items.length }})</div>
            @for (i of s.items; track $index) {
              <div class="item">
                <p-tag [value]="i.t === 'add' ? 'Added' : i.t === 'del' ? 'Removed' : 'Changed'"
                       [severity]="i.t === 'add' ? 'success' : i.t === 'del' ? 'danger' : 'info'" />
                <span class="ml-2">{{ i.x }}</span>
                @for (d of i.d; track $index) { <div class="detail">{{ d }}</div> }
              </div>
            }
          }
        }
      }
    }
  `,
  styles: [`
    .section { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; margin: 16px 0 6px; color: var(--p-text-muted-color, #667085); }
    .item { border: 1px solid var(--p-content-border-color, #d5d9e0); border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; }
    .detail { margin: 4px 0 0 4px; padding-left: 8px; border-left: 2px solid var(--p-content-border-color, #d5d9e0); color: var(--p-text-muted-color, #667085); word-break: break-word; }
    .counts { border-collapse: collapse; margin-bottom: 8px; }
    .counts th, .counts td { padding: 3px 14px 3px 0; text-align: left; border-bottom: 1px solid var(--p-content-border-color, #e5e7eb); }
    .counts tr.changed td { font-weight: 600; }
  `]
})
export class XpdlCompareComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input({ required: true }) source = '';
  @Input({ required: true }) processId = 0;
  @Input({ required: true }) versions: DefinitionVersion[] = [];
  /** The version being looked at, offered as the newer side. */
  @Input() current: string | null = null;

  a: string | null = null;
  b: string | null = null;
  view: 'business' | 'technical' = 'business';
  readonly views = [{ label: 'Business view', value: 'business' }, { label: 'Technical view', value: 'technical' }];

  readonly result = signal<DiffResult | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['processId'] || changes['source'] || changes['versions'] || changes['current']) {
      this.result.set(null);
      this.error.set(null);
      const list = this.versions.map(v => v.versionNo);
      this.b = this.current && list.includes(this.current) ? this.current : list[0] ?? null;
      const i = this.b ? list.indexOf(this.b) : -1;
      // versions arrive newest first, so the next entry is the previous version
      this.a = i >= 0 && i + 1 < list.length ? list[i + 1] : null;
    }
  }

  run(): void {
    if (!this.a || !this.b) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    forkJoin([
      this.api.definitionXpdl(this.source, this.processId, this.a),
      this.api.definitionXpdl(this.source, this.processId, this.b)
    ]).subscribe({
      next: ([ta, tb]) => {
        this.busy.set(false);
        try {
          this.result.set(compareVersions(parseXpdl(ta, this.a!), parseXpdl(tb, this.b!)));
        } catch (e) {
          this.error.set(e instanceof Error ? e.message : 'The versions could not be compared.');
        }
      },
      error: e => {
        this.busy.set(false);
        this.error.set(describeError(e));
      }
    });
  }

  themes(r: DiffResult): string[] {
    const present = new Set(r.biz.map(x => x.theme));
    return BUSINESS_THEMES.filter(t => present.has(t));
  }

  byTheme(r: DiffResult, theme: string): DiffResult['biz'] {
    return r.biz.filter(x => x.theme === theme);
  }

  copy(): void {
    const r = this.result();
    if (r) {
      navigator.clipboard?.writeText(this.view === 'business' ? businessAsText(r) : diffAsText(r));
    }
  }
}
