import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AgentAnswer, AgentStatus } from '../../core/models';
import { AssistantComponent } from './assistant.component';
import { formatAnswer } from './assistant-text';

describe('formatAnswer', () => {
  it('escapes everything the model writes, so nothing can become markup', () => {
    const html = formatAnswer('<img src=x onerror=alert(1)> & "quoted"');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&amp;');
  });

  it('adds only bold, code, lists and links to instances', () => {
    const html = formatAnswer('**Cause**: `MSISDN` is empty.\n- instance 277939916 failed\n- request 23047382\n1. retry later');
    expect(html).toContain('<b>Cause</b>');
    expect(html).toContain('<code>MSISDN</code>');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<a href="#/instances/277939916">277939916</a>');
    expect(html).not.toContain('href="#/instances/23047382"');
  });
});

describe('AssistantComponent', () => {
  const answer: AgentAnswer = { answer: 'Three steps failed.', language: 'en', model: 'm', tools: [{ name: 'issue_summary', arguments: '{}' }] };
  let asked: { question: string; language: string; context?: unknown }[];
  let rated: unknown[];
  let status: AgentStatus;

  function build(query: Record<string, string> = {}) {
    asked = [];
    rated = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        {
          provide: ApiService,
          useValue: {
            agentStatus: () => of(status),
            agentAsk: (b: { question: string; language: string; context?: unknown }): Observable<AgentAnswer> => { asked.push(b); return of({ ...answer, language: b.language }); },
            agentFeedback: (b: unknown) => { rated.push(b); return of(void 0); },
            agentDigest: () => of({}),
            agentMakeDigest: () => of({ date: '2026-10-19', text: 'Digest text' })
          }
        }
      ]
    });
    const f = TestBed.createComponent(AssistantComponent);
    f.detectChanges();
    return f;
  }

  beforeEach(() => { status = { ready: true, model: 'm', languages: ['en', 'ar'], logsConfigured: true }; });

  it('says so when the assistant is not switched on, and does not send questions', () => {
    status = { ready: false, languages: ['en', 'ar'], logsConfigured: false };
    const f = build();
    expect((f.nativeElement as HTMLElement).textContent).toContain('not switched on');
    f.componentInstance.ask('hello');
    expect(asked.length).toBe(0);
  });

  it('sends the question with the language and what the person is looking at, and shows the answer with its evidence', () => {
    const f = build({ instance: '277939916', step: 'FME_Activ11' });
    f.componentInstance.ask('Why did it fail?');
    f.detectChanges();
    expect(asked[0].question).toBe('Why did it fail?');
    expect(asked[0].language).toBe('en');
    expect(asked[0].context).toEqual({ instanceId: 277939916, activityId: 'FME_Activ11' });
    const text = (f.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Three steps failed.');
    expect(text).toContain('Issue counts');
  });

  it('answers in Arabic, right to left, when the person switches the language', () => {
    const f = build();
    f.componentInstance.lang.set('ar');
    f.componentInstance.ask('ما الذي يحتاج إلى اهتمام؟');
    f.detectChanges();
    expect(asked[0].language).toBe('ar');
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.card')!.getAttribute('dir')).toBe('rtl');
    expect(el.querySelector('.bubble:not(.me)')!.getAttribute('dir')).toBe('rtl');
    expect(el.textContent).toContain('المساعد');
  });

  it('saves a rating of an answer', () => {
    const f = build();
    f.componentInstance.ask('What is failing?');
    spyOn(window, 'prompt').and.returnValue('missing the log line');
    f.componentInstance.rate(1, 'wrong');
    expect(rated.length).toBe(1);
    expect(rated[0]).toEqual(jasmine.objectContaining({ rating: 'wrong', note: 'missing the log line', tools: ['issue_summary'] }));
    expect(f.componentInstance.bubbles()[1].rated).toBe('wrong');
  });
});
