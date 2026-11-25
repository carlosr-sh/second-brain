import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * One Vite build produces both outputs:
 *  - dist/client       → the React SPA (served by Workers Static Assets)
 *  - dist/second_brain → the Worker bundle (Hono API)
 * In `vite dev` the Worker runs inside workerd (same runtime as production).
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    // Performance budget: initial JS <= ~200 KB gzip (~650 KB minified).
    // Heavy modules (editor, charts) must be lazy-loaded per route.
    chunkSizeWarningLimit: 650,
  },
});
