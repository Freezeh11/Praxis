import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Target older mobile browsers (2016+ iPhones/iPads/Androids): esbuild
  // transpiles modern syntax (optional chaining, etc.) down to ES2017 /
  // Safari 11 / Chrome 64 while React 19 still works.
  build: {
    target: ['es2017', 'safari11', 'chrome64', 'ios11'],
  },
  server: {
    proxy: {
      // Auth requests → Better Auth server (must come BEFORE /api)
      '/api/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      // All other API requests → FastAPI backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
