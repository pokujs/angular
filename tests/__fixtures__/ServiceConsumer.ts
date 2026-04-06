import { Component, inject } from '@angular/core';
import { CounterService } from './CounterService.ts';

/**
 * Standalone component that consumes `CounterService` via `inject()`.
 * Demonstrates how to mock services in tests using the `providers` option.
 */
@Component({
  standalone: true,
  selector: 'app-service-consumer',
  template: `
    <section>
      <h1>Count: {{ service.count() }}</h1>
      <button type="button" (click)="service.increment()">Increment</button>
    </section>
  `,
})
export class ServiceConsumer {
  protected readonly service = inject(CounterService);
}
