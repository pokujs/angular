import type {
  AngularDomAdapter,
  AngularMetricsOptions,
  AngularMetricsSummary,
  AngularTestingPluginOptions,
} from './plugin-types.ts';
import {
  createFrameworkTestingPluginFactory,
  type FrameworkDescriptor,
} from '@pokujs/dom';
import {
  buildRunnerCommand,
  canHandleRuntime,
  resolveDomSetupPath,
} from './plugin-command.ts';
import {
  buildRuntimeOptionArgs,
  createMetricsSummary,
  getComponentName,
  isRenderMetricBatchMessage,
  isRenderMetricMessage,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
} from './plugin-metrics.ts';

export type {
  AngularDomAdapter,
  AngularMetricsOptions,
  AngularMetricsSummary,
  AngularTestingPluginOptions,
};

const descriptor: FrameworkDescriptor = {
  pluginName: 'angular-testing',
  packageTag: '@pokujs/angular',
  runtimeArgBase: 'poku-angular',
  metricMessageType: 'POKU_ANGULAR_RENDER_METRIC',
  metricBatchMessageType: 'POKU_ANGULAR_RENDER_METRIC_BATCH',
  // Angular test files — and the component fixtures they import — are all .ts
  testFileExtensions: ['.ts'],
  commandBuilder: (input) => buildRunnerCommand(input),
};

const { createTestingPlugin } = createFrameworkTestingPluginFactory(
  descriptor,
  import.meta.url
);

export const createAngularTestingPlugin = (
  options: AngularTestingPluginOptions = {}
) => createTestingPlugin(options);

export const angularTestingPlugin = createAngularTestingPlugin;

export const __internal = {
  buildRunnerCommand,
  canHandleRuntime,
  buildRuntimeOptionArgs,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
  createMetricsSummary,
  getComponentName,
  isRenderMetricMessage,
  isRenderMetricBatchMessage,
  resolveDomSetupPath,
};
