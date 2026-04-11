import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["ec2-3-91-103-135.compute-1.amazonaws.com"],
    proxy: {
      // Opcional: proxy para evitar CORS en desarrollo
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});