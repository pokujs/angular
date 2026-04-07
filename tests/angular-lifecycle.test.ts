import { afterEach, assert, test } from 'poku';
import { AsyncPipeline } from './__fixtures__/AsyncPipeline.ts';
import { GreetingCard } from './__fixtures__/GreetingCard.ts';
import { UnmountWatcher } from './__fixtures__/UnmountWatcher.ts';
import { CounterButton } from './__fixtures__/CounterButton.ts';
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

await test('fixture.debugElement is non-null after render', async () => {
  const { fixture } = await render(CounterButton);

  // getDebugNode is backed by Angular's live debug map, which is populated
  // after the first change-detection pass triggered by render().
  assert.ok(
    fixture.debugElement !== null,
    'debugElement should be populated after render'
  );
});

await test('render with detectChanges:false defers DOM population until explicit detectChanges', async () => {
  const view = await render(CounterButton, {
    inputs: { initialCount: 7 },
    detectChanges: false,
  });

  // No change detection has run yet — the interpolated text is not in the DOM.
  assert.throws(() =>
    screen.getByRole('heading', { name: 'Count: 7' })
  );

  // Trigger change detection manually.
  await view.detectChanges();

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 7' }).textContent,
    'Count: 7'
  );
});

await test('fixture.isStable reflects Angular application stability', async () => {
  const view = await render(AsyncPipeline, {
    detectChanges: false,
  });

  view.fixture.detectChanges();
  assert.strictEqual(view.fixture.isStable(), false);

  await view.fixture.whenStable();
  assert.strictEqual(view.fixture.isStable(), true);
});
