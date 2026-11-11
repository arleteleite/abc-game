import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em desenvolvimento, o Vite (porta 5173) repassa /api para o Worker local (porta 8787),
// inclusive WebSocket. Em produção, o próprio Worker serve o site e a API.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { "/api": { target: "http://127.0.0.1:8787", ws: true } },
  },
});
