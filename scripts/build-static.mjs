import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const output = join(root, "dist");
const entries = [
  "assets",
  "src",
  "app.js",
  "index.html",
  "styles.css",
  "LICENSE",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of entries) {
  await cp(join(root, entry), join(output, entry), {
    recursive: true,
    force: true,
  });
}

console.log("Static site written to dist/");
