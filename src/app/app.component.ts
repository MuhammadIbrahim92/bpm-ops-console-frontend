import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { LoginComponent } from './shared/login.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoginComponent],
  template: `
    @if (auth.me()) {
      <router-outlet />
    } @else {
      <app-login />
    }
  `
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
