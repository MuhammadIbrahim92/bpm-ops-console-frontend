export type Lang = 'en' | 'ar';

/** The words of the assistant page in the two languages it speaks. */
export const TEXT: Record<Lang, {
  title: string; intro: string; off: string; noLogs: string; tabAsk: string; tabDigest: string; looking: string; instance: string;
  step: string; forget: string; try: string; suggestQueue: string[]; suggestInstance: string[]; basedOn: string; wasItRight: string;
  right: string; partly: string; wrong: string; thanks: string; notePrompt: string; thinking: string; placeholder: string; send: string;
  newChat: string; makeDigest: string; digestOf: string; noDigest: string;
}> = {
  en: {
    title: 'Assistant',
    intro: 'Ask about an instance, a step or the queue. The assistant looks at the real data and logs, shows what it based the answer on, and proposes what to do. It never changes anything.',
    off: 'The assistant is not switched on yet. It needs a model server on the premises (console.agent.enabled, endpoint and model in the settings).',
    noLogs: 'No log folder is configured, so the assistant cannot read real error messages; it will say so when the cause is only visible in the logs.',
    tabAsk: 'Ask', tabDigest: 'Digest', looking: 'Looking at', instance: 'Instance', step: 'Step', forget: 'Forget this',
    try: 'Try asking',
    suggestQueue: ['What needs attention right now?', 'Which failures started today and look like one cause?', 'Which completed instances have failed steps that matter?'],
    suggestInstance: ['Why is this instance stuck or failed?', 'Explain what happened in this instance, step by step.', 'Was the failed step important, and can it be retried?'],
    basedOn: 'Based on', wasItRight: 'Was this right?', right: 'Right', partly: 'Partly', wrong: 'Wrong', thanks: 'Thank you, saved.',
    notePrompt: 'What was wrong or missing? (optional)', thinking: 'Looking into it…', placeholder: 'Type your question (Enter to send, Shift+Enter for a new line)',
    send: 'Send', newChat: 'New conversation', makeDigest: 'Make today’s digest', digestOf: 'Digest of', noDigest: 'No digest has been made yet. Press the button to make one.'
  },
  ar: {
    title: 'المساعد',
    intro: 'اسأل عن نسخة عملية أو خطوة أو قائمة الانتظار. يفحص المساعد البيانات الفعلية والسجلات، ويعرض ما استند إليه في إجابته، ويقترح ما يجب فعله. ولا يغيّر أي شيء بنفسه.',
    off: 'المساعد غير مفعّل بعد. يحتاج إلى خادم نموذج داخل المؤسسة (console.agent.enabled والعنوان واسم النموذج في الإعدادات).',
    noLogs: 'لم يتم تحديد مجلد للسجلات، لذلك لا يستطيع المساعد قراءة رسائل الخطأ الفعلية، وسيذكر ذلك عندما يظهر السبب في السجلات فقط.',
    tabAsk: 'اسأل', tabDigest: 'الملخص اليومي', looking: 'تنظر في', instance: 'النسخة', step: 'الخطوة', forget: 'تجاهل هذا',
    try: 'جرّب أن تسأل',
    suggestQueue: ['ما الذي يحتاج إلى اهتمام الآن؟', 'ما الأعطال التي بدأت اليوم وتبدو ناتجة عن سبب واحد؟', 'أي النسخ المكتملة فيها خطوات فاشلة مهمة؟'],
    suggestInstance: ['لماذا هذه النسخة متوقفة أو فاشلة؟', 'اشرح ما حدث في هذه النسخة خطوة بخطوة.', 'هل الخطوة الفاشلة مهمة، وهل يمكن إعادة المحاولة؟'],
    basedOn: 'استندت إلى', wasItRight: 'هل كانت الإجابة صحيحة؟', right: 'صحيحة', partly: 'جزئياً', wrong: 'خاطئة', thanks: 'شكراً، تم الحفظ.',
    notePrompt: 'ما الخطأ أو الناقص؟ (اختياري)', thinking: 'جارٍ البحث…', placeholder: 'اكتب سؤالك (Enter للإرسال، Shift+Enter لسطر جديد)',
    send: 'إرسال', newChat: 'محادثة جديدة', makeDigest: 'إنشاء ملخص اليوم', digestOf: 'ملخص يوم', noDigest: 'لم يتم إنشاء ملخص بعد. اضغط الزر لإنشاء واحد.'
  }
};

/** What each tool is called on screen, so the evidence list reads in the person's language. */
export const TOOL_LABEL: Record<Lang, Record<string, string>> = {
  en: {
    issue_summary: 'Issue counts', list_issues: 'List of issues', get_instance: 'Instance', get_run: 'How the instance ran',
    get_step: 'Step details', get_attributes: 'Attribute values', explain_branch: 'Arrow condition', get_requests: 'Engine requests',
    find_similar: 'Same step on other instances', search_logs: 'Log search', get_playbook: 'Team playbook'
  },
  ar: {
    issue_summary: 'أعداد المشكلات', list_issues: 'قائمة المشكلات', get_instance: 'النسخة', get_run: 'مسار تنفيذ النسخة',
    get_step: 'تفاصيل الخطوة', get_attributes: 'قيم الخصائص', explain_branch: 'شرط السهم', get_requests: 'طلبات المحرك',
    find_similar: 'الخطوة نفسها في نسخ أخرى', search_logs: 'البحث في السجلات', get_playbook: 'دليل الفريق'
  }
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Turns the assistant's plain text into safe HTML: everything is escaped first, then only **bold**, `code`, lists and links
 * to instances ("instance 123") are added. Nothing from the answer can become a tag or an attribute.
 */
export function formatAnswer(text: string): string {
  const lines = escapeHtml(text ?? '').split(/\r?\n/);
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const inline = (s: string) =>
    s.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\b([Ii]nstance|النسخة)\s+#?(\d{5,})\b/g, '$1 <a href="#/instances/$2">$2</a>');
  for (const raw of lines) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(raw);
    const number = /^\s*\d+[.)]\s+(.*)$/.exec(raw);
    if (bullet) {
      if (list !== 'ul') { close(); out.push('<ul style="margin:6px 20px;list-style:disc">'); list = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (number) {
      if (list !== 'ol') { close(); out.push('<ol style="margin:6px 20px;list-style:decimal">'); list = 'ol'; }
      out.push(`<li>${inline(number[1])}</li>`);
    } else {
      close();
      out.push(raw.trim() === '' ? '<br>' : `<div>${inline(raw)}</div>`);
    }
  }
  close();
  return out.join('');
}
