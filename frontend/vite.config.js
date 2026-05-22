import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Auth requests → Better Auth server (must come BEFORE /api)
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // All other API requests → FastAPI backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
