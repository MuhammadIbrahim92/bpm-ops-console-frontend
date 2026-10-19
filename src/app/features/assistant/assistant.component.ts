import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { AgentAnswer, AgentStatus } from '../../core/models';
import { describeError } from '../../core/errors';
import { Lang, TEXT, TOOL_LABEL, formatAnswer } from './assistant-text';

interface Bubble {
  who: 'me' | 'assistant';
  text: string;
  lang: Lang;
  answer?: AgentAnswer;
  question?: string;
  rated?: string;
}

/**
 * The operations assistant: ask about an instance, a step or the queue and get an answer with the evidence it was
 * based on, in English or Arabic. It only reads; an action is proposed in the text and done by the person in the console.
 */
@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [FormsModule, ButtonModule, MessageModule, SelectButtonModule, TabsModule, TagModule],
  template: `
    <div class="card" [attr.dir]="dir()">
      <div class="flex flex-wrap items-center gap-3 mb-3">
        <div class="font-semibold text-xl"><i class="pi pi-comments mr-2"></i>{{ t().title }}</div>
        <span class="flex-1"></span>
        <p-selectbutton [options]="languages" optionLabel="label" optionValue="value" [ngModel]="lang()" (ngModelChange)="lang.set($event)" [allowEmpty]="false" />
      </div>
      <p class="text-muted-color mb-3">{{ t().intro }}</p>

      @if (status(); as s) {
        @if (!s.ready) {
          <p-message severity="warn" [text]="t().off" styleClass="mb-3" />
        } @else if (!s.logsConfigured) {
          <p-message severity="info" [text]="t().noLogs" styleClass="mb-3" />
        }
      }
      @if (error()) { <p-message severity="error" [text]="error()!" styleClass="mb-3" /> }

      <p-tabs [value]="tab()" (valueChange)="tab.set($any($event)); onTab($any($event))">
        <p-tablist>
          <p-tab value="ask"><i class="pi pi-comment mr-2"></i>{{ t().tabAsk }}</p-tab>
          <p-tab value="digest"><i class="pi pi-list-check mr-2"></i>{{ t().tabDigest }}</p-tab>
        </p-tablist>
      </p-tabs>

      @if (tab() === 'ask') {
        <div class="mt-4">
          @if (instanceId() !== null) {
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="text-muted-color">{{ t().looking }}</span>
              <p-tag [value]="t().instance + ' ' + instanceId()" severity="info" />
              @if (activityId()) { <p-tag [value]="t().step + ' ' + activityId()" severity="secondary" /> }
              <p-button type="button" icon="pi pi-times" size="small" [text]="true" severity="secondary" (onClick)="clearContext()" [ariaLabel]="t().forget" />
            </div>
          }

          @if (bubbles().length === 0) {
            <div class="mb-3">
              <div class="text-muted-color mb-2">{{ t().try }}</div>
              <div class="flex flex-wrap gap-2">
                @for (q of suggestions(); track q) {
                  <p-button type="button" [label]="q" size="small" severity="secondary" [outlined]="true" (onClick)="ask(q)" [disabled]="busy() || !ready()" />
                }
              </div>
            </div>
          }

          <div class="thread" #thread>
            @for (b of bubbles(); track $index; let i = $index) {
              <div class="bubble" [class.me]="b.who === 'me'" [attr.dir]="b.lang === 'ar' ? 'rtl' : 'ltr'">
                @if (b.who === 'me') {
                  <div class="text">{{ b.text }}</div>
                } @else {
                  <div class="text answer" [innerHTML]="html(b.text)"></div>
                  @if (b.answer && b.answer.tools.length > 0) {
                    <details class="evidence">
                      <summary>{{ t().basedOn }} ({{ b.answer.tools.length }})</summary>
                      <ul>@for (u of b.answer.tools; track $index) { <li><b>{{ toolLabel(u.name) }}</b> <code>{{ u.arguments }}</code></li> }</ul>
                    </details>
                  }
                  @if (b.answer) {
                    <div class="rate" [attr.dir]="dir()">
                      @if (b.rated) {
                        <span class="text-muted-color">{{ t().thanks }}</span>
                      } @else {
                        <span class="text-muted-color">{{ t().wasItRight }}</span>
                        <p-button type="button" [label]="t().right" size="small" severity="success" [outlined]="true" (onClick)="rate(i, 'right')" />
                        <p-button type="button" [label]="t().partly" size="small" severity="secondary" [outlined]="true" (onClick)="rate(i, 'partly')" />
                        <p-button type="button" [label]="t().wrong" size="small" severity="danger" [outlined]="true" (onClick)="rate(i, 'wrong')" />
                      }
                    </div>
                  }
                }
              </div>
            }
            @if (busy()) {
              <div class="bubble"><i class="pi pi-spin pi-spinner mr-2"></i>{{ t().thinking }} {{ seconds() }}s</div>
            }
          </div>

          <form class="flex gap-2 mt-3" (ngSubmit)="ask(draft())">
            <textarea class="p-inputtext flex-1" rows="2" name="q" [placeholder]="t().placeholder" [ngModel]="draft()" (ngModelChange)="draft.set($event)"
              (keydown.enter)="enter($event)" [attr.dir]="lang() === 'ar' ? 'rtl' : 'ltr'" [disabled]="!ready()"></textarea>
            <p-button type="submit" icon="pi pi-send" [label]="t().send" [disabled]="busy() || !ready() || !draft().trim()" />
          </form>
          @if (bubbles().length > 0) {
            <div class="mt-2"><p-button type="button" [label]="t().newChat" icon="pi pi-refresh" size="small" severity="secondary" [text]="true" (onClick)="reset()" /></div>
          }
        </div>
      } @else {
        <div class="mt-4" [attr.dir]="digestLang() === 'ar' ? 'rtl' : 'ltr'">
          <div class="flex flex-wrap items-center gap-3 mb-3" [attr.dir]="dir()">
            <p-button type="button" [label]="t().makeDigest" icon="pi pi-refresh" (onClick)="makeDigest()" [disabled]="busy() || !ready()" />
            @if (digest(); as d) { <span class="text-muted-color">{{ t().digestOf }} {{ d.date }}</span> }
            @if (busy()) { <span><i class="pi pi-spin pi-spinner mr-2"></i>{{ t().thinking }} {{ seconds() }}s</span> }
          </div>
          @if (digest(); as d) {
            @if (d.text) { <div class="text answer digest" [innerHTML]="html(d.text)"></div> } @else { <p class="text-muted-color">{{ t().noDigest }}</p> }
          } @else {
            <p class="text-muted-color">{{ t().noDigest }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .thread { display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow: auto; }
    .bubble { max-width: 92%; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
    .bubble.me { align-self: flex-end; background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
    .text { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
    .answer :is(code) { font: 12.5px ui-monospace, Menlo, Consolas, monospace; background: var(--surface-2, rgba(128,128,128,.12)); padding: 1px 5px; border-radius: 4px; }
    .answer a { text-decoration: underline; }
    .evidence { margin-top: 8px; font-size: 12.5px; color: var(--muted); }
    .evidence summary { cursor: pointer; }
    .evidence ul { margin: 6px 18px; list-style: disc; }
    .rate { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
    textarea { resize: vertical; min-height: 56px; }
    .digest { padding: 12px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  `]
})
export class AssistantComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('thread') private thread?: ElementRef<HTMLElement>;

  readonly languages = [{ label: 'English', value: 'en' }, { label: 'العربية', value: 'ar' }];
  readonly lang = signal<Lang>('en');
  readonly t = computed(() => TEXT[this.lang()]);
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  readonly digestLang = signal<Lang>('en');

  readonly status = signal<AgentStatus | null>(null);
  readonly ready = computed(() => this.status()?.ready === true);
  readonly error = signal<string | null>(null);
  readonly tab = signal<'ask' | 'digest'>('ask');
  readonly bubbles = signal<Bubble[]>([]);
  readonly draft = signal('');
  readonly busy = signal(false);
  readonly seconds = signal(0);
  readonly digest = signal<{ date?: string; text?: string } | null>(null);
  readonly instanceId = signal<number | null>(null);
  readonly activityId = signal<string | null>(null);

  readonly suggestions = computed(() => (this.instanceId() !== null ? this.t().suggestInstance : this.t().suggestQueue));

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const id = Number(q.get('instance'));
    if (id > 0) {
      this.instanceId.set(id);
      this.activityId.set(q.get('step'));
    }
    const l = q.get('lang');
    if (l === 'ar' || l === 'en') {
      this.lang.set(l);
    }
    this.api.agentStatus().subscribe({
      next: s => this.status.set(s),
      error: e => this.error.set(describeError(e))
    });
    if (q.get('q')) {
      this.draft.set(q.get('q')!);
    }
  }

  onTab(tab: string): void {
    if (tab === 'digest' && this.digest() === null) {
      this.api.agentDigest().subscribe({ next: d => this.digest.set(d), error: e => this.error.set(describeError(e)) });
    }
  }

  clearContext(): void {
    this.instanceId.set(null);
    this.activityId.set(null);
  }

  reset(): void {
    this.bubbles.set([]);
  }

  enter(event: Event): void {
    const e = event as KeyboardEvent;
    if (!e.shiftKey) {
      e.preventDefault();
      this.ask(this.draft());
    }
  }

  ask(text: string): void {
    const question = (text ?? '').trim();
    if (!question || this.busy() || !this.ready()) {
      return;
    }
    const lang = this.lang();
    const history = this.bubbles().slice(-8).map(b => ({ role: b.who === 'me' ? 'user' : 'assistant', content: b.text }));
    this.bubbles.update(b => [...b, { who: 'me', text: question, lang }]);
    this.draft.set('');
    this.error.set(null);
    this.start();
    this.api.agentAsk({
      question, language: lang, history,
      context: this.instanceId() !== null ? { instanceId: this.instanceId()!, activityId: this.activityId() ?? undefined } : undefined
    }).subscribe({
      next: a => {
        this.stop();
        this.bubbles.update(b => [...b, { who: 'assistant', text: a.answer, lang: a.language as Lang, answer: a, question }]);
        this.scroll();
      },
      error: e => {
        this.stop();
        this.error.set(describeError(e));
      }
    });
    this.scroll();
  }

  rate(index: number, rating: 'right' | 'partly' | 'wrong'): void {
    const b = this.bubbles()[index];
    if (!b?.answer) {
      return;
    }
    const note = rating === 'right' ? undefined : window.prompt(this.t().notePrompt) ?? undefined;
    this.api.agentFeedback({
      question: b.question ?? '', answer: b.text, rating, note, language: b.lang, tools: b.answer.tools.map(u => u.name)
    }).subscribe({
      next: () => this.bubbles.update(list => list.map((x, i) => (i === index ? { ...x, rated: rating } : x))),
      error: e => this.error.set(describeError(e))
    });
  }

  makeDigest(): void {
    this.digestLang.set(this.lang());
    this.error.set(null);
    this.start();
    this.api.agentMakeDigest(this.lang()).subscribe({
      next: d => { this.stop(); this.digest.set(d); },
      error: e => { this.stop(); this.error.set(describeError(e)); }
    });
  }

  html(text: string): string {
    return formatAnswer(text);
  }

  toolLabel(name: string): string {
    return TOOL_LABEL[this.lang()][name] ?? name;
  }

  private start(): void {
    this.busy.set(true);
    this.seconds.set(0);
    this.timer = setInterval(() => this.seconds.update(s => s + 1), 1000);
  }

  private stop(): void {
    this.busy.set(false);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scroll(): void {
    setTimeout(() => {
      const el = this.thread?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
