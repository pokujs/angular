import { setupHappyDomEnvironment } from '@pokujs/dom';
import { parseRuntimeOptions } from './runtime-options.ts';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

await setupHappyDomEnvironment({
  runtimeOptions: parseRuntimeOptions(),
  packageTag: '@pokujs/angular',
});

// Initialize Angular's JIT testing environment once per process.
// Guard against calling initTestEnvironment twice when isolation is 'none'.
const INIT_KEY = Symbol.for('@pokujs/angular.testbed-initialized');
type GlobalWithInitFlag = typeof globalThis & { [INIT_KEY]?: boolean };
const g = globalThis as GlobalWithInitFlag;

if (!g[INIT_KEY]) {
  g[INIT_KEY] = true;
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
    { teardown: { destroyAfterEach: false } }
  );
}
