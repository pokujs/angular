import type {
  NormalizedMetricsOptions,
  AngularMetricsSummary,
  AngularTestingPluginOptions,
  RenderMetric,
} from './plugin-types.ts';
import {
  buildRuntimeOptionArgs as buildCoreRuntimeOptionArgs,
  createMetricsSummary,
  getComponentName,
  isRenderMetricBatchMessage as isCoreRenderMetricBatchMessage,
  isRenderMetricMessage as isCoreRenderMetricMessage,
  normalizeMetricsOptions,
  printMetricsSummary as printCoreMetricsSummary,
  selectTopSlowestMetrics,
} from '@pokujs/dom';
import { runtimeOptionArgPrefixes } from './runtime-options.ts';

const ANGULAR_RENDER_METRIC = 'POKU_ANGULAR_RENDER_METRIC';
const ANGULAR_RENDER_METRIC_BATCH = 'POKU_ANGULAR_RENDER_METRIC_BATCH';

export const isRenderMetricMessage = (message: unknown) =>
  isCoreRenderMetricMessage(message, ANGULAR_RENDER_METRIC);

export const isRenderMetricBatchMessage = (message: unknown) =>
  isCoreRenderMetricBatchMessage(message, ANGULAR_RENDER_METRIC_BATCH);

export const buildRuntimeOptionArgs = (
  options: AngularTestingPluginOptions,
  metricsOptions: NormalizedMetricsOptions
) => buildCoreRuntimeOptionArgs(options, metricsOptions, runtimeOptionArgPrefixes);

export const printMetricsSummary = (summary: AngularMetricsSummary) =>
  printCoreMetricsSummary(summary, '@pokujs/angular');

export {
  createMetricsSummary,
  getComponentName,
  normalizeMetricsOptions,
  selectTopSlowestMetrics,
};

export type { RenderMetric };
