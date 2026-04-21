import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Carga las variables de entorno basándose en el modo actual (.env, .env.development, etc.)
  const env = loadEnv(mode, process.cwd(), "");
  
  // Si existe VITE_API_URL en tu .env lo utiliza, sino usa el localhost por defecto
  const BACKEND = env.VITE_API_URL || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    define: {
      // Esto fuerza a Vite a reemplazar la variable en todo el código fuente
      "process.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL),
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/api": { target: BACKEND, changeOrigin: true },
        "/pipeline": { target: BACKEND, changeOrigin: true },
      },
    },
  };
});