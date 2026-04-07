import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Opcional: proxy para evitar CORS en desarrollo
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});