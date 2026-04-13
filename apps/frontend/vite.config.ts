import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      // CORRECCIÓN: "all" en lugar de hostname hardcodeado
      // Permite acceso desde localhost, EC2, o cualquier host de desarrollo
      allowedHosts: "all",
      proxy: {
        // Proxy del prefijo /api → FastAPI en :8000
        "/api": {
          target: env.VITE_API_URL || "http://localhost:8000",
          changeOrigin: true,
        },
        // Proxy del prefijo /pipeline → FastAPI en :8000
        "/pipeline": {
          target: env.VITE_API_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});