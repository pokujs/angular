import { defineConfig } from "poku";
import { angularTestingPlugin } from "./src/plugin.ts";

const dom = process.env.POKU_ANGULAR_TEST_DOM;
if (!dom) {
  throw new Error("POKU_ANGULAR_TEST_DOM environment variable is not set");
}

export default defineConfig({
  plugins: [angularTestingPlugin({ dom })],
  isolation: "none",
});
