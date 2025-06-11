import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // 🔥 This is the key fix!
    port: 3000,
    proxy: {
      "/api": {
        target: "http://backend:3001", // Use service name instead of localhost
        changeOrigin: true,
      },
    },
  },
});
