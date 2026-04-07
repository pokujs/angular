import type { EnvironmentProviders } from '@angular/core';
import * as angularCore from '@angular/core';

type AngularCoreZonelessApi = {
  provideZonelessChangeDetection?: () => EnvironmentProviders;
  provideExperimentalZonelessChangeDetection?: () => EnvironmentProviders;
};

const angularCoreZonelessApi = angularCore as AngularCoreZonelessApi;

/**
 * Resolve Angular's zoneless change-detection provider across versions.
 * Prefers the stable `provideZonelessChangeDetection()` API when present and
 * falls back to `provideExperimentalZonelessChangeDetection()` for older releases.
 */
export const provideCompatibleZonelessChangeDetection = () => {
  if (typeof angularCoreZonelessApi.provideZonelessChangeDetection === 'function') {
    return angularCoreZonelessApi.provideZonelessChangeDetection();
  }

  if (
    typeof angularCoreZonelessApi.provideExperimentalZonelessChangeDetection ===
    'function'
  ) {
    return angularCoreZonelessApi.provideExperimentalZonelessChangeDetection();
  }

  throw new Error(
    'Angular does not expose provideZonelessChangeDetection or provideExperimentalZonelessChangeDetection.'
  );
};