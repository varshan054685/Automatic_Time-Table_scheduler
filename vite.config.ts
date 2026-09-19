import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Renderer build for the Electron desktop app.
 *
 * The client is a local SPA: the main process loads dist/public in production
 * and the Vite dev server in development. There is deliberately NO API proxy
 * and no cloud plugin — every data access goes through window.api (IPC), so a
 * missing proxy can never silently fall back to a remote backend.
 */
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: import.meta.dirname,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // The Electron dev window loads this exact URL — fail loudly rather than
    // silently moving to another port.
    port: 5173,
    strictPort: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
