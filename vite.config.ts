import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Patra Lens",
        short_name: "Patra Lens",
        description: "Catch the first spot. Early detection of crop pests and diseases on any smartphone.",
        theme_color: "#0B2B33",
        background_color: "#0B2B33",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // App shell only. The big runtime files are cached the first time they are used (below).
        globPatterns: ["**/*.{js,css,html,svg,woff2}", "data/*.json", "icons/*.png"],
        globIgnores: ["opencv/**", "ort/**", "model/**", "samples/**"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // The model loader checks the file with HEAD first; answer from the cache so it also works offline.
            urlPattern: ({ url }) => url.pathname === "/model/patra.onnx",
            method: "HEAD",
            handler: async ({ request }) => {
              const hit = await caches.match((request as Request).url, { ignoreVary: true });
              return hit ? new Response(null, { status: 200, headers: { "content-type": "application/octet-stream" } }) : fetch(request);
            },
          },
          {
            urlPattern: ({ url }) => /^\/(model|ort|opencv|samples)\//.test(url.pathname),
            handler: "CacheFirst",
            // ignoreVary: some hosts send "Vary: Origin", which would make script imports miss files saved by fetch.
            options: { cacheName: "patra-runtime", cacheableResponse: { statuses: [200] }, rangeRequests: true, matchOptions: { ignoreVary: true } },
          },
          {
            urlPattern: ({ url }) => url.hostname === "api.open-meteo.com",
            handler: "NetworkFirst",
            options: { cacheName: "patra-weather", networkTimeoutSeconds: 6, expiration: { maxEntries: 8, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "patra-fonts", cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 900 },
});
