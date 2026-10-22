import "@angular/compiler";
import { setupHappyDomEnvironment } from "@pokujs/dom";
import { parseRuntimeOptions } from "./runtime-options.ts";
import { resetPlatformDocument } from "./platform-document.ts";

await setupHappyDomEnvironment({
  runtimeOptions: parseRuntimeOptions(),
  packageTag: "@pokujs/angular",
});

resetPlatformDocument();
