import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * The saved HTML links its stylesheets, scripts, images and fonts under /resources (served by this app). Those, and
 * inline styles and scripts, are allowed. Other network calls, forms, frames and every other origin stay blocked.
 */
function policy(): string {
  const origin = location.origin;
  const base = new URL('.', document.baseURI).href;
  return `<base href="${base}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; `
    + `script-src 'unsafe-inline' ${origin}; style-src 'unsafe-inline' ${origin}; img-src data: ${origin}; font-src data: ${origin}; `
    // only the static resources may be fetched (the browser's developer tools ask for the source maps of the libraries);
    // the API and every other address stay blocked
    + `connect-src ${origin}/resources/">`;
}

/**
 * Shows HTML saved by the engine. It is data, not part of this app, so it runs in a sandboxed iframe: its scripts
 * may run, but it gets an opaque origin (no access to this app, its storage or its token), cannot submit forms or
 * navigate the page, and a content policy blocks network requests.
 */
@Component({
  selector: 'app-saved-html',
  standalone: true,
  template: `<iframe sandbox="allow-scripts" [srcdoc]="doc" title="Saved form HTML"></iframe>`,
  styles: [`
    iframe { width: 100%; height: 420px; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
  `]
})
export class SavedHtmlComponent implements OnChanges {
  @Input() html = '';
  doc: SafeHtml = '';

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    // Trusting is deliberate: the iframe sandbox, not the sanitizer, is the isolation boundary.
    this.doc = this.sanitizer.bypassSecurityTrustHtml(policy() + this.html);
  }
}
