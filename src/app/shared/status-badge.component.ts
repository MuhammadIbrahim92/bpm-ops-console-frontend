import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { StatusLook } from '../core/status';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

const SEVERITY: Record<string, Severity> = {
  done: 'success',
  running: 'info',
  failed: 'danger',
  suspended: 'warn',
  timeout: 'warn',
  pending: 'secondary',
  idle: 'secondary',
  unknown: 'contrast',
  terminated: 'contrast'
};

/** A status chip (PrimeNG tag). The glyph and the text carry the meaning; colour only reinforces it. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [TagModule],
  template: `<p-tag [severity]="severity()" [value]="glyph() + (text ?? look.label)" />`
})
export class StatusBadgeComponent {
  @Input({ required: true }) look!: StatusLook;
  /** Overrides the label, e.g. to show the engine's own wording. */
  @Input() text?: string;

  severity(): Severity {
    return SEVERITY[this.look.cls] ?? 'secondary';
  }

  glyph(): string {
    return this.look.glyph ? `${this.look.glyph} ` : '';
  }
}
