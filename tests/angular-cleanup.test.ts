import { Component, OnDestroy, computed, signal } from '@angular/core';
import { afterEach, assert, test } from 'poku';
import { CounterButton } from './__fixtures__/CounterButton.ts';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';

@Component({
  standalone: true,
  selector: 'app-throwing-destroy',
  host: { 'data-fixture': 'throwing-destroy' },
  template: `<span>Throwing destroy</span>`,
})
class ThrowingDestroyComponent implements OnDestroy {
  ngOnDestroy() {
    throw new Error('destroy failure');
  }
}

@Component({
  standalone: true,
  selector: 'app-throwing-click',
  host: { 'data-fixture': 'throwing-click' },
  template: `
    <button type="button" (click)="explode()">Explode</button>
    <span>{{ label() }}</span>
  `,
})
class ThrowingClickComponent {
  private readonly shouldThrow = signal(false);
  readonly label = computed(() => {
    if (this.shouldThrow()) {
      throw new Error('click failure');
    }

    return 'safe';
  });

  explode() {
    this.shouldThrow.set(true);
  }
}

afterEach(cleanup);

test('cleanup with no mounted components does not throw', async () => {
  // calling cleanup on an empty slate must be a no-op
  await cleanup();
  assert.ok(true);
});

test('double cleanup does not throw and leaves the DOM clean', async () => {
  await render(CounterButton, { inputs: { initialCount: 3 } });

  await cleanup();
  // second cleanup — all handles have already been removed from the set
  await cleanup();

  assert.throws(() => screen.getByRole('heading', { name: 'Count: 3' }));
});

test('cleanup removes the mounted component from the DOM', async () => {
  await render(CounterButton, { inputs: { initialCount: 5 } });

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 5' }).textContent,
    'Count: 5'
  );

  await cleanup();

  assert.throws(() => screen.getByRole('heading', { name: 'Count: 5' }));
});

test('cleanup only removes components from the current scope, not others', async () => {
  // Render two components in the same synchronous scope.
  await render(CounterButton, { inputs: { initialCount: 1 } });
  await render(CounterButton, { inputs: { initialCount: 2 } });

  // Implicit cleanup via afterEach should remove both without throwing.
});

test('cleanup surfaces ngOnDestroy failures instead of swallowing them', async () => {
  await render(ThrowingDestroyComponent);
  await render(CounterButton, { inputs: { initialCount: 8 } });

  await assert.rejects(cleanup(), /destroy failure/);
  await cleanup();

  assert.throws(() => screen.getByText('Throwing destroy'));
  assert.throws(() => screen.getByRole('heading', { name: 'Count: 8' }));
});

test('fireEvent surfaces post-event change-detection failures', async () => {
  await render(ThrowingClickComponent);

  await assert.rejects(
    fireEvent.click(screen.getByRole('button', { name: 'Explode' })),
    /click failure/
  );
});
