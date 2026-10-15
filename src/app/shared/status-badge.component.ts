import { Component, Input } from '@angular/core';
import { StatusLook } from '../core/status';

/** A status chip. The glyph and the text carry the meaning; colour only reinforces it. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge st-' + look.cls"><span aria-hidden="true">{{ look.glyph }}</span>{{ text ?? look.label }}</span>`
})
export class StatusBadgeComponent {
  @Input({ required: true }) look!: StatusLook;
  /** Overrides the label, e.g. to show the engine's own wording. */
  @Input() text?: string;
}
