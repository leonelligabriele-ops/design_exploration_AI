import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only proxies. In production (Cloudflare Pages), /api/* is handled by
// Pages Functions in /functions/api/**.
//
// Two dev options:
//   1. `npm run dev` — vite only. /api/ollama is proxied by Vite to OLLAMA_URL
//      (set it in .env.local; defaults to a local Ollama on port 11434).
//      /api/claude does NOT work here (you'd need your key in the browser).
//   2. `npm run dev:proxy` — wrangler pages dev + vite. Pages Functions run
//      locally, reading secrets from .dev.vars. Both /api/claude and
//      /api/ollama match production behaviour.
export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too. They're only used here in the
  // config and are not exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/ollama': {
          target: env.OLLAMA_URL || 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
      },
    },
  }
})
