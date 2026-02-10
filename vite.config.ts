import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const target = process.env.VOXELCRAFT_AI_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/admin": {
        target,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});

