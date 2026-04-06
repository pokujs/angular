import { signal } from '@angular/core';

/**
 * Signal-based toggle composable — the Angular equivalent of Vue's
 * `useToggle` composable.  Uses only `signal()`, so it can be created in any
 * context (no injection-context required).
 */
export const useToggle = (initialValue = false) => {
  const _enabled = signal(initialValue);
  const enabled = _enabled.asReadonly();
  const toggle = () => _enabled.update((v) => !v);
  return { enabled, toggle };
};
