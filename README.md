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
> Render standalone Angular components in isolated test files — automatic TypeScript loader injection, DOM environment setup, isolated Angular runtime applications, and optional render metrics included.

---

## Quickstart

### Install

```bash
npm i -D poku @pokujs/angular
```

This package is intended for Angular workspaces that already depend on Angular.
Supported Angular majors are `18.x`, `19.x`, `20.x`, and `21.x`.

Required Angular peers:

- `@angular/common`
- `@angular/compiler`
- `@angular/core`
- `@angular/platform-browser`
- `@angular/platform-browser-dynamic`
- `@angular/forms` when testing forms APIs

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

---

## Compatibility

### Angular Support

| Angular | Status |
| ------- | :----: |
| `18.x`  |   ✅   |
| `19.x`  |   ✅   |
| `20.x`  |   ✅   |
| `21.x`  |   ✅   |

Signal-input rerender support relies on Angular's current JIT signal internals,
and this package verifies current support through Angular 21.

### Poku And DOM Support

| Package | Supported range |
| ------- | :-------------: |
| `poku` |   `>=4.1.0`    |
| `happy-dom` |    `>=20`     |
| `jsdom` |    `>=22`     |

### Isolation Support

| Isolation mode | Node validation |
| -------------- | :-------------: |
| `none`         |       ✅        |
| `process`      |       ✅        |

Angular cleanup is scope-aware in shared-process runs, so one concurrent test's teardown does not reset sibling fixtures.

### Multi-Major Suite

Use this suite to verify Angular major compatibility locally:

```bash
npm run test:multi-major
```

It executes the full adapter tests four times, pinning Angular 18, 19, 20, and 21 package sets in sequence.

### Runtime × DOM Adapter

|               | Node.js ≥ 20 | Bun ≥ 1 |
| ------------- | :----------: | :-----: |
| **happy-dom** |      ✅      |   ✅    |
| **jsdom**     |      ✅      |   ✅    |

---

## API

### `render(component, options?)`

Mounts a standalone Angular component into an isolated Angular runtime application and returns [Testing Library](https://testing-library.com/docs/dom-testing-library/api-queries) queries together with Angular-specific helpers.

`render()` is designed for standalone components. If your test target still
depends on NgModule-declared components, import the relevant module graph via
`options.imports`.

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
view.fixture;                       // runtime fixture wrapper with componentRef/CD helpers
```

### `renderHook(fn, options?)`

Runs a factory function inside an isolated Angular application injector so it can call `inject()` and use signals.

Each `rerender()` call tears down the previous injector-scoped execution before
promoting the new one, so `DestroyRef` cleanups and injector-bound effects do
not accumulate across renders.

```ts
const { result, rerender, unmount } = await renderHook(
  () => inject(CounterService)
);

result.current.increment();
assert.strictEqual(result.current.count(), 1);
```

### `cleanup()`

Destroys all mounted Angular runtime handles for the current test scope. Call in `afterEach`.

If Angular teardown code throws, `cleanup()` rejects with that failure instead
of hiding it, while still attempting to clean the remaining mounted fixtures.

```ts
afterEach(cleanup);
```

### `screen`

Lazy proxy over `@testing-library/dom`'s `screen` — safe across test isolation boundaries.

### `fireEvent`

Async wrapper around `@testing-library/dom`'s `fireEvent` — automatically triggers Angular change detection after every event.

If the event causes Angular change detection to throw, the returned promise
rejects with the application error.

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
