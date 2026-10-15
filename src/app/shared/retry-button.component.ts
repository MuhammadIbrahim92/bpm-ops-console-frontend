import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/errors';
import { RequestRow } from '../core/models';

/** Re-queues one engine request. Asks for a second click first, because a retry runs the request again. */
@Component({
  selector: 'app-retry-button',
  standalone: true,
  imports: [ButtonModule],
  template: `
    @if (state() === 'idle') {
      <p-button label="Retry" icon="pi pi-replay" size="small" severity="secondary" [outlined]="true" [disabled]="!enabled" (onClick)="state.set('confirm')" />
    } @else if (state() === 'confirm') {
      <span class="nowrap">Run request {{ row.id }} again?
        <p-button label="Yes, retry" size="small" (onClick)="go()" />
        <p-button label="Cancel" size="small" severity="secondary" [text]="true" (onClick)="state.set('idle')" />
      </span>
    } @else if (state() === 'busy') {
      <span class="muted">Retrying&hellip;</span>
    }
    @if (message()) {
      <div class="muted" role="status">{{ message() }}</div>
    }
  `
})
export class RetryButtonComponent {
  @Input({ required: true }) row!: RequestRow;
  /** False when the person lacks the retry permission. */
  @Input() allowed = true;
  @Output() retried = new EventEmitter<RequestRow>();

  readonly state = signal<'idle' | 'confirm' | 'busy'>('idle');
  readonly message = signal<string | null>(null);

  constructor(private readonly api: ApiService) {}

  get enabled(): boolean {
    return this.allowed && this.row.retryable;
  }

  go(): void {
    this.state.set('busy');
    this.message.set(null);
    this.api.retry(this.row.id).subscribe({
      next: updated => {
        this.state.set('idle');
        this.message.set('Back in the queue.');
        this.retried.emit(updated);
      },
      error: err => {
        this.state.set('idle');
        this.message.set(describeError(err));
      }
    });
  }
}
