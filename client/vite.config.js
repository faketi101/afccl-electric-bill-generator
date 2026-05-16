import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../dist',  // output goes to root/dist, served by Express
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000', // dev proxy to Express
    },
  },
});
