import { Component, input } from '@angular/core';

/**
 * Simple card component with a required signal input.
 * Used to verify that `rerender({ name: '...' })` propagates new values.
 */
@Component({
  standalone: true,
  selector: 'app-greeting-card',
  template: `<h3>Hello {{ name() }}</h3>`,
})
export class GreetingCard {
  readonly name = input.required<string>();
}
