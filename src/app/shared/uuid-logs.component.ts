import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/errors';
import { LogFileHit } from '../core/models';

/**
 * The web service call log lines that mention one request UUID (a service task's REQUEST_UUID). Nothing is read until the
 * person asks. Only the web service call files (calls_ws_apis.out and its rotated copies, set by
 * console.logs.web-service-file-pattern) changed since the step started are searched (an older file cannot mention it),
 * newest first, a limited amount at a time; "Keep searching" goes on.
 */
@Component({
  selector: 'app-uuid-logs',
  standalone: true,
  imports: [RouterLink, ButtonModule, MessageModule],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <p-button type="button" icon="pi pi-file" label="Find in web service logs" size="small" severity="secondary" [outlined]="true"
        (onClick)="start()" [disabled]="busy() || !uuid()" />
      @if (note()) { <span class="text-muted-color text-sm">{{ note() }}</span> }
      @if (resume() !== null) {
        <p-button type="button" label="Keep searching" size="small" severity="secondary" [text]="true" (onClick)="more()" [disabled]="busy()" />
      }
    </div>
    @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mt-2" /> }
    @if (hits().length > 0) {
      <div class="hits mt-2" role="list" aria-label="Log lines for this request">
        @for (h of hits(); track $index) {
          <a class="hit" role="listitem" [routerLink]="['/logs']" [queryParams]="{ file: h.file, offset: h.offset, text: uuid() }" target="_blank"
            [title]="'Open ' + h.name + ' at byte ' + h.offset + ' in the Engine logs page'">
            <span class="hfile">{{ h.name }}</span>
            <span class="htxt">{{ h.text }}</span>
          </a>
        }
      </div>
    }
  `,
  styles: [`
    .hits { border: 1px solid var(--border); border-radius: 8px; max-height: 24vh; overflow: auto; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; }
    .hit { display: flex; gap: 12px; padding: 2px 10px; color: inherit; text-decoration: none; white-space: pre; }
    .hit:hover { background: var(--surface-2, rgba(128,128,128,.1)); }
    .hfile { flex: 0 0 auto; font-weight: 600; max-width: 22ch; overflow: hidden; text-overflow: ellipsis; }
    .htxt { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
  `]
})
export class UuidLogsComponent {
  private readonly api = inject(ApiService);

  readonly uuid = input.required<string>();
  /** When the step started; files last changed before this are skipped. */
  readonly since = input<string | null | undefined>(null);

  readonly busy = signal(false);
  readonly hits = signal<LogFileHit[]>([]);
  readonly note = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly resume = signal<{ file: number; offset: number } | null>(null);
  private ids: string[] = [];
  private scanned = 0;

  start(): void {
    this.hits.set([]);
    this.error.set(null);
    this.note.set(null);
    this.resume.set(null);
    this.scanned = 0;
    this.busy.set(true);
    this.api.logFiles().subscribe({
      next: r => {
        const from = this.since() ? new Date(this.since()!).getTime() - 60_000 : 0;
        // files come newest first; one changed before the step began cannot hold its lines
        const calls = r.files.filter(f => f.webService);
        this.ids = calls.filter(f => !from || new Date(f.modified).getTime() >= from).slice(0, 50).map(f => f.id);
        if (!r.configured) {
          this.busy.set(false);
          this.note.set('No log folder is configured.');
        } else if (calls.length === 0) {
          this.busy.set(false);
          this.note.set('No web service call log file was found (calls_ws_apis.out). Check console.logs.dirs and console.logs.web-service-file-pattern.');
        } else if (this.ids.length === 0) {
          this.busy.set(false);
          this.note.set('No web service call log file was changed since this step started.');
        } else {
          this.run(0, 0);
        }
      },
      error: e => this.fail(e)
    });
  }

  more(): void {
    const r = this.resume();
    if (r) {
      this.run(r.file, r.offset);
    }
  }

  private run(file: number, offset: number): void {
    this.busy.set(true);
    this.api.logFind(this.ids, this.uuid(), file, offset, 200).subscribe({
      next: r => {
        this.busy.set(false);
        this.scanned += r.scannedBytes;
        this.hits.update(h => [...h, ...r.hits]);
        const n = this.hits().length;
        const read = (this.scanned / 1024 ** 2).toFixed(1) + ' MB read';
        if (r.done) {
          this.resume.set(null);
          this.note.set(n === 0 ? 'No log line mentions it (' + read + ' in ' + this.ids.length + ' files).' : n + ' line' + (n === 1 ? '' : 's') + ' (' + read + ').');
        } else {
          this.resume.set({ file: r.resumeFile ?? 0, offset: r.resumeOffset ?? 0 });
          this.note.set(n + ' line' + (n === 1 ? '' : 's') + ' so far (' + read + ').');
        }
      },
      error: e => this.fail(e)
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set(describeError(e));
  }
}
