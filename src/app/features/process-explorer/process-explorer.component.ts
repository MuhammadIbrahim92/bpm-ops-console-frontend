import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { DefinitionProcess, DefinitionSource, DefinitionVersion } from '../../core/models';
import { ProcessData, parseXpdl } from './xpdl';
import { XpdlCompareComponent } from './xpdl-compare.component';
import { XpdlDiagramComponent } from './xpdl-diagram.component';
import { XpdlImpactComponent } from './xpdl-impact.component';
import { XpdlIntegrationsComponent } from './xpdl-integrations.component';
import { XpdlSimulateComponent } from './xpdl-simulate.component';
import { XpdlReportComponent } from './xpdl-report.component';
import { XpdlScenariosComponent } from './xpdl-scenarios.component';

/**
 * Process explorer: pick a process and version stored in the database (or open an XPDL file) and see it drawn,
 * with plain-language details and a step-by-step trace. Read only; secrets are masked by the server.
 */
@Component({
  selector: 'app-process-explorer',
  standalone: true,
  imports: [FormsModule, ButtonModule, MessageModule, SelectModule, TagModule, TabsModule, XpdlDiagramComponent,
    XpdlCompareComponent, XpdlImpactComponent, XpdlIntegrationsComponent, XpdlReportComponent, XpdlScenariosComponent, XpdlSimulateComponent],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1">Process explorer</div>
      <p class="text-muted-color mb-4">Look at how a process is built: its steps, branches, conditions and integrations. Nothing here changes the definition.</p>

      <div class="grid grid-cols-12 gap-4 items-end">
        <div class="col-span-12 md:col-span-3 flex flex-col gap-2">
          <label for="src">Where from</label>
          <p-select inputId="src" [(ngModel)]="source" [options]="sources()" optionLabel="label" optionValue="key"
            (onChange)="onSource()" fluid />
        </div>
        <div class="col-span-12 md:col-span-5 flex flex-col gap-2">
          <label for="proc">Process</label>
          <p-select inputId="proc" [(ngModel)]="processId" [options]="processes()" optionValue="id" [filter]="true"
            filterBy="name,id" placeholder="Choose a process" [loading]="loadingList()" (onChange)="onProcess()" fluid>
            <ng-template #selectedItem let-p>{{ p.name }} <span class="text-muted-color">(#{{ p.id }})</span></ng-template>
            <ng-template #item let-p>{{ p.name }} <span class="text-muted-color">(#{{ p.id }}, {{ p.versions }} versions)</span></ng-template>
          </p-select>
        </div>
        <div class="col-span-12 md:col-span-4 flex flex-col gap-2">
          <label for="ver">Version</label>
          <p-select inputId="ver" [(ngModel)]="version" [options]="versions()" optionValue="versionNo"
            placeholder="Choose a version" [disabled]="!processId" (onChange)="onVersion()" fluid>
            <ng-template #selectedItem let-v>{{ v.versionNo }}</ng-template>
            <ng-template #item let-v>{{ v.versionNo }}@if (v.active) { <p-tag class="ml-2" value="Active" severity="success" /> }
              <span class="text-muted-color ml-2">{{ kb(v.sizeBytes) }}</span></ng-template>
          </p-select>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="p-button p-button-secondary p-button-outlined p-button-sm cursor-pointer">
          <i class="pi pi-upload mr-2"></i>Open an XPDL file
          <input type="file" accept=".xpdl,.xml,text/xml" class="hidden" (change)="onFile($event)" />
        </label>
        @if (data(); as d) {
          <span class="text-muted-color">{{ title() }}: {{ d.M.nAct }} steps, {{ d.M.nTr }} transitions</span>
        }
      </div>
    </div>

    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="mb-4" />
    }
    @if (loading()) {
      <div class="card text-muted-color"><i class="pi pi-spin pi-spinner mr-2"></i>Loading the definition…</div>
    }
    @if (data(); as d) {
      <div class="card">
        <p-tabs value="diagram" [lazy]="true">
          <p-tablist>
            <p-tab value="diagram">Diagram</p-tab>
            <p-tab value="report">Report</p-tab>
            <p-tab value="io">Inputs and outputs</p-tab>
            <p-tab value="scenarios">Scenarios and impact</p-tab>
            <p-tab value="sim">Simulate</p-tab>
            <p-tab value="param">Parameter impact</p-tab>
            @if (processId && versions().length > 1) { <p-tab value="compare">Compare versions</p-tab> }
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="diagram"><app-xpdl-diagram [data]="d" /></p-tabpanel>
            <p-tabpanel value="report"><app-xpdl-report [model]="d" /></p-tabpanel>
            <p-tabpanel value="io"><app-xpdl-integrations [model]="d" /></p-tabpanel>
            <p-tabpanel value="scenarios"><app-xpdl-scenarios [model]="d" /></p-tabpanel>
            <p-tabpanel value="sim"><app-xpdl-simulate [model]="d" /></p-tabpanel>
            <p-tabpanel value="param"><app-xpdl-impact [model]="d" /></p-tabpanel>
            @if (processId && versions().length > 1) {
              <p-tabpanel value="compare">
                <app-xpdl-compare [source]="source" [processId]="processId" [versions]="versions()" [current]="version" />
              </p-tabpanel>
            }
          </p-tabpanels>
        </p-tabs>
      </div>
    }
  `
})
export class ProcessExplorerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly sources = signal<DefinitionSource[]>([]);
  readonly processes = signal<DefinitionProcess[]>([]);
  readonly versions = signal<DefinitionVersion[]>([]);
  readonly data = signal<ProcessData | null>(null);
  readonly title = signal('');
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingList = signal(false);

  source = 'repository';
  processId: number | null = null;
  version: string | null = null;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.source = q.get('source') ?? this.source;
    this.processId = q.get('processId') ? Number(q.get('processId')) : null;
    this.version = q.get('version');
    this.api.definitionSources().subscribe({
      next: s => {
        this.sources.set(s);
        if (!s.some(x => x.key === this.source) && s.length) {
          this.source = s[0].key;
        }
        this.loadProcesses(true);
      },
      error: e => this.error.set(describeError(e))
    });
  }

  nameOf(id: number): string {
    return this.processes().find(p => p.id === id)?.name ?? '#' + id;
  }

  kb(bytes: number): string {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  onSource(): void {
    this.processId = null;
    this.version = null;
    this.versions.set([]);
    this.data.set(null);
    this.loadProcesses(false);
  }

  onProcess(): void {
    this.version = null;
    this.data.set(null);
    this.loadVersions(false);
  }

  onVersion(): void {
    this.open();
  }

  private loadProcesses(restore: boolean): void {
    this.loadingList.set(true);
    this.api.definitionProcesses(this.source).subscribe({
      next: p => {
        this.processes.set(p);
        this.loadingList.set(false);
        if (restore && this.processId) {
          this.loadVersions(true);
        }
      },
      error: e => {
        this.loadingList.set(false);
        this.error.set(describeError(e));
      }
    });
  }

  private loadVersions(restore: boolean): void {
    if (!this.processId) {
      return;
    }
    this.api.definitionVersions(this.source, this.processId).subscribe({
      next: v => {
        this.versions.set(v);
        if (!restore || !this.version) {
          // newest active version by default
          this.version = (v.find(x => x.active) ?? v[0])?.versionNo ?? null;
        }
        if (this.version) {
          this.open();
        }
      },
      error: e => this.error.set(describeError(e))
    });
  }

  private open(): void {
    if (!this.processId || !this.version) {
      return;
    }
    this.router.navigate([], {
      queryParams: { source: this.source, processId: this.processId, version: this.version },
      replaceUrl: true
    });
    this.error.set(null);
    this.loading.set(true);
    this.api.definitionXpdl(this.source, this.processId, this.version).subscribe({
      next: text => {
        this.loading.set(false);
        this.show(text, `${this.nameOf(this.processId!)} ${this.version}`);
      },
      error: e => {
        this.loading.set(false);
        this.data.set(null);
        this.error.set(describeError(e));
      }
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    file.text().then(text => this.show(text, file.name)).catch(() => this.error.set('The file could not be read.'));
    input.value = '';
  }

  private show(text: string, name: string): void {
    try {
      this.data.set(parseXpdl(text, name));
      this.title.set(name);
      this.error.set(null);
    } catch (e) {
      this.data.set(null);
      this.error.set(e instanceof Error ? e.message : 'The definition could not be read.');
    }
  }
}
