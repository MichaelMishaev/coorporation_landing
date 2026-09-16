import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    clearMocks: true,
    // DB-backed test files share one real Postgres database with no
    // per-file isolation — running them concurrently races each file's
    // afterEach cleanup against another file's in-flight assertions.
    fileParallelism: false,
  },
});
