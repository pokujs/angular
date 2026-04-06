import { Component, computed, input, signal } from '@angular/core';

/**
 * Standalone counter component using Angular signal inputs and computed state.
 *
 * The displayed `count` is the initial value plus any increments so that
 * `setInput('initialCount', 1)` followed by one click shows "Count: 2".
 */
@Component({
  standalone: true,
  selector: 'app-counter-button',
  template: `
    <section>
      <h1>Count: {{ count() }}</h1>
      <button type="button" (click)="increment()">Increment</button>
    </section>
  `,
})
export class CounterButton {
  readonly initialCount = input(0);
  private readonly delta = signal(0);
  readonly count = computed(() => this.initialCount() + this.delta());

  increment() {
    this.delta.update((d) => d + 1);
  }
}
