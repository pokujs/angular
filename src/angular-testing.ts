import type {
  BoundFunctions,
  PrettyDOMOptions,
  Screen,
} from "@testing-library/dom";
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
import {
  VERSION,
  createComponent,
  createEnvironmentInjector,
  getDebugNode,
  importProvidersFrom,
  runInInjectionContext,
} from "@angular/core";
import {
  createAsFragment,
  createDebug,
  createScopedRegistry,
  createWaitFor,
  createRenderMetricsEmitter,
  createScreen,
  getNow,
  wrapFireEventMethods,
} from "@pokujs/dom";
import { createApplication } from "@angular/platform-browser";
import { parseRuntimeOptions } from "./runtime-options.ts";
import { provideCompatibleZonelessChangeDetection } from "./zoneless-change-detection.ts";

const metrics = createRenderMetricsEmitter({
  runtimeOptions: () => parseRuntimeOptions(),
  metricsStateKey: Symbol.for("@pokujs/angular.metrics-runtime-state"),
  metricsBatchMessageType: "POKU_ANGULAR_RENDER_METRIC_BATCH",
});

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

const registry = createScopedRegistry<MountedHandle>({
  name: "@pokujs/angular.mounted-handles",
  onCleanup: (handles) => {
    try {
      destroyMountedHandles(handles);
    } finally {
      metrics.flushMetricBuffer();
    }
  },
});

const getMountedHandles = (): Set<MountedHandle> => registry.getItems();
const getCurrentMountedHandles = (): Set<MountedHandle> =>
  registry.getScopedItems() ?? registry.fallbackItems;

const SIGNAL_SYMBOL_STR = "Symbol(SIGNAL)";
const INPUT_FLAGS_SIGNAL_BASED = 1;
const ALIAS_OPTION_REGEX = /\balias\s*:\s*['"]([^'"]+)['"]/;
const SIGNAL_FACTORY_PREFIX_REGEX =
  /(?:this\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:[\w$]+\.)?(input|model|output|outputFromObservable)(?:\.required)?\s*(?:<[^>]*>)?\s*\(/g;

type NgDirectiveDefLike = {
  inputs: Record<string, [string, number, unknown]>;
  declaredInputs: Record<string, string>;
  outputs: Record<string, string>;
  dependencies?: (() => unknown[]) | unknown[] | null;
  tView?: unknown;
};

const extractBalancedArgs = (
  source: string,
  openParenAfterIndex: number,
): string => {
  let depth = 1;
  let i = openParenAfterIndex;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  return source.slice(openParenAfterIndex, i);
};

const extractAliasOrName = (
  privateName: string,
  argsSource: string,
): string => {
  const aliasMatch = ALIAS_OPTION_REGEX.exec(argsSource);
  return aliasMatch?.[1] || privateName;
};

const patchDefSignalMetadata = (
  target: Function,
  def: NgDirectiveDefLike,
): void => {
  let inputsMutated = false;
  let outputsMutated = false;

  const ensureMutableInputs = () => {
    if (!inputsMutated) {
      def.inputs = { ...def.inputs };
      def.declaredInputs = { ...def.declaredInputs };
      inputsMutated = true;
    }
  };

  const ensureMutableOutputs = () => {
    if (!outputsMutated) {
      def.outputs = { ...def.outputs };
      outputsMutated = true;
    }
  };

  for (
    let ctor: unknown = target;
    typeof ctor === "function" && ctor !== Function.prototype;
    ctor = Object.getPrototypeOf(ctor)
  ) {
    const source = Function.prototype.toString.call(ctor);

    for (const match of source.matchAll(SIGNAL_FACTORY_PREFIX_REGEX)) {
      const privateName = match[1];
      const kind = match[2];
      if (!privateName || !kind) continue;

      const argsStart = (match.index ?? 0) + match[0].length;
      const argsSource = extractBalancedArgs(source, argsStart);
      const publicName = extractAliasOrName(privateName, argsSource);

      if (kind === "input") {
        if (!Object.prototype.hasOwnProperty.call(def.inputs, publicName)) {
          ensureMutableInputs();
          def.inputs[publicName] = [
            privateName,
            INPUT_FLAGS_SIGNAL_BASED,
            null,
          ];
          def.declaredInputs[publicName] = privateName;
        }
      } else if (kind === "model") {
        if (!Object.prototype.hasOwnProperty.call(def.inputs, publicName)) {
          ensureMutableInputs();
          def.inputs[publicName] = [
            privateName,
            INPUT_FLAGS_SIGNAL_BASED,
            null,
          ];
          def.declaredInputs[publicName] = privateName;
        }
        const outputName = `${publicName}Change`;
        if (!Object.prototype.hasOwnProperty.call(def.outputs, outputName)) {
          ensureMutableOutputs();
          def.outputs[outputName] = privateName;
        }
      } else {
        if (!Object.prototype.hasOwnProperty.call(def.outputs, publicName)) {
          ensureMutableOutputs();
          def.outputs[publicName] = privateName;
        }
      }
    }
  }

  if ((inputsMutated || outputsMutated) && def.tView) {
    def.tView = null;
  }
};

const registerJitSignalInputsAndOutputs = (
  root: unknown,
  visited = new Set<unknown>(),
): void => {
  if (!root || visited.has(root)) return;
  visited.add(root);

  if (Array.isArray(root)) {
    for (const item of root) {
      registerJitSignalInputsAndOutputs(item, visited);
    }
    return;
  }

  if (typeof root !== "function") return;

  const typed = root as unknown as {
    ɵcmp?: NgDirectiveDefLike;
    ɵdir?: NgDirectiveDefLike;
    ɵmod?: {
      imports?: unknown[] | (() => unknown[]);
      declarations?: unknown[] | (() => unknown[]);
      exports?: unknown[] | (() => unknown[]);
    };
  };

  const def = typed.ɵcmp ?? typed.ɵdir;
  if (def) {
    patchDefSignalMetadata(root, def);
    const deps =
      typeof def.dependencies === "function"
        ? def.dependencies()
        : def.dependencies;
    if (deps) {
      registerJitSignalInputsAndOutputs(deps, visited);
    }
  }

  if (typed.ɵmod) {
    const mod = typed.ɵmod;
    for (const group of [mod.imports, mod.declarations, mod.exports]) {
      const resolved = typeof group === "function" ? group() : group;
      if (resolved) {
        registerJitSignalInputsAndOutputs(resolved, visited);
      }
    }
  }
};

const getSignalNode = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "function") return null;
  const sym = Object.getOwnPropertySymbols(value).find(
    (s) => s.toString() === SIGNAL_SYMBOL_STR,
  );
  return sym
    ? ((value as unknown as Record<symbol, unknown>)[sym] as Record<
        string,
        unknown
      >)
    : null;
};

