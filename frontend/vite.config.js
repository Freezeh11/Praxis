import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// Where the dev server proxies /api/* — override to run a throwaway backend.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000'

/** Vendored runtime split into cacheable, independently invalidated chunks. */
const VENDOR_GROUPS = [
  // jsx-runtime is matched by id as well: Rolldown can inline it as a virtual
  // module (`react/jsx-runtime`), and without this rule it lands in whichever
  // chunk first imports it — pulling that chunk into the entry preload set.
  { name: 'react', test: /(node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]|react[\\/]jsx(-dev)?-runtime|jsx(-dev)?-runtime)/ },
  { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
]

function manualChunks(id) {
  if (id.includes('node_modules')) {
    for (const group of VENDOR_GROUPS) {
      if (group.test.test(id)) return group.name
    }
    // framer-motion is only used by lazy routes and the session dialog. Left in
    // the eager vendor chunk it would be preloaded on the landing page; left
    // unassigned, Rolldown parks it in the async chunks that import it.
    if (/node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return undefined
    return 'vendor'
  }
  // Config is imported by pages that never touch the solver. It must be its own
  // chunk *before* engine: otherwise Rollup folds both together and importing
  // one rule table drags the whole solver into the landing path.
  if (/[\\/]src[\\/]config[\\/]/.test(id)) return 'config'
  // The law/solver engine is only needed by the workspace pages; its own chunk
  // keeps it out of the landing/login path.
  if (/[\\/]src[\\/]engine[\\/]/.test(id)) return 'engine'
  return undefined
}

/**
 * Rewrites the CSP <meta> stamped in index.html.
 *
 * index.html carries the strict production policy so the file is meaningful on
 * its own; this hook narrows connect-src to the exact Supabase project and, for
 * the dev server only, adds what a browser dev session needs: React Refresh's
 * inline preamble ('unsafe-inline'/'unsafe-eval'), the HMR websocket and the
 * local API proxies. Nothing is relaxed in a build.
 */
function contentSecurityPolicy({ isDev, supabaseUrl }) {
  const connect = ["'self'"]

  if (supabaseUrl) {
    try {
      const { origin, host } = new URL(supabaseUrl)
      connect.push(origin, `wss://${host}`)
    } catch {
      // A malformed env value must not break the build; the wildcard fallback
      // below still covers a hosted Supabase project.
    }
  }
  if (connect.length === 1) connect.push('https://*.supabase.co', 'wss://*.supabase.co')

  if (isDev) {
    connect.push(
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'ws://localhost:5173',
      'ws://127.0.0.1:5173',
    )
  }

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    // Inline styles are unavoidable here: Tailwind ships a stylesheet, but
    // framer-motion and the canvas write style attributes at runtime.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `connect-src ${connect.join(' ')}`,
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
  ].join('; ')

  return {
    name: 'praxis-csp',
    transformIndexHtml(html) {
      return html.replace(
        /<meta data-praxis-csp[^>]*>/,
        `<meta data-praxis-csp http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''

  return {
    plugins: [
      react(),
      contentSecurityPolicy({ isDev: command === 'serve', supabaseUrl }),
    ],
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
    build: {
      // The app targets evergreen browsers only; an ES2020 baseline keeps the
      // bundle free of legacy-syntax helpers nothing here needs.
      target: 'es2020',
      rollupOptions: {
        output: { manualChunks },
      },
    },
  }
})
