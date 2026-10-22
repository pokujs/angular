import { destroyPlatform } from "@angular/core";

const documentKey = Symbol.for("@pokujs/angular.platform-document");

export const resetPlatformDocument = () => {
  const state = globalThis as Record<symbol, Document | undefined>;
  const previousDocument = state[documentKey];
  if (previousDocument && previousDocument !== document) destroyPlatform();
  state[documentKey] = document;
};
