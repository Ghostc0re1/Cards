import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "copy-card-assets",
      async closeBundle() {
        await cp(resolve("assets"), resolve("dist/assets"), {
          recursive: true,
          force: true,
        });
      },
    },
  ],
});
