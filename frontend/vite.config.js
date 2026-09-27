import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// Where the dev server proxies /api/* — override to run a throwaway backend.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Laws + levels live in <repo>/content so the FastAPI backend serves the
      // exact same JSON this app bundles. One source of truth, two consumers.
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
    },
  },
  server: {
    // The content directory sits outside the Vite root, so the dev server has
    // to be allowed to read it.
    fs: { allow: [repoRoot] },
    proxy: {
      // Auth requests → Better Auth server (must come BEFORE /api)
      '/api/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      // All other API requests → FastAPI backend
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
