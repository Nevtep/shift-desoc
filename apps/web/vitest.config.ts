import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/unit/setup.ts"],
    globals: true,
    css: false,
    env: {
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_LOCALE: "en"
    }
  },
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@shift/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@shift/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@shift/ui/*": path.resolve(__dirname, "../../packages/ui/src/*"),
      "@shift/shared/*": path.resolve(__dirname, "../../packages/shared/src/*")
    }
  }
});
