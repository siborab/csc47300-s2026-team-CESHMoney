import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Keep browser opening manual so the dev server only starts the app.
    open: false
  }
});
