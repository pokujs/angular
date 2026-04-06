import { afterEach, assert, test } from 'poku';
import { GreetingCard } from './__fixtures__/GreetingCard.ts';
import { UnmountWatcher } from './__fixtures__/UnmountWatcher.ts';
import { cleanup, render, screen } from '../src/index.ts';

afterEach(cleanup);

await test('rerender propagates updated signal input to the DOM', async () => {
  const view = await render(GreetingCard, {
    inputs: { name: 'Ada' },
  });

  assert.strictEqual(
    screen.getByRole('heading', { level: 3 }).textContent,
    'Hello Ada'
  );

  await view.rerender({ name: 'Grace' });

  assert.strictEqual(
    screen.getByRole('heading', { level: 3 }).textContent,
    'Hello Grace'
  );
});

await test('unmount fires ngOnDestroy on the component instance', async () => {
  let cleaned = false;

  const view = await render(UnmountWatcher, {
    inputs: {
      onCleanup: () => {
        cleaned = true;
      },
    },
  });

  assert.strictEqual(cleaned, false);
  view.unmount();
  assert.strictEqual(cleaned, true);
});
