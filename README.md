<div align="center">
<img height="180" alt="Poku's Logo" src="https://raw.githubusercontent.com/wellwelwel/poku/main/.github/assets/readme/poku.svg">

# @pokujs/angular

Enjoying **Poku**? [Give him a star to show your support](https://github.com/wellwelwel/poku) 🌟

---

📘 [**Documentation**](https://github.com/pokujs/angular#readme)

</div>

---

🧪 [**@pokujs/angular**](https://github.com/pokujs/angular) is a **Poku** plugin for Angular component testing with DOM adapters.

> [!TIP]
>
> Render standalone Angular components in isolated test files — automatic TypeScript loader injection, DOM environment setup, Angular TestBed configuration, and optional render metrics included.

---

## Quickstart

### Install

```bash
npm i -D @pokujs/angular
```

Install a DOM adapter (at least one is required):

<table>
<tr>
<td width="300">

```bash
# happy-dom (recommended)
npm i -D happy-dom \
  @happy-dom/global-registrator
```

</td>
<td width="225">

```bash
# jsdom
npm i -D jsdom
```

</td>
</tr>
</table>

### Enable the Plugin

```js
// poku.config.js
import { defineConfig } from 'poku';
import { angularTestingPlugin } from '@pokujs/angular/plugin';

export default defineConfig({
  plugins: [
    angularTestingPlugin({
      dom: 'happy-dom',
    }),
  ],
});
```

### Write Tests

```ts
// tests/counter.test.ts
import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, screen } from '@pokujs/angular';
import { CounterButton } from './CounterButton.ts';

afterEach(cleanup);

await test('increments the counter', async () => {
  await render(CounterButton, { inputs: { initialCount: 1 } });

  assert.strictEqual(
    screen.getByRole('heading').textContent,
    'Count: 1'
  );

  await fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

  assert.strictEqual(
    screen.getByRole('heading').textContent,
    'Count: 2'
  );
});
```

> [!IMPORTANT]
>
> Because Angular's `TestBed` module state is global, use `await test(...)` (not bare `test(...)`) within each test file to ensure tests execute **sequentially**. Concurrent test execution will cause `configureTestingModule()` to reset a sibling test's fixture mid-run.

---

## Compatibility

### Runtime × DOM Adapter

|               | Node.js ≥ 20 | Bun ≥ 1 |
| ------------- | :----------: | :-----: |
| **happy-dom** |      ✅      |   ✅    |
| **jsdom**     |      ✅      |   ✅    |

---

## API

### `render(component, options?)`

Mounts a standalone Angular component into a fresh `TestBed` module and returns [Testing Library](https://testing-library.com/docs/dom-testing-library/api-queries) queries together with Angular-specific helpers.

```ts
const view = await render(MyComponent, {
  /** Signal inputs (input() / input.required()) */
  inputs: { title: 'Hello' },
  /** Additional providers for the test module */
  providers: [{ provide: TOKEN, useValue: 'value' }],
  /** Additional imports (shared modules, pipes, directives) */
  imports: [SharedModule],
  /** Set false to skip the initial detectChanges() cycle */
  detectChanges: true,
});

// Testing Library queries (scoped to document.body)
view.getByRole('heading');

// Angular-specific helpers
await view.detectChanges();         // run a CD cycle
await view.rerender({ title: 'Hi' }); // update inputs
view.unmount();                     // destroy fixture
view.fixture;                       // raw ComponentFixture
```

### `renderHook(fn, options?)`

Runs a factory function inside Angular's injection context so it can call `inject()` and use signals.

```ts
const { result, rerender, unmount } = renderHook(
  () => inject(CounterService)
);

result.current.increment();
assert.strictEqual(result.current.count(), 1);
```

### `cleanup()`

Destroys all mounted fixtures and resets `TestBed`. Call in `afterEach`.

```ts
afterEach(cleanup);
```

### `screen`

Lazy proxy over `@testing-library/dom`'s `screen` — safe across test isolation boundaries.

### `fireEvent`

Async wrapper around `@testing-library/dom`'s `fireEvent` — automatically triggers Angular change detection after every event.

```ts
await fireEvent.click(button);
await fireEvent.input(input, { target: { value: 'hello' } });
```

---

## Options

```ts
angularTestingPlugin({
  /**
   * DOM adapter to use.
   * - 'happy-dom'       — fast, recommended for most tests
   * - 'jsdom'           — broader browser API coverage
   * - { setupModule }   — path to a custom DOM setup module
   */
  dom: 'happy-dom',

  /** Base URL assigned to the DOM environment. */
  domUrl: 'http://localhost:3000/',

  /**
   * Render metrics. Disabled by default.
   * Pass `true` for defaults, or an object for fine-grained control.
   */
  metrics: {
    enabled: true,
    topN: 5,
    minDurationMs: 0,
    reporter(summary) {
      console.log(summary.topSlowest);
    },
  },
});
```

---

## License

[MIT](./LICENSE)
