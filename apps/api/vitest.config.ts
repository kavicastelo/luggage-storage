import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/setup/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
