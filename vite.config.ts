import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    proxy: {
      // El backend solo acepta un origen via ALLOWED_ORIGIN, asi que en dev
      // las llamadas salen del proxy (server-to-server) y no pasan por CORS.
      '/api': {
        target: 'https://backend-production-1658.up.railway.app',
        changeOrigin: true,
      },
    },
  },
})
