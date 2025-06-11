import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // CRITICAL: Bind to all interfaces for Docker
    port: 3000,
    watch: {
      usePolling: true, // For file system compatibility in containers
      interval: 1000,   // Poll every second
    },
    hmr: {
      port: 3000,       // Hot Module Replacement port
    },
    proxy: {
      "/api": {
        target: "http://backend:3001", // Use Docker service name
        changeOrigin: true,
      },
    },
  },
});