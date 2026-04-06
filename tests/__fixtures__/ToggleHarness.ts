import { Component, signal } from '@angular/core';

/**
 * Harness component that exposes a boolean toggle backed by a signal.
 * Used to test signal state through a component or via `renderHook`.
 */
@Component({
  standalone: true,
  selector: 'app-toggle-harness',
  template: `
    <div>
      <output aria-label="toggle-state">{{ enabled() ? 'enabled' : 'disabled' }}</output>
      <button type="button" (click)="toggle()">Toggle</button>
    </div>
  `,
})
export class ToggleHarness {
  private readonly _enabled = signal(false);
  readonly enabled = this._enabled.asReadonly();

  toggle() {
    this._enabled.update((v) => !v);
  }
}
