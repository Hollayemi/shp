import { defineConfig } from "vitest/config";
// import react from '@vitejs/plugin-react'; // Not installed yet. Install for React testing.

export default defineConfig({
  // plugins: [react()], // Not installed yet. Install for React testing.
  test: {
    globals: true,
    environment: "jsdom", // Simulate browser DOM
    setupFiles: "./vitest.setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      provider: "v8",
    },
  },
});
