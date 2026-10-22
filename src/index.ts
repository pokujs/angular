/** Plugin factory and alias for Poku integration. */
export {
  createAngularTestingPlugin,
  angularTestingPlugin,
  angularTestPlugin,
} from "./plugin.ts";
export type {
  AngularDomAdapter,
  AngularMetricsOptions,
  AngularMetricsSummary,
  AngularTestingPluginOptions,
} from "./plugin.ts";
/** Angular testing helpers and DX exports. */
export {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "./angular-testing.ts";
export type {
  AngularFixture,
  RenderHookOptions,
  RenderHookResult,
  RenderOptions,
  RenderResult,
} from "./angular-testing.ts";
export * from "@testing-library/dom";
