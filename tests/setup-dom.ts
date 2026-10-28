// Setup for the "jsdom" Vitest project (tests/**/*.test.tsx).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL only auto-cleans when Vitest globals are enabled; they are not.
afterEach(() => {
  cleanup();
});
