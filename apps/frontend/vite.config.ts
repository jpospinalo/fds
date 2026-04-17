import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: "all",
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/pipeline": { target: BACKEND, changeOrigin: true },
    },
  },
});