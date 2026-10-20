import { defineConfig } from "vitest/config";

// Unit-test config for the backend. Tests are colocated with sources as
// `src/**/*.test.ts` and must be self-contained: no database, no network,
// no Express app — pure logic only. Globals are disabled, so every test
// file imports { describe, it, expect } from "vitest".
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
