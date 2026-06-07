import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api para o backend Django em dev, evitando CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/media": "http://localhost:8000",
    },
  },
});
