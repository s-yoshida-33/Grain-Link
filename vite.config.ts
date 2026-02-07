import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './', 
  plugins: [react(), tailwindcss()],
  server: {
    // ショップAPI連携用プロキシ設定（Bridge API: 8090）
    proxy: {
      "/api":  { target: "http://localhost:8090", changeOrigin: true },
    },
  },
});
