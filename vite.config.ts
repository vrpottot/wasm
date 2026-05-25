import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // Все запросы /api/* → Express на порт 8000
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  }
});
