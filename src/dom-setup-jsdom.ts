import "@angular/compiler";
import { setupJsdomEnvironment } from "@pokujs/dom";
import { parseRuntimeOptions } from "./runtime-options.ts";
import { resetPlatformDocument } from "./platform-document.ts";

await setupJsdomEnvironment({
  runtimeOptions: parseRuntimeOptions(),
  packageTag: "@pokujs/angular",
});

resetPlatformDocument();
