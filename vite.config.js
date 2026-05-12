import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: false,
    proxy: {
      // Forwards /api/* calls to the Express API server during development.
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  }
});
