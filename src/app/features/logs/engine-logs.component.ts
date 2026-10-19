import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../core/api.service';
import { describeError } from '../../core/errors';
import { LogFile, LogFileHit, LogHit, LogPage } from '../../core/models';
import { DateTimePipe } from '../../shared/pipes';

/** Past the end of any file: the server turns it into "the end", which gives the tail. */
const END = Number.MAX_SAFE_INTEGER;

interface Part {
  text: string;
  hit: boolean;
}

/**
 * The BPM engine's log files, a page at a time. The files can be many gigabytes, so the server never reads a whole file:
 * every move (first, previous, next, last, jump to a position, search) asks for one page by byte position.
 */
@Component({
  selector: 'app-engine-logs',
  standalone: true,
  imports: [DecimalPipe, FormsModule, ButtonModule, MessageModule, MultiSelectModule, SelectModule, ToggleSwitchModule, DateTimePipe],
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-1"><i class="pi pi-file mr-2"></i>Engine logs</div>
      <p class="text-muted-color mb-4">The BPM engine's log files, one page at a time. Large files are never loaded whole: move through them with the
        buttons, jump to a position, or search.</p>

      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-3" /> }
      @if (configured() === false) {
        <p-message severity="info" styleClass="mb-3"
          text="No log folder is configured. Set console.logs.dirs in the settings to the folders that hold the engine logs." />
      }

      @if (files().length > 1) {
        <div class="manyfiles mb-4">
          <div class="font-semibold mb-2"><i class="pi pi-search mr-2"></i>Search in several files</div>
          <form class="flex flex-wrap items-end gap-2" (ngSubmit)="findMany()">
            <div class="flex flex-col gap-1" style="min-width:20rem;flex:1 1 20rem">
              <label for="manyfiles">Files (searched in this order)</label>
              <p-multiselect inputId="manyfiles" [options]="files()" optionValue="id" optionLabel="name" [ngModel]="manyIds()" (ngModelChange)="manyIds.set($event)" name="manyIds"
                [filter]="true" filterBy="name" [maxSelectedLabels]="2" selectedItemsLabel="{0} files" placeholder="Choose files" display="comma" fluid appendTo="body" />
            </div>
            <input class="p-inputtext" type="text" name="manyTerm" placeholder="Text to find in all of them" [ngModel]="manyTerm()" (ngModelChange)="manyTerm.set($event)" style="min-width:16rem" />
            <p-button type="submit" icon="pi pi-search" label="Search" size="small" [disabled]="manyBusy() || !manyTerm().trim() || manyIds().length === 0" />
            <p-button type="button" label="All files" size="small" severity="secondary" [text]="true" (onClick)="manyIds.set(allIds())" />
          </form>
          <p class="text-muted-color text-sm mt-2 mb-2">Reads the files from disk only, a limited amount at a time, so the database is not involved. At most 50 files.</p>
          @if (manyNote()) {
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <span class="text-muted-color">{{ manyNote() }}</span>
              @if (resume() !== null) {
                <p-button type="button" label="Keep searching" size="small" severity="secondary" [outlined]="true" (onClick)="keepFindingMany()" [disabled]="manyBusy()" />
              }
            </div>
          }
          @if (manyHits().length > 0) {
            <div class="hits" role="list" aria-label="Matches in the chosen files">
              @for (h of manyHits(); track $index) {
                <button type="button" class="hit" role="listitem" (click)="openHit(h)" [title]="'Open ' + h.name + ' at byte ' + h.offset">
                  <span class="hfile">{{ h.name }}</span>
                  <span class="hoff">{{ h.offset | number }}</span>
                  <span class="htxt">{{ h.text }}@if (h.cut > 0) { <i> … {{ h.cut }} more characters</i> }</span>
                </button>
              }
            </div>
          }
        </div>
      }

      @if (files().length > 0) {
        <div class="grid grid-cols-12 gap-4 items-end mb-3">
          <div class="col-span-12 md:col-span-6 flex flex-col gap-2">
            <label for="logfile">File</label>
            <p-select inputId="logfile" [options]="files()" optionValue="id" [ngModel]="fileId()" (ngModelChange)="choose($event)" [filter]="true" filterBy="name" fluid
              placeholder="Choose a log file">
              <ng-template #selectedItem let-f>{{ f.name }} <span class="text-muted-color">({{ size(f.sizeBytes) }})</span></ng-template>
              <ng-template #item let-f>{{ f.name }} <span class="text-muted-color">{{ size(f.sizeBytes) }} · {{ f.modified | dateTime }}</span></ng-template>
            </p-select>
          </div>
          <div class="col-span-6 md:col-span-3 flex flex-col gap-2">
            <label for="lines">Lines per page</label>
            <p-select inputId="lines" [options]="pageSizes" [ngModel]="lines()" (ngModelChange)="setLines($event)" fluid />
          </div>
          <div class="col-span-6 md:col-span-3 flex items-center gap-2 pb-2">
            <p-toggleswitch inputId="follow" [ngModel]="follow()" (ngModelChange)="setFollow($event)" />
            <label for="follow">Follow the end</label>
          </div>
        </div>
      }

      @if (fileId()) {
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <p-button type="button" icon="pi pi-angle-double-left" label="Start" size="small" severity="secondary" [outlined]="true" (onClick)="first()" [disabled]="busy()" />
          <p-button type="button" icon="pi pi-angle-left" label="Previous" size="small" severity="secondary" [outlined]="true" (onClick)="previous()" [disabled]="busy() || !page()?.hasPrevious" />
          <p-button type="button" icon="pi pi-angle-right" label="Next" size="small" severity="secondary" [outlined]="true" (onClick)="next()" [disabled]="busy() || !page()?.hasNext" />
          <p-button type="button" icon="pi pi-angle-double-right" label="End" size="small" severity="secondary" [outlined]="true" (onClick)="last()" [disabled]="busy()" />
          <p-button type="button" icon="pi pi-refresh" size="small" severity="secondary" [text]="true" (onClick)="refresh()" ariaLabel="Reload this page" />
          <span class="flex-1"></span>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="wrap()" (ngModelChange)="wrap.set($event)" /> Wrap long lines</label>
        </div>

        @if (page(); as p) {
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <input type="range" class="flex-1 min-w-48" min="0" max="1000" [value]="position()" (change)="jump($event)" aria-label="Position in the file" />
            <span class="text-muted-color text-sm mono">{{ size(p.startOffset) }} – {{ size(p.endOffset) }} of {{ size(p.size) }} ({{ percent() }}%)</span>
          </div>
        }

        <form class="flex flex-wrap items-center gap-2 mb-3" (ngSubmit)="find(true, false)">
          <input class="p-inputtext" type="text" name="term" placeholder="Search this file (instance id, request id, error...)" [ngModel]="term()" (ngModelChange)="term.set($event)" style="min-width:18rem" />
          <p-button type="button" icon="pi pi-arrow-up" label="Previous match" size="small" severity="secondary" [outlined]="true" (onClick)="find(false, true)" [disabled]="busy() || !term().trim()" />
          <p-button type="submit" icon="pi pi-arrow-down" label="Next match" size="small" [disabled]="busy() || !term().trim()" />
        </form>
        @if (note()) {
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span class="text-muted-color">{{ note() }}</span>
            @if (continueFrom() !== null) {
              <p-button type="button" label="Keep searching" size="small" severity="secondary" [outlined]="true" (onClick)="keepSearching()" [disabled]="busy()" />
            }
          </div>
        }

        <div class="log" [class.wrap]="wrap()" [class.busy]="busy()" role="log" aria-label="Log lines">
          @for (l of page()?.lines ?? []; track l.offset) {
            <div class="row" [class.error]="isError(l.text)" [class.warn]="isWarn(l.text)" [class.trace]="isTrace(l.text)" [class.current]="l.offset === match()">
              <span class="off" [title]="'Byte position ' + l.offset">{{ l.offset | number }}</span>
              <span class="txt">@for (x of parts(l.text); track $index) { @if (x.hit) { <mark>{{ x.text }}</mark> } @else { {{ x.text }} } }@if (l.cut > 0) { <i class="text-muted-color"> … {{ l.cut }} more characters not shown</i> }</span>
            </div>
          } @empty {
            @if (!busy() && page()) { <div class="text-muted-color p-3">This part of the file has no lines.</div> }
          }
        </div>
      } @else if (configured() && files().length === 0 && !loading()) {
        <p class="text-muted-color">No log file matches in the configured folders.</p>
      }
    </div>
  `,
  styles: [`
    .log { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); overflow: auto; max-height: 68vh;
      font: 12.5px/1.45 ui-monospace, Menlo, Consolas, monospace; }
    .log.busy { opacity: .55; }
    .row { display: flex; gap: 12px; padding: 1px 10px; white-space: pre; }
    .log.wrap .row { white-space: pre-wrap; word-break: break-word; }
    .row:hover { background: var(--surface-2, rgba(128,128,128,.08)); }
    .off { flex: 0 0 auto; min-width: 9ch; text-align: right; color: var(--muted); user-select: none; font-size: 11px; padding-top: 1px; }
    .txt { flex: 1 1 auto; }
    .row.error .txt { color: var(--c-failed); }
    .row.warn .txt { color: var(--c-suspended); }
    .row.trace .txt { color: var(--muted); }
    .row.current { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
    .manyfiles { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
    .hits { border: 1px solid var(--border); border-radius: 8px; max-height: 30vh; overflow: auto; font: 12.5px/1.45 ui-monospace, Menlo, Consolas, monospace; }
    .hit { display: flex; gap: 12px; width: 100%; text-align: left; padding: 2px 10px; background: transparent; border: 0; cursor: pointer; color: inherit; white-space: pre; }
    .hit:hover { background: var(--surface-2, rgba(128,128,128,.1)); }
    .hfile { flex: 0 0 auto; font-weight: 600; max-width: 22ch; overflow: hidden; text-overflow: ellipsis; }
    .hoff { flex: 0 0 auto; min-width: 9ch; text-align: right; color: var(--muted); font-size: 11px; padding-top: 1px; }
    .htxt { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
    mark { background: #ffe58a; color: #1d2330; border-radius: 2px; padding: 0 1px; }
  `]
})
export class EngineLogsComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly pageSizes = [100, 200, 500, 1000];

  readonly configured = signal<boolean | null>(null);
  readonly files = signal<LogFile[]>([]);
  readonly fileId = signal<string | null>(null);
  readonly page = signal<LogPage | null>(null);
  readonly lines = signal(200);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly wrap = signal(false);
  readonly follow = signal(false);

  readonly term = signal('');
  readonly match = signal<number | null>(null);
  readonly note = signal<string | null>(null);
  readonly continueFrom = signal<number | null>(null);
  private lastDirection: 'forward' | 'backward' = 'forward';

  // search over several files
  readonly manyIds = signal<string[]>([]);
  readonly manyTerm = signal('');
  readonly manyHits = signal<LogFileHit[]>([]);
  readonly manyBusy = signal(false);
  readonly manyNote = signal<string | null>(null);
  /** Where the last search stopped (the file's place in the chosen list and the byte position), to go on from. */
  readonly resume = signal<{ file: number; offset: number } | null>(null);
  private manySearched: string[] = [];
  private manyText = '';
  private manyScanned = 0;

  readonly percent = computed(() => {
    const p = this.page();
    return p && p.size > 0 ? Math.min(100, Math.round((p.startOffset / p.size) * 1000) / 10) : 0;
  });
  readonly position = computed(() => {
    const p = this.page();
    return p && p.size > 0 ? Math.round((p.startOffset / p.size) * 1000) : 0;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.api.logFiles().subscribe({
      next: r => {
        this.configured.set(r.configured);
        this.files.set(r.files);
        this.loading.set(false);
        if (r.files.length > 0) {
          this.choose(r.files[0].id);
        }
      },
      error: e => {
        this.loading.set(false);
        this.error.set(describeError(e));
      }
    });
  }

  ngOnDestroy(): void {
    this.stopFollowing();
  }

  /** A size in bytes in the unit a person reads (KB, MB, GB). */
  size(bytes: number): string {
    if (bytes >= 1024 ** 3) {
      return (bytes / 1024 ** 3).toFixed(2) + ' GB';
    }
    if (bytes >= 1024 ** 2) {
      return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    }
    if (bytes >= 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return bytes + ' B';
  }

  choose(id: string): void {
    this.fileId.set(id);
    this.match.set(null);
    this.note.set(null);
    this.continueFrom.set(null);
    this.page.set(null);
    this.last();
  }

  setLines(n: number): void {
    this.lines.set(n);
    const p = this.page();
    this.go(p ? p.startOffset : 0, 'forward');
  }

  first(): void { this.go(0, 'forward'); }
  last(): void { this.go(END, 'backward'); }
  next(): void { const p = this.page(); if (p?.hasNext) { this.go(p.endOffset, 'forward'); } }
  previous(): void { const p = this.page(); if (p?.hasPrevious) { this.go(p.startOffset, 'backward'); } }

  refresh(): void {
    const p = this.page();
    if (p && !p.hasNext) {
      this.last();
    } else {
      this.go(p ? p.startOffset : 0, 'forward');
    }
  }

  jump(event: Event): void {
    const p = this.page();
    const value = Number((event.target as HTMLInputElement).value);
    if (p) {
      this.go(Math.floor((p.size * value) / 1000), 'forward');
    }
  }

  setFollow(on: boolean): void {
    this.follow.set(on);
    this.stopFollowing();
    if (on) {
      this.last();
      this.timer = setInterval(() => { if (!this.busy()) { this.go(END, 'backward', true); } }, 3000);
    }
  }

  private stopFollowing(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private go(offset: number, direction: 'forward' | 'backward', quiet = false): void {
    const file = this.fileId();
    if (!file) {
      return;
    }
    if (!quiet) {
      this.busy.set(true);
    }
    this.api.logPage(file, offset, this.lines(), direction).subscribe({
      next: p => {
        this.page.set(p);
        this.busy.set(false);
        this.error.set(null);
        this.scrollTop(direction === 'backward');
      },
      error: e => {
        this.busy.set(false);
        this.error.set(describeError(e));
        this.stopFollowing();
        this.follow.set(false);
      }
    });
  }

  // ---- search

  find(forward: boolean, skipCurrent: boolean): void {
    this.lastDirection = forward ? 'forward' : 'backward';
    const p = this.page();
    const from = this.match() !== null ? this.match()! : p ? (forward ? p.startOffset : p.startOffset) : 0;
    this.search(from, forward, this.match() !== null || skipCurrent);
  }

  keepSearching(): void {
    const from = this.continueFrom();
    if (from !== null) {
      this.search(from, this.lastDirection === 'forward', false);
    }
  }

  private search(from: number, forward: boolean, skip: boolean): void {
    const file = this.fileId();
    const text = this.term().trim();
    if (!file || !text) {
      return;
    }
    this.busy.set(true);
    this.note.set(null);
    this.continueFrom.set(null);
    this.api.logSearch(file, text, from, forward ? 'forward' : 'backward', skip).subscribe({
      next: (h: LogHit) => this.afterSearch(h, forward),
      error: e => {
        this.busy.set(false);
        this.error.set(describeError(e));
      }
    });
  }

  private afterSearch(h: LogHit, forward: boolean): void {
    if (h.found && h.offset !== null && h.offset !== undefined) {
      this.match.set(h.offset);
      this.go(h.offset, 'forward');
      this.note.set(null);
      return;
    }
    this.busy.set(false);
    if (h.reachedEdge) {
      this.note.set(forward ? 'No further match: this is the end of the file.' : 'No earlier match: this is the start of the file.');
    } else {
      this.note.set('Searched ' + this.size(h.scannedBytes) + ' without a match. The file is large; the search stops after a limit so the page stays responsive.');
      this.continueFrom.set(h.stoppedAt ?? null);
    }
  }

  // ---- search in several files

  allIds(): string[] {
    return this.files().slice(0, 50).map(f => f.id);
  }

  findMany(): void {
    this.manySearched = [...this.manyIds()];
    this.manyText = this.manyTerm().trim();
    this.manyHits.set([]);
    this.manyScanned = 0;
    this.manyNote.set(null);
    this.resume.set(null);
    this.runMany(0, 0);
  }

  keepFindingMany(): void {
    const r = this.resume();
    if (r) {
      this.runMany(r.file, r.offset);
    }
  }

  private runMany(startFile: number, from: number): void {
    if (!this.manyText || this.manySearched.length === 0) {
      return;
    }
    this.manyBusy.set(true);
    this.api.logFind(this.manySearched, this.manyText, startFile, from, 200).subscribe({
      next: r => {
        this.manyBusy.set(false);
        this.error.set(null);
        this.manyScanned += r.scannedBytes;
        this.manyHits.update(h => [...h, ...r.hits]);
        const n = this.manyHits().length;
        if (r.done) {
          this.resume.set(null);
          this.manyNote.set(n === 0
            ? 'No match in the ' + this.manySearched.length + ' files (' + this.size(this.manyScanned) + ' read).'
            : n + ' match' + (n === 1 ? '' : 'es') + ' in ' + this.manySearched.length + ' files (' + this.size(this.manyScanned) + ' read).');
        } else {
          this.resume.set({ file: r.resumeFile ?? 0, offset: r.resumeOffset ?? 0 });
          this.manyNote.set(n + ' match' + (n === 1 ? '' : 'es') + ' so far, ' + this.size(this.manyScanned)
            + ' read. The search pauses after a limit so the server stays responsive.');
        }
      },
      error: e => {
        this.manyBusy.set(false);
        this.error.set(describeError(e));
      }
    });
  }

  /** Shows the file at the matching line, with the line marked, in the viewer below. */
  openHit(h: LogFileHit): void {
    this.term.set(this.manyText);
    if (this.fileId() !== h.file) {
      this.fileId.set(h.file);
      this.page.set(null);
    }
    this.note.set(null);
    this.continueFrom.set(null);
    this.match.set(h.offset);
    this.go(h.offset, 'forward');
  }

  // ---- showing lines

  parts(text: string): Part[] {
    const term = this.term().trim();
    if (!term) {
      return [{ text, hit: false }];
    }
    const out: Part[] = [];
    const lower = text.toLowerCase();
    const needle = term.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, at)) {
      if (i > at) {
        out.push({ text: text.slice(at, i), hit: false });
      }
      out.push({ text: text.slice(i, i + needle.length), hit: true });
      at = i + needle.length;
    }
    if (at < text.length) {
      out.push({ text: text.slice(at), hit: false });
    }
    return out.length ? out : [{ text, hit: false }];
  }

  isError(t: string): boolean { return /\b(ERROR|SEVERE|FATAL|Exception)\b/.test(t) && !this.isTrace(t); }
  isWarn(t: string): boolean { return /\b(WARN|WARNING)\b/.test(t); }
  isTrace(t: string): boolean { return /^\s*(at |Caused by|\.\.\. \d+ more)/.test(t); }

  private scrollTop(toEnd: boolean): void {
    setTimeout(() => {
      const el = document.querySelector('.log');
      if (el) {
        el.scrollTop = toEnd ? el.scrollHeight : 0;
      }
    }, 0);
  }
}
