import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Dev server: proxies API + WebSocket to the backend (port 3000).
// Production: `vite build` emits to ../backend/dist/public, served by Hono.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: {
    outDir: "../backend/dist/public",
    emptyOutDir: true,
  },
});
