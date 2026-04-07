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

await test('injects service directly via renderHook and verifies signal state', async () => {
  const { result } = await renderHook(() => inject(CounterService));

  assert.strictEqual(result.current.count(), 0);

  result.current.increment();
  assert.strictEqual(result.current.count(), 1);

  result.current.reset();
  assert.strictEqual(result.current.count(), 0);
});

await test('concurrent renderHook calls receive independent providedIn:root service instances', async () => {
  // Each renderHook call creates its own isolated application, so
  // providedIn: 'root' services are not shared between them.
  const [first, second] = await Promise.all([
    renderHook(() => inject(CounterService)),
    renderHook(() => inject(CounterService)),
  ]);

  first.result.current.increment();
  first.result.current.increment();

  // Mutation in `first` must not leak into `second`.
  assert.strictEqual(first.result.current.count(), 2);
  assert.strictEqual(second.result.current.count(), 0);

  first.unmount();
  second.unmount();
});
