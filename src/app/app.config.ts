import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { sessionInterceptor } from './core/session.interceptor';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Hash routing: the WAR serves index.html only, so deep links need no server-side forwarding.
    provideRouter(routes, withHashLocation()),
    // Angular reads the XSRF-TOKEN cookie and sends X-XSRF-TOKEN on POSTs by itself.
    provideHttpClient(withInterceptors([sessionInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService],
      useFactory: (auth: AuthService) => () => auth.load()
    }
  ]
};
