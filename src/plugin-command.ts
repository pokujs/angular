import type { AngularDomAdapter } from './plugin-types.ts';
import {
  buildRunnerCommand as buildCoreRunnerCommand,
  canHandleRuntime,
  createDomSetupPathResolver,
  type BuildRunnerCommandInput,
} from '@pokujs/dom';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const currentDir = dirname(fileURLToPath(import.meta.url));

const resolveSetupModulePath = (baseName: string) => {
  const jsPath = resolve(currentDir, `${baseName}.js`);
  if (existsSync(jsPath)) return jsPath;
  return resolve(currentDir, `${baseName}.ts`);
};

const happyDomSetupPath = resolveSetupModulePath('dom-setup-happy');
const jsdomSetupPath = resolveSetupModulePath('dom-setup-jsdom');

// Angular components and tests use .ts files. Inline templates may use .html.
const angularExtensions = new Set(['.ts', '.html']);

export const resolveDomSetupPath = createDomSetupPathResolver(
  '@pokujs/angular',
  happyDomSetupPath,
  jsdomSetupPath
);

export const buildRunnerCommand = (
  input: Omit<BuildRunnerCommandInput, 'extensions'>
) => buildCoreRunnerCommand({ ...input, extensions: angularExtensions });

export { canHandleRuntime };