const applyInputValue = (
  componentRef: ComponentRef<unknown>,
  instance: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  const cmpDef = (
    componentRef.componentType as unknown as {
      ɵcmp?: NgDirectiveDefLike;
    }
  ).ɵcmp;
  const privateKey = cmpDef?.inputs?.[key]?.[0] ?? key;
  const currentProp = instance[privateKey];
  const node = getSignalNode(currentProp);
  if (node) {
    const transformFn = node["transformFn"] as
      | ((v: unknown) => unknown)
      | undefined;
    const nextValue =
      typeof transformFn === "function" ? transformFn(value) : value;

    // InputSignalNode has `applyValueToInputSignal`; WritableSignalNode does not.
    const applyFn = node["applyValueToInputSignal"] as
      | ((n: Record<string, unknown>, v: unknown) => void)
      | undefined;

    if (typeof applyFn === "function") {
      applyFn(node, nextValue);
      return;
    }
  }

  if (
    typeof currentProp === "function" &&
    typeof (currentProp as unknown as { set?: (v: unknown) => void }).set ===
      "function"
  ) {
    (currentProp as unknown as { set: (v: unknown) => void }).set(value);
    return;
  }

  try {
    componentRef.setInput(key, value);
  } catch {
    instance[privateKey] = value;
  }
};

const applyInputs = (
  componentRef: ComponentRef<unknown>,
  inputs: Record<string, unknown>,
): void => {
  const instance = componentRef.instance as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(inputs)) {
    applyInputValue(componentRef, instance, key, value);
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

  const stabilitySubscription = applicationRef.isStable.subscribe(
    (isStable) => {
      stable = isStable;
    },
  );

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

const destroyRenderHookExecution = (
  execution: RenderHookExecution<unknown>,
) => {
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
  componentInstance: T;
  asFragment: () => DocumentFragment;
  debug: (
    element?: Array<Element | HTMLDocument> | Element | HTMLDocument,
    maxLength?: number,
    options?: PrettyDOMOptions,
  ) => void;
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

  registerJitSignalInputsAndOutputs([component, ...(options.imports ?? [])]);

  const componentRef = createComponent(component, {
    environmentInjector: runtimeApplication.injector,
    hostElement: container,
  });
  runtimeApplication.attachView(componentRef.hostView);

  const teardown = () => {
    runCleanupSteps(
      [
        () => {
          if (
            !runtimeApplication.destroyed &&
            !componentRef.hostView.destroyed
          ) {
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
    componentInstance: componentRef.instance,
    asFragment: createAsFragment(container),
    debug: createDebug(baseElement),
    detectChanges,
    unmount,
    rerender,
  };
};

export const renderHook = async <Result, Props = undefined>(
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
  };

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
    destroyMountedHandles(registry.fallbackItems);
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

export const waitFor = createWaitFor(domTestingLibrary.waitFor);

export * from "@testing-library/dom";
