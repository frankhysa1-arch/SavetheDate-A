import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mirrors the "@/*" -> "./*" path alias in tsconfig.json.
const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Two test projects:
 *  - "node":  tests/**\/*.test.ts   (engine, backend, types). Default environment.
 *  - "jsdom": tests/**\/*.test.tsx  (React components), with jest-dom matchers
 *             and RTL cleanup from tests/setup-dom.ts.
 *
 * `environmentMatchGlobs` no longer exists in Vitest 5, hence `projects`.
 * Per-file override also works: put `// @vitest-environment jsdom` as the
 * first line of a .ts test that needs a DOM.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": root },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          setupFiles: ["./tests/setup-dom.ts"],
        },
      },
    ],
  },
});
