import { Component, inject } from '@angular/core';
import { THEME_TOKEN } from './ThemeToken.ts';

/**
 * Reads the active theme from Angular's DI tree via `inject()`.
 * Falls back to `'light'` when the token has no provider.
 */
@Component({
  standalone: true,
  selector: 'app-theme-consumer',
  template: `<p>Theme: {{ theme }}</p>`,
})
export class ThemeConsumer {
  protected readonly theme = inject(THEME_TOKEN);
}
