import { afterEach, assert, test } from 'poku';
import { inject } from '@angular/core';
import { ServiceConsumer } from './__fixtures__/ServiceConsumer.ts';
import { CounterService } from './__fixtures__/CounterService.ts';
import { cleanup, fireEvent, render, renderHook, screen } from '../src/index.ts';

afterEach(cleanup);

await test('component renders service state and interactions update the DOM', async () => {
  await render(ServiceConsumer);

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 0' }).textContent,
    'Count: 0'
  );

  await fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 1' }).textContent,
    'Count: 1'
  );
});

await test('mocks injectable service via useValue provider override', async () => {
  let incrementCalled = false;
  const mockService = {
    count: (() => {
      let v = 42;
      const s = () => v;
      return s;
    })(),
    increment: () => {
      incrementCalled = true;
    },
    reset: () => {},
  };

  await render(ServiceConsumer, {
    providers: [{ provide: CounterService, useValue: mockService }],
  });

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 42' }).textContent,
    'Count: 42'
  );

  await fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
  assert.strictEqual(incrementCalled, true);
});

await test('injects service directly via renderHook and verifies signal state', () => {
  const { result } = renderHook(() => inject(CounterService));

  assert.strictEqual(result.current.count(), 0);

  result.current.increment();
  assert.strictEqual(result.current.count(), 1);

  result.current.reset();
  assert.strictEqual(result.current.count(), 0);
});
