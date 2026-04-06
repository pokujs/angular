import { afterEach, assert, test } from 'poku';
import { ToggleHarness } from './__fixtures__/ToggleHarness.ts';
import { cleanup, fireEvent, render, renderHook, screen } from '../src/index.ts';
import { useToggle } from './helpers/use-toggle.ts';

afterEach(cleanup);

await test('tests signal composables through a component harness and renderHook', async () => {
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

await test('tests signal hook logic directly with renderHook', () => {
  const { result } = renderHook(
    ({ initial }: { initial: boolean }) => useToggle(initial),
    { initialProps: { initial: true } }
  );

  assert.strictEqual(result.current.enabled(), true);

  result.current.toggle();

  // Signal values update immediately when mutated through the returned ref.
  assert.strictEqual(result.current.enabled(), false);
});
