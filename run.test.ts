import { assert, poku } from "poku";
import { angularTestingPlugin } from "./src/plugin.ts";

const doms = ["happy-dom", "jsdom"] as const;
const isolations = ["none", "process"] as const;
const matrix = doms.flatMap((dom) =>
  isolations.map((isolation) => ({ dom, isolation }))
);

for (const { dom, isolation } of matrix) {
  const happyCode = await poku('tests', {
    noExit: true,
    isolation,
    plugins: [angularTestingPlugin({ dom })],
  });

  assert.strictEqual(happyCode, 0, `${dom} suite with ${isolation} isolation`);
}
