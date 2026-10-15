import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/errors';
import { RequestRow } from '../core/models';

/** Re-queues one engine request. Asks for a second click first, because a retry runs the request again. */
@Component({
  selector: 'app-retry-button',
  standalone: true,
  template: `
    @if (state() === 'idle') {
      <button type="button" class="btn small" [disabled]="!enabled" [title]="enabled ? 'Put this request back in the queue' : 'This request cannot be retried'" (click)="state.set('confirm')">Retry</button>
    } @else if (state() === 'confirm') {
      <span class="nowrap">Run request {{ row.id }} again?
        <button type="button" class="btn small primary" (click)="go()">Yes, retry</button>
        <button type="button" class="btn small" (click)="state.set('idle')">Cancel</button>
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
