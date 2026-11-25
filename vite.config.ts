import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * One Vite build produces both outputs:
 *  - dist/client       → the React SPA (served by Workers Static Assets)
 *  - dist/second_brain → the Worker bundle (Hono API)
 * In `vite dev` the Worker runs inside workerd (same runtime as production).
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    /**
     * PWA (Phase 7). The service worker precaches ONLY the app shell (HTML, JS,
     * CSS, fonts, icons). Personal data never enters the SW cache: /api/* always
     * goes to the network; offline data lives in the TanStack Query persister
     * (IndexedDB), which the user can wipe from Settings.
     */
    VitePWA({
      registerType: "prompt", // new version → user confirms (no mixed versions mid-edit)
      injectRegister: false, // registered lazily from src/client/pwa/register.ts
      useCredentials: true, // <link rel="manifest" crossorigin="use-credentials">: sends the Access cookie
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["theme-init.js", "icons/icon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Second Brain",
        short_name: "Brain",
        description: "Sistema pessoal de conhecimento e gestão (PARA)",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#fbfaf8",
        theme_color: "#fbfaf8",
        categories: ["productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Captura rápida", url: "/?capture=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Diário de hoje", url: "/journal", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Novo lançamento", url: "/finance?tab=transactions&new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        // Never answer these navigations from the cache: Access login/logout
        // (/cdn-cgi), the re-login hop (/auth) and the API.
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//, /^\/auth\//],
        runtimeCaching: [], // explicit: no runtime caching of anything (data stays out of the SW)
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  // Identifies the build: busts the offline data cache on every deploy.
  define: { __BUILD_ID__: JSON.stringify(process.env.GITHUB_SHA ?? `local-${Date.now()}`) },
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
