import { Component, OnInit, signal } from '@angular/core';

/**
 * Component that loads asynchronously in `ngOnInit` and exposes a two-phase
 * pipeline trigger, closely mirroring the Vue AsyncPipeline fixture.
 *
 * Testing guidance:
 * - After `render()`, call `await view.detectChanges()` to flush the microtask
 *   from `ngOnInit` and propagate the `loaded` signal change to the DOM.
 * - After `fireEvent.click(...)`, call `await view.detectChanges()` again to
 *   flush the deferred `deferredState` update.
 */
@Component({
  standalone: true,
  selector: 'app-async-pipeline',
  template: `
    @if (loaded()) {
      <h2>Loaded from async setup</h2>
    }
    <button type="button" (click)="runPipeline()">Run pipeline</button>
    <output aria-label="urgent-state">{{ urgentState() }}</output>
    <output aria-label="deferred-state">{{ deferredState() }}</output>
  `,
})
export class AsyncPipeline implements OnInit {
  protected readonly loaded = signal(false);
  protected readonly urgentState = signal('idle');
  protected readonly deferredState = signal('idle');

  async ngOnInit() {
    // Simulate an async data-fetch / route resolver pattern.
    await Promise.resolve();
    this.loaded.set(true);
  }

  async runPipeline() {
    // Urgent update — synchronous signal write.
    this.urgentState.set('urgent-updated');
    // Deferred update — queued as a microtask, just like Vue's queue.
    await Promise.resolve();
    this.deferredState.set('queued-updated');
  }
}
