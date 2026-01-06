import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // backend context
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      provider: "v8",
    },
  },
});
