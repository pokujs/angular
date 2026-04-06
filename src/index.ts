/** Plugin factory and alias for Poku integration. */
export { createAngularTestingPlugin, angularTestingPlugin } from './plugin.ts';
export type {
  AngularDomAdapter,
  AngularMetricsOptions,
  AngularMetricsSummary,
  AngularTestingPluginOptions,
} from './plugin.ts';
/** Angular testing helpers and DX exports. */
export {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from './angular-testing.ts';
export * from './angular-testing.ts';
