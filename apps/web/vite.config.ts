import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
<<<<<<< HEAD
    allowedHosts: true,
=======
>>>>>>> 6d5899a (Initial_commit_XYZ_Bank_AI_Voice_Banking_Platform)
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});