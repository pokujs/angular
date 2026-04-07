import type { BoundFunctions, Screen } from "@testing-library/dom";
import type {
  ApplicationRef,
  ChangeDetectorRef,
  ComponentRef,
  DebugElement,
  ElementRef,
  EnvironmentInjector,
  Provider,
  Type,
} from "@angular/core";
import type { EnvironmentProviders } from "@angular/core";
import { getQueriesForElement, queries } from "@testing-library/dom";
import * as domTestingLibrary from "@testing-library/dom";
import * as pokuDom from "@pokujs/dom";
import {
  VERSION,
  createComponent,
  createEnvironmentInjector,
  getDebugNode,
  importProvidersFrom,
  runInInjectionContext,
} from "@angular/core";
import {
  createRenderMetricsEmitter,
  createScreen,
  getNow,
  wrapFireEventMethods,
} from "@pokujs/dom";
import { createApplication } from "@angular/platform-browser";
import { parseRuntimeOptions } from "./runtime-options.ts";
import { provideCompatibleZonelessChangeDetection } from "./zoneless-change-detection.ts";

const runtimeOptions = parseRuntimeOptions();
const metrics = createRenderMetricsEmitter({
  runtimeOptions,
  metricsStateKey: Symbol.for("@pokujs/angular.metrics-runtime-state"),
  metricsBatchMessageType: "POKU_ANGULAR_RENDER_METRIC_BATCH",
});

type ScopeSlot<T> = {
  readonly value: T;
};

type ScopeLike = {
  getOrCreateSlot<T>(key: symbol, init: () => T): ScopeSlot<T>;
  getSlot?<T>(key: symbol): ScopeSlot<T> | undefined;
  addCleanup?(fn: () => void | Promise<void>): void;
};

type DomScopeApi = {
  defineSlotKey?: <T>(name: string) => symbol;
  getOrCreateScope?: () => ScopeLike | undefined;
  getCurrentScope?: () => ScopeLike | undefined;
};

type MountedHandle = {
  destroy(): void;
  detectChanges?(): Promise<void>;
};

type RenderMountedHandle = MountedHandle & {
  detectChanges(): Promise<void>;
};

type RenderHookExecution<Result> = {
  injector: EnvironmentInjector;
  result: Result;
  destroyed: boolean;
};

type ScopedRuntimeState = {
  mountedHandles: Set<MountedHandle>;
  cleanupRegistered: boolean;
};

export type AngularFixture<T> = {
  componentRef: ComponentRef<T>;
  componentInstance: T;
  nativeElement: HTMLElement;
  elementRef: ElementRef;
  changeDetectorRef: ChangeDetectorRef;
  debugElement: DebugElement | null;
  detectChanges(checkNoChanges?: boolean): void;
  checkNoChanges(): void;
  isStable(): boolean;
  whenStable(): Promise<void>;
  whenRenderingDone(): Promise<void>;
  destroy(): void;
};

type RenderFixture<T> = AngularFixture<T>;

const domScopeApi = pokuDom as unknown as DomScopeApi;

const RUNTIME_STATE_SLOT_KEY =
  typeof domScopeApi.defineSlotKey === "function"
    ? domScopeApi.defineSlotKey<ScopedRuntimeState>(
        "@pokujs/angular.runtime-state",
      )
    : undefined;

const fallbackMountedHandles = new Set<MountedHandle>();

const supportedAngularMajorRange = {
  min: 18,
  max: 21,
} as const;

const currentAngularMajor = Number.parseInt(VERSION.major, 10);

const canUseSignalInputFallback =
  Number.isFinite(currentAngularMajor) &&
  currentAngularMajor >= supportedAngularMajorRange.min &&
  currentAngularMajor <= supportedAngularMajorRange.max;

const throwCollectedErrors = (errors: unknown[], message: string) => {
  if (errors.length === 0) return;
  if (errors.length === 1) {
    throw errors[0];
  }

  throw new AggregateError(errors, message);
};

const runCleanupSteps = (steps: Array<() => void>, errorMessage: string) => {
  const errors: unknown[] = [];

  for (const step of steps) {
    try {
      step();
    } catch (error) {
      errors.push(error);
    }
  }

  throwCollectedErrors(errors, errorMessage);
};

const destroyMountedHandles = (mountedHandles: Set<MountedHandle>) => {
  const errors: unknown[] = [];

  for (const handle of [...mountedHandles]) {
    try {
      handle.destroy();
    } catch (error) {
      errors.push(error);
    }
  }

  throwCollectedErrors(
    errors,
    "@pokujs/angular: cleanup failed while destroying mounted handles.",
  );
};

const getScopedRuntimeState = (): ScopedRuntimeState | undefined => {
  if (!RUNTIME_STATE_SLOT_KEY) return undefined;
  if (typeof domScopeApi.getOrCreateScope !== "function") return undefined;

  const scope = domScopeApi.getOrCreateScope();
  if (!scope) return undefined;

  const state = scope.getOrCreateSlot(RUNTIME_STATE_SLOT_KEY, () => ({
    mountedHandles: new Set<MountedHandle>(),
    cleanupRegistered: false,
  })).value;

  if (!state.cleanupRegistered && typeof scope.addCleanup === "function") {
    state.cleanupRegistered = true;
    scope.addCleanup(() => {
      try {
        destroyMountedHandles(state.mountedHandles);
      } finally {
        metrics.flushMetricBuffer();
      }
    });
  }

  return state;
};

const getCurrentScopedRuntimeState = (): ScopedRuntimeState | undefined => {
  if (!RUNTIME_STATE_SLOT_KEY) return undefined;
  if (typeof domScopeApi.getCurrentScope !== "function") return undefined;

  const scope = domScopeApi.getCurrentScope();
  const slot = scope?.getSlot?.<ScopedRuntimeState>(RUNTIME_STATE_SLOT_KEY);
  return slot?.value;
};

const getMountedHandles = (): Set<MountedHandle> =>
  getScopedRuntimeState()?.mountedHandles ?? fallbackMountedHandles;

const getCurrentMountedHandles = (): Set<MountedHandle> =>
  getCurrentScopedRuntimeState()?.mountedHandles ?? fallbackMountedHandles;

/**
 * Attempt to set an Angular signal input directly via the signal node's own
 * internal setter.  This is required in JIT-compiled test environments where
 * Angular's JIT compiler does not register signal inputs (`input()`) in the
 * component def's `inputs` map, causing `ComponentRef.setInput()` to log
 * NG0303 and return without updating the signal.
 *
 * Detection: locate the canonical `'SIGNAL'` symbol on the instance property
 * via `Symbol.prototype.description` (ES2019+) and verify the node exposes
 * `applyValueToInputSignal`.  The `'SIGNAL'` description is Angular's
 * foundational reactive primitive — the same one that drives every template
 * binding — so it is maximally stable.
 *
 * Returns `true` if the value was applied, `false` if the property is not a
 * recognised signal input (caller should fall back to `ComponentRef.setInput`).
 */
