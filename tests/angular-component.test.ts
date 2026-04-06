import { afterEach, assert, test } from 'poku';
import { CounterButton } from './__fixtures__/CounterButton.ts';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';

afterEach(cleanup);

await test('renders and updates an Angular standalone component', async () => {
  await render(CounterButton, {
    inputs: { initialCount: 1 },
  });

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 1' }).textContent,
    'Count: 1'
  );

  await fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 2' }).textContent,
    'Count: 2'
  );
});

await test('renders component with default signal-input value', async () => {
  await render(CounterButton);

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 0' }).textContent,
    'Count: 0'
  );
});
