import { DestroyRef, inject } from '@angular/core';
import { afterEach, assert, test } from 'poku';
import { ToggleHarness } from './__fixtures__/ToggleHarness.ts';
import { cleanup, fireEvent, render, renderHook, screen } from '../src/index.ts';
import { useToggle } from './helpers/use-toggle.ts';

afterEach(cleanup);

test('tests signal composables through a component harness and renderHook', async () => {
  await render(ToggleHarness);

  assert.strictEqual(
    screen.getByLabelText('toggle-state').textContent,
    'disabled'
  );

  await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

  assert.strictEqual(
    screen.getByLabelText('toggle-state').textContent,
    'enabled'
  );
});

test('tests signal hook logic directly with renderHook', async () => {
  const { result } = await renderHook(
    ({ initial }: { initial: boolean }) => useToggle(initial),
    { initialProps: { initial: true } }
  );

  assert.strictEqual(result.current.enabled(), true);

  result.current.toggle();

  // Signal values update immediately when mutated through the returned ref.
  assert.strictEqual(result.current.enabled(), false);
});

test('renderHook.rerender re-evaluates the hook with updated props', async () => {
  const { result, rerender } = await renderHook(
    ({ initial }: { initial: boolean }) => useToggle(initial),
    { initialProps: { initial: false } }
  );

  assert.strictEqual(result.current.enabled(), false);

  // rerender creates a fresh hook invocation with the new props.
  rerender({ initial: true });

  assert.strictEqual(result.current.enabled(), true);
});

test('renderHook.rerender after unmount throws a descriptive error', async () => {
  const { rerender, unmount } = await renderHook(
    ({ initial }: { initial: boolean }) => useToggle(initial),
    { initialProps: { initial: false } }
  );

  unmount();

  assert.throws(
    () => rerender({ initial: true }),
    /cannot call rerender\(\) after the hook has been unmounted/
  );
});

test('renderHook.rerender destroys the previous injection context', async () => {
  const destroyed: string[] = [];

  const { rerender, unmount } = await renderHook(
    ({ label }: { label: string }) => {
      inject(DestroyRef).onDestroy(() => {
        destroyed.push(label);
      });

      return label;
    },
    { initialProps: { label: 'first' } }
  );

  assert.deepStrictEqual(destroyed, []);

  rerender({ label: 'second' });
  assert.deepStrictEqual(destroyed, ['first']);

  unmount();
  assert.deepStrictEqual(destroyed, ['first', 'second']);
});

test('renderHook.rerender rolls back the next execution if previous cleanup fails', async () => {
  const destroyed: string[] = [];
  let shouldThrowOnFirstDestroy = true;

  const { result, rerender } = await renderHook(
    ({ label }: { label: string }) => {
      inject(DestroyRef).onDestroy(() => {
        destroyed.push(label);

        if (label === 'first' && shouldThrowOnFirstDestroy) {
          shouldThrowOnFirstDestroy = false;
          throw new Error('first destroy failure');
        }
      });

      return label;
    },
    { initialProps: { label: 'first' } }
  );

  assert.strictEqual(result.current, 'first');

  assert.throws(
    () => rerender({ label: 'second' }),
    /first destroy failure/
  );

  assert.deepStrictEqual(destroyed, ['first', 'second']);
  assert.strictEqual(result.current, 'first');
});
