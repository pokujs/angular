import { afterEach, assert, test } from 'poku';
import { AsyncPipeline } from './__fixtures__/AsyncPipeline.ts';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';

afterEach(cleanup);

await test('handles async ngOnInit updates and queued signal transitions', async () => {
  const view = await render(AsyncPipeline);

  // The first detectChanges() in render() runs before the ngOnInit microtask
  // resolves.  A second cycle flushes it and marks the view dirty again.
  await view.detectChanges();

  assert.strictEqual(
    screen.getByRole('heading', {
      level: 2,
      name: 'Loaded from async setup',
    }).textContent,
    'Loaded from async setup'
  );

  assert.strictEqual(screen.getByLabelText('urgent-state').textContent, 'idle');
  assert.strictEqual(
    screen.getByLabelText('deferred-state').textContent,
    'idle'
  );

  // Click triggers runPipeline(): urgentState is set synchronously, then
  // deferredState is set after a microtask.
  await fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));

  // Flush the deferred microtask and re-render.
  await view.detectChanges();

  assert.strictEqual(
    screen.getByLabelText('urgent-state').textContent,
    'urgent-updated'
  );
  assert.strictEqual(
    screen.getByLabelText('deferred-state').textContent,
    'queued-updated'
  );
});
