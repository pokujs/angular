import type { BoundFunctions, Screen } from '@testing-library/dom';
import type { ComponentFixture } from '@angular/core/testing';
import type { EnvironmentProviders, Provider, Type } from '@angular/core';
import { getQueriesForElement, queries } from '@testing-library/dom';
import * as domTestingLibrary from '@testing-library/dom';
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import {
  createRenderMetricsEmitter,
  createScreen,
  getNow,
  wrapFireEventMethods,
} from '@pokujs/dom';
import { parseRuntimeOptions } from './runtime-options.ts';

const runtimeOptions = parseRuntimeOptions();
const metrics = createRenderMetricsEmitter({
  runtimeOptions,
  metricsStateKey: Symbol.for('@pokujs/angular.metrics-runtime-state'),
  metricsBatchMessageType: 'POKU_ANGULAR_RENDER_METRIC_BATCH',
});

// Track all live fixtures so cleanup() and fireEvent can operate on them.
const mountedFixtures = new Set<ComponentFixture<unknown>>();

// ---------------------------------------------------------------------------
// Signal-input detection + application
//
// Angular's JIT compiler does not register signal inputs (input() / input.required())
// in ɵcmp.inputs because it lacks the source-level analysis that Angular AOT performs.
// ComponentRef.setInput() therefore silently fails (NG0303) in this environment.
//
// We work around this by directly applying values to the underlying ReactiveNode
// via the same `applyValueToInputSignal` function that Angular's own change detection
// uses internally.  The detection key is `applyValueToInputSignal` existing on the
// node's prototype, which is unique to InputSignalNode (not present on WritableSignal).
// ---------------------------------------------------------------------------

const SIGNAL_SYMBOL_STR = 'Symbol(SIGNAL)';

const getSignalNode = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'function') return null;
  const sym = Object.getOwnPropertySymbols(value).find(
    (s) => s.toString() === SIGNAL_SYMBOL_STR
  );
  return sym ? (value as Record<symbol, unknown>)[sym] as Record<string, unknown> : null;
};

const applyInputValue = (
  instance: Record<string, unknown>,
  key: string,
  value: unknown
): void => {
  const node = getSignalNode(instance[key]);
  if (!node) return;

  // InputSignalNode has `applyValueToInputSignal`; WritableSignalNode does not.
  const applyFn = node['applyValueToInputSignal'] as
    | ((n: Record<string, unknown>, v: unknown) => void)
    | undefined;

  if (typeof applyFn === 'function') {
    applyFn(node, value);
  }
};

const applyInputs = (
  fixture: ComponentFixture<unknown>,
  inputs: Record<string, unknown>
): void => {
  const instance = fixture.componentInstance as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(inputs)) {
    applyInputValue(instance, key, value);
  }
};

// ---------------------------------------------------------------------------
// Flush Angular change detection across all live fixtures.
// Called automatically after every fireEvent so signal-driven template
// updates reach the DOM without requiring explicit detectChanges() calls.
// ---------------------------------------------------------------------------
const flushAllFixtures = async () => {
  await Promise.resolve();
  for (const fixture of mountedFixtures) {
    try {
      fixture.detectChanges();
    } catch {
      // Fixture may have been destroyed between the event and the flush.
    }
  }
  await Promise.resolve();
};

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export type RenderOptions<T = unknown> = {
  /** Additional Angular providers for the test module. */
  providers?: Array<Provider | EnvironmentProviders>;
  /**
   * Additional standalone components, directives, pipes, or NgModules to
   * import into the test module (e.g. shared modules).
   */
  imports?: Array<Type<unknown>>;
  /**
   * Initial values for the component's signal inputs (`input()` / `input.required()`).
   * Applied before the first change-detection cycle so required inputs are satisfied.
   */
  inputs?: Record<string, unknown>;
  /**
   * Set to `false` to skip the automatic `detectChanges()` + `whenStable()`
   * call after mounting — useful when you need manual control before first render.
   */
  detectChanges?: boolean;
};

export type RenderResult<T = unknown> = BoundFunctions<typeof queries> & {
  /** The component's host element, appended to `document.body`. */
  container: HTMLElement;
  /** Always `document.body`; Testing Library queries are scoped here. */
  baseElement: HTMLElement;
  /** The underlying Angular `ComponentFixture` for framework-level assertions. */
  fixture: ComponentFixture<T>;
  /**
   * Trigger a synchronous change-detection cycle and wait for any pending
   * async work (e.g. resolved promises inside `ngOnInit`).
   */
  detectChanges: () => Promise<void>;
  /** Destroy the component and remove it from the DOM. */
  unmount: () => void;
  /**
   * Apply new signal-input values, trigger change detection, and wait for
   * stability — equivalent to a parent updating bound `@Input()` values.
   */
  rerender: (inputs?: Record<string, unknown>) => Promise<void>;
};

export type RenderHookOptions<Props = unknown> = {
  initialProps?: Props;
  providers?: Array<Provider | EnvironmentProviders>;
};

export type RenderHookResult<Result, Props = unknown> = {
  readonly result: {
    readonly current: Result;
  };
  rerender: (nextProps?: Props) => void;
  unmount: () => void;
};

// ---------------------------------------------------------------------------
// render()
// ---------------------------------------------------------------------------

