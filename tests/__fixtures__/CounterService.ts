import { Injectable, signal } from '@angular/core';

/**
 * Simple counter service backed by Angular signals.
 * Registered with `providedIn: 'root'` so it is tree-shakable and injectable
 * without explicit module registration.
 */
@Injectable({ providedIn: 'root' })
export class CounterService {
  readonly count = signal(0);

  increment() {
    this.count.update((c) => c + 1);
  }

  reset() {
    this.count.set(0);
  }
}
