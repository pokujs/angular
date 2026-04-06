import { InjectionToken } from '@angular/core';

/**
 * InjectionToken that carries the active theme name.
 * Mirrors Vue's `Symbol.for('poku.theme')` provide/inject pattern.
 *
 * Default value is `'light'`; tests override it via the `providers` array:
 * ```ts
 * render(ThemeConsumer, {
 *   providers: [{ provide: THEME_TOKEN, useValue: 'dark' }],
 * });
 * ```
 */
export const THEME_TOKEN = new InjectionToken<string>('poku.theme', {
  providedIn: null,
  factory: () => 'light',
});