/**
 * Mount a standalone Angular component into a fresh TestBed module and return
 * a Testing Library query surface together with Angular-specific helpers.
 *
 * Call `afterEach(cleanup)` to reset the TestBed between tests.  Only one
 * component should be actively managed per test.
 *
 * @example
 * ```typescript
 * import { afterEach, assert, test } from 'poku';
 * import { cleanup, fireEvent, render, screen } from '@pokujs/angular';
 * import { CounterButton } from './CounterButton.ts';
 *
 * afterEach(cleanup);
 *
 * test('increments the counter', async () => {
 *   await render(CounterButton, { inputs: { initialCount: 1 } });
 *   await fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
 *   assert.strictEqual(screen.getByRole('heading').textContent, 'Count: 2');
 * });
 * ```
 */
export const render = async <T>(
  component: Type<T>,
  options: RenderOptions<T> = {}
): Promise<RenderResult<T>> => {
  await TestBed.configureTestingModule({
    imports: [component, ...(options.imports ?? [])],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      ...(options.providers ?? []),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(component);
  mountedFixtures.add(fixture as ComponentFixture<unknown>);

  // Apply signal inputs BEFORE the first change-detection cycle so that
  // required inputs (input.required()) are satisfied when renderning begins.
  if (options.inputs) {
    applyInputs(fixture as ComponentFixture<unknown>, options.inputs);
  }

  if (options.detectChanges !== false) {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const componentName = component.name ?? 'AnonymousComponent';
  const startedAt = getNow();
  metrics.emitRenderMetric(componentName, getNow() - startedAt);

  const baseElement = document.body;
  const container = fixture.nativeElement as HTMLElement;

  const detectChanges = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const unmount = () => {
    if (!mountedFixtures.has(fixture as ComponentFixture<unknown>)) return;
    fixture.destroy();
    mountedFixtures.delete(fixture as ComponentFixture<unknown>);
  };

  const rerender = async (inputs?: Record<string, unknown>) => {
    if (inputs) {
      applyInputs(fixture as ComponentFixture<unknown>, inputs);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  };

  return {
    ...getQueriesForElement(baseElement),
    container,
    baseElement,
    fixture,
    detectChanges,
    unmount,
    rerender,
  };
};

// ---------------------------------------------------------------------------
// renderHook()
// ---------------------------------------------------------------------------

/**
 * Run a factory function inside Angular's injection context so it can call
 * `inject()` and use signals.  Mirrors the React/Vue `renderHook` API.
 *
 * @example
 * ```typescript
 * import { inject } from '@angular/core';
 * import { renderHook, cleanup } from '@pokujs/angular';
 * import { CounterService } from './CounterService.ts';
 *
 * afterEach(cleanup);
 *
 * test('service increments its signal counter', () => {
 *   const { result } = renderHook(() => inject(CounterService));
 *   assert.strictEqual(result.current.count(), 0);
 *   result.current.increment();
 *   assert.strictEqual(result.current.count(), 1);
 * });
 * ```
 */
export const renderHook = <Result, Props = Record<string, unknown>>(
  hookFn: (props: Props) => Result,
  options: RenderHookOptions<Props> = {}
): RenderHookResult<Result, Props> => {
  TestBed.configureTestingModule({
    providers: [
      provideExperimentalZonelessChangeDetection(),
      ...(options.providers ?? []),
    ],
  });

  const initialProps = (options.initialProps ?? {}) as Props;
  let currentProps = initialProps;
  let currentResult: Result = TestBed.runInInjectionContext(() =>
    hookFn(currentProps)
  );

  return {
    get result() {
      return { current: currentResult };
    },
    rerender(nextProps = currentProps) {
      currentProps = nextProps;
      currentResult = TestBed.runInInjectionContext(() => hookFn(currentProps));
    },
    unmount() {
      TestBed.resetTestingModule();
    },
  };
};

// ---------------------------------------------------------------------------
// cleanup()
// ---------------------------------------------------------------------------

/**
 * Destroy all mounted fixtures, reset the TestBed module, and flush any
 * buffered render metrics.  Call this in `afterEach` to keep tests isolated.
 */
export const cleanup = async () => {
  for (const fixture of [...mountedFixtures]) {
    try {
      fixture.destroy();
    } catch {
      // Ignore errors from already-destroyed fixtures.
    }
  }
  mountedFixtures.clear();
  TestBed.resetTestingModule();
  metrics.flushMetricBuffer();
};

// ---------------------------------------------------------------------------
// screen  (lazy proxy — safe across test isolation boundaries)
// ---------------------------------------------------------------------------

export const screen = createScreen() as Screen;

// ---------------------------------------------------------------------------
// fireEvent  (async wrapper — triggers Angular CD after each event)
// ---------------------------------------------------------------------------

const baseFireEventInstance = domTestingLibrary.fireEvent;

type AsyncifyFunction<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Promise<Awaited<Result>>
  : T;

type AsyncFireEvent = AsyncifyFunction<typeof domTestingLibrary.fireEvent> & {
  [Key in keyof typeof baseFireEventInstance]: AsyncifyFunction<
    (typeof baseFireEventInstance)[Key]
  >;
};

const wrappedFireEvent: AsyncFireEvent = (async (
  ...args: Parameters<typeof baseFireEventInstance>
) => {
  const result = baseFireEventInstance(...args);
  await flushAllFixtures();
  return result;
}) as AsyncFireEvent;

wrapFireEventMethods(
  wrappedFireEvent as unknown as Record<string, unknown>,
  baseFireEventInstance as unknown as Record<string, unknown>,
  async (invoke) => {
    const result = invoke();
    await flushAllFixtures();
    return result;
  }
);

export const fireEvent = wrappedFireEvent;

