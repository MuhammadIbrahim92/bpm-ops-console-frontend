import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Angular 21 is zoneless by default; this app keeps zone.js until its components are reviewed for zoneless.
    provideZoneChangeDetection({ eventCoalescing: true }),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
    // Hash routing: the WAR serves index.html only, so deep links need no server-side forwarding.
    provideRouter(routes, withHashLocation()),
    // The interceptor adds the JWT as a Bearer header; no cookies are involved.
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService],
      useFactory: (auth: AuthService) => () => auth.load()
    }
  ]
};