const trySetSignalInput = (
  instance: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean => {
  if (!canUseSignalInputFallback) return false;

  const prop = instance[key];
  if (typeof prop !== "function") return false;

  const signalSym = Object.getOwnPropertySymbols(prop).find(
    (s) => s.description === "SIGNAL",
  );
  if (!signalSym) return false;

  const node = (prop as unknown as Record<symbol, unknown>)[
    signalSym
  ] as Record<string, unknown>;
  if (node === null || typeof node !== "object") return false;

  const applyFn = node["applyValueToInputSignal"];
  if (typeof applyFn !== "function") return false;

  (applyFn as (n: unknown, v: unknown) => void)(node, value);
  return true;
};

const applyInputs = (
  componentRef: ComponentRef<unknown>,
  inputs: Record<string, unknown>,
): void => {
  const instance = componentRef.instance as Record<string, unknown>;
  for (const [key, value] of Object.entries(inputs)) {
    // Probe for a signal input first.  In JIT mode, `ComponentRef.setInput()`
    // silently no-ops for `input()` signal properties (logging NG0303 to the
    // console) because the JIT compiler does not add them to the component
    // def's inputs map.  The signal-node path bypasses that limitation while
    // the public API handles all traditional `@Input()` decorators.
    if (!trySetSignalInput(instance, key, value)) {
      componentRef.setInput(key, value);
    }
  }
};

const buildEnvironmentProviders = (
  optionsProviders: Array<Provider | EnvironmentProviders> | undefined,
  imports: Array<Type<unknown>> | undefined,
): Array<Provider | EnvironmentProviders> => {
  const providers: Array<Provider | EnvironmentProviders> = [
    provideCompatibleZonelessChangeDetection(),
  ];

  if (imports && imports.length > 0) {
    providers.push(importProvidersFrom(...imports));
  }

  if (optionsProviders && optionsProviders.length > 0) {
    providers.push(...optionsProviders);
  }

  return providers;
};

const createIsolatedApplication = async (
  optionsProviders?: Array<Provider | EnvironmentProviders>,
  imports?: Array<Type<unknown>>,
) =>
  await createApplication({
    providers: buildEnvironmentProviders(optionsProviders, imports),
  });

const waitForFixtureStability = async (fixture: RenderFixture<unknown>) => {
  await fixture.whenStable();
};

const createFixture = <T>(
  componentRef: ComponentRef<T>,
  applicationRef: ApplicationRef,
  onDestroy: () => void,
): RenderFixture<T> => {
  let destroyed = false;
  let stable = false;

  const stabilitySubscription = applicationRef.isStable.subscribe((isStable) => {
    stable = isStable;
  });

  const waitForStability = async () => {
    await applicationRef.whenStable();
    await Promise.resolve();
  };

  return {
    componentRef,
    componentInstance: componentRef.instance,
    nativeElement: componentRef.location.nativeElement as HTMLElement,
    elementRef: componentRef.location,
    changeDetectorRef: componentRef.changeDetectorRef,
    get debugElement() {
      return (
        (getDebugNode(
          componentRef.location.nativeElement,
        ) as DebugElement | null) ?? null
      );
    },
    detectChanges(checkNoChanges = false) {
      componentRef.changeDetectorRef.detectChanges();
      if (checkNoChanges) {
        componentRef.changeDetectorRef.checkNoChanges();
      }
    },
    checkNoChanges() {
      componentRef.changeDetectorRef.checkNoChanges();
    },
    isStable() {
      return !destroyed && stable;
    },
    whenStable() {
      return waitForStability();
    },
    whenRenderingDone() {
      return waitForStability();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stabilitySubscription.unsubscribe();
      onDestroy();
    },
  };
};

const flushAllFixtures = async () => {
  await Promise.resolve();
  const mountedHandles = [...getCurrentMountedHandles()];

  for (const handle of mountedHandles) {
    try {
      await handle.detectChanges?.();
    } catch (error) {
      if (!getCurrentMountedHandles().has(handle)) {
        continue;
      }

      throw error;
    }
  }
  await Promise.resolve();
};

const createRenderHookExecution = <Result, Props>(
  runtimeApplication: ApplicationRef,
  hookFn: (props: Props) => Result,
  props: Props,
): RenderHookExecution<Result> => {
  const injector = createEnvironmentInjector(
    [],
    runtimeApplication.injector,
    "@pokujs/angular.renderHook",
  );

  try {
    return {
      injector,
      result: runInInjectionContext(injector, () => hookFn(props)),
      destroyed: false,
    };
  } catch (error) {
    injector.destroy();
    throw error;
  }
};

const destroyRenderHookExecution = (execution: RenderHookExecution<unknown>) => {
  if (execution.destroyed) return;

  try {
    execution.injector.destroy();
  } finally {
    execution.destroyed = true;
  }
};

export type RenderOptions = {
  providers?: Array<Provider | EnvironmentProviders>;
  imports?: Array<Type<unknown>>;
  inputs?: Record<string, unknown>;
  detectChanges?: boolean;
};

export type RenderResult<T = unknown> = BoundFunctions<typeof queries> & {
  container: HTMLElement;
  baseElement: HTMLElement;
  fixture: AngularFixture<T>;
  detectChanges: () => Promise<void>;
  unmount: () => void;
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

export const render = async <T>(
  component: Type<T>,
  options: RenderOptions = {},
): Promise<RenderResult<T>> => {
  const startedAt = getNow();
  const runtimeApplication = await createIsolatedApplication(
    options.providers,
    options.imports,
  );
  const mountedHandles = getMountedHandles();

  const baseElement = document.body;
  const container = document.createElement("div");
  baseElement.appendChild(container);

  const componentRef = createComponent(component, {
    environmentInjector: runtimeApplication.injector,
    hostElement: container,
  });
  runtimeApplication.attachView(componentRef.hostView);

  const teardown = () => {
    runCleanupSteps(
      [
        () => {
          if (!runtimeApplication.destroyed && !componentRef.hostView.destroyed) {
            runtimeApplication.detachView(componentRef.hostView);
          }
        },
        () => {
          if (!componentRef.hostView.destroyed) {
            componentRef.destroy();
          }
        },
        () => {
          if (!runtimeApplication.destroyed) {
            runtimeApplication.destroy();
          }
        },
        () => {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        },
      ],
      "@pokujs/angular: cleanup failed while destroying a rendered component.",
    );
  };

  const fixture = createFixture(componentRef, runtimeApplication, teardown);

  const handle: RenderMountedHandle = {
    destroy() {
      if (!mountedHandles.has(handle)) return;
      try {
        fixture.destroy();
      } finally {
        mountedHandles.delete(handle);
      }
    },
    async detectChanges() {
      fixture.detectChanges();
      await waitForFixtureStability(fixture as RenderFixture<unknown>);
    },
  };

  mountedHandles.add(handle);

  if (options.inputs) {
    applyInputs(componentRef as ComponentRef<unknown>, options.inputs);
  }

  if (options.detectChanges !== false) {
    await handle.detectChanges();
  }

  const componentName = component.name ?? "AnonymousComponent";
  metrics.emitRenderMetric(componentName, getNow() - startedAt);

  const detectChanges = async () => {
    await handle.detectChanges();
  };

  const unmount = () => {
    handle.destroy();
  };

  const rerender = async (inputs?: Record<string, unknown>) => {
    if (inputs) {
      applyInputs(componentRef as ComponentRef<unknown>, inputs);
    }
    await handle.detectChanges();
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

export const renderHook = async <Result, Props = Record<string, unknown>>(
  hookFn: (props: Props) => Result,
  options: RenderHookOptions<Props> = {},
): Promise<RenderHookResult<Result, Props>> => {
  const runtimeApplication = await createIsolatedApplication(options.providers);
  const mountedHandles = getMountedHandles();

  const initialProps = (options.initialProps ?? {}) as Props;
  let currentProps = initialProps;
  let currentExecution = createRenderHookExecution(
    runtimeApplication,
    hookFn,
    currentProps,
  );
  let currentResult = currentExecution.result;
  let unmounted = false;

  // A stable container whose `current` property always reflects the latest
  // result.  Destructuring `const { result } = await renderHook(...)` must
  // still see updated values after `rerender()` — using a live getter here
  // ensures that `result.current` is not a stale snapshot.
  const resultRef: { current: Result } = {
    get current() {
      return currentResult;
    },
  } as { current: Result };

  const handle: MountedHandle = {
    destroy() {
      if (!mountedHandles.has(handle)) return;
      unmounted = true;

      try {
        runCleanupSteps(
          [
            () => {
              destroyRenderHookExecution(
                currentExecution as RenderHookExecution<unknown>,
              );
            },
            () => {
              runtimeApplication.destroy();
            },
          ],
          "@pokujs/angular: cleanup failed while destroying a rendered hook.",
        );
      } finally {
        mountedHandles.delete(handle);
      }
    },
  };

  mountedHandles.add(handle);

  return {
    get result() {
      return resultRef;
    },
    rerender(nextProps = currentProps) {
      if (unmounted) {
        throw new Error(
          "@pokujs/angular: cannot call rerender() after the hook has been unmounted.",
        );
      }
      const nextExecution = createRenderHookExecution(
        runtimeApplication,
        hookFn,
        nextProps,
      );

      try {
        destroyRenderHookExecution(
          currentExecution as RenderHookExecution<unknown>,
        );
      } catch (destroyError) {
        try {
          destroyRenderHookExecution(
            nextExecution as RenderHookExecution<unknown>,
          );
        } catch (rollbackError) {
          throwCollectedErrors(
            [destroyError, rollbackError],
            "@pokujs/angular: renderHook rerender failed while rolling back the previous hook execution.",
          );
        }

        throw destroyError;
      }

      currentProps = nextProps;
      currentExecution = nextExecution;
      currentResult = nextExecution.result;
    },
    unmount() {
      handle.destroy();
    },
  };
};

export const cleanup = async () => {
  try {
    destroyMountedHandles(getCurrentMountedHandles());
  } finally {
    metrics.flushMetricBuffer();
  }
};

export const screen = createScreen() as Screen;

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
  },
);

export const fireEvent = wrappedFireEvent;
