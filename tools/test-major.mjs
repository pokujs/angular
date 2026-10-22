import { execFileSync, spawnSync } from "node:child_process";

const major = process.argv[2];

if (!["18", "19", "20", "21"].includes(major)) {
  throw new Error("Choose a supported Angular major: 18, 19, 20, or 21.");
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const versions = JSON.parse(
  execFileSync(npm, ["view", `@angular/core@${major}`, "version", "--json"], {
    encoding: "utf8",
  }),
);
const version = Array.isArray(versions) ? versions.at(-1) : versions;

if (typeof version !== "string" || !version.startsWith(`${major}.`)) {
  throw new Error(`Could not resolve an Angular ${major} release.`);
}

const packages = [
  "common",
  "compiler",
  "core",
  "forms",
  "platform-browser",
  "platform-browser-dynamic",
].map((name) => `@angular/${name}@${version}`);

for (const args of [
  ["install", "--no-save", ...packages],
  ["test"],
]) {
  const result = spawnSync(npm, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
