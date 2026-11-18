import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Reads KEY=value lines from .dev.vars (the same file Cloudflare's local
// tooling uses), so the Claude key lives in one place for local work.
function readDevVars() {
  try {
    return Object.fromEntries(readFileSync('.dev.vars', 'utf8').split(/\r?\n/)
      .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]))
  } catch {
    return {}
  }
}

// Without a real key, /api/claude answers with how to add one instead of
// failing silently.
const missingClaudeKey = () => ({
  name: 'missing-claude-key',
  configureServer(server) {
    server.middlewares.use('/api/claude', (req, res) => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain')
      res.end('No Claude API key yet. Put it in the .dev.vars file in the project folder as ANTHROPIC_KEY=sk-ant-... and restart "npm run dev".')
    })
  },
})

// Dev-only proxies. In production (Cloudflare Pages), /api/* is handled by
// Pages Functions in /functions/api/**.
//
// `npm run dev` proxies:
//   /api/claude → Anthropic, signed with ANTHROPIC_KEY from .dev.vars
//   /api/ollama → OLLAMA_URL (set it in .env.local; defaults to port 11434)
//   /api/gemini → Google, signed with GEMINI_KEY from .env.local
// (`npm run dev:proxy` does not start with this wrangler.toml, because
// wrangler won't combine pages_build_output_dir with a proxy command.)
export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too. They're only used here in the
  // config and are not exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')
  // A real key looks like sk-ant-… and is long; the template's "sk-ant-..." is not.
  const looksReal = (k) => typeof k === 'string' && k.startsWith('sk-ant-') && k.length > 20
  const claudeKey = [readDevVars().ANTHROPIC_KEY, env.ANTHROPIC_KEY].find(looksReal) || ''
  const hasClaudeKey = !!claudeKey

  return {
    plugins: [react(), ...(hasClaudeKey ? [] : [missingClaudeKey()])],
    server: {
      proxy: {
        // Claude: the key from .dev.vars is added here, on the dev server, so
        // it never reaches the browser. Mirrors functions/api/claude.js.
        ...(hasClaudeKey ? {
          '/api/claude': {
            target: 'https://api.anthropic.com',
            changeOrigin: true,
            rewrite: () => '/v1/messages',
            headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
            configure: (proxy) => proxy.on('proxyReq', (proxyReq) => {
              // A server-to-server call: drop the browser's origin headers.
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
            }),
          },
        } : {}),
        '/api/ollama': {
          target: env.OLLAMA_URL || 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
        // Gemini experiments (local only): signed with GEMINI_KEY from
        // .env.local here, so the key never reaches the browser.
        ...(env.GEMINI_KEY ? {
          '/api/gemini': {
            target: 'https://generativelanguage.googleapis.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/gemini/, '/v1beta/openai'),
            headers: { Authorization: `Bearer ${env.GEMINI_KEY}` },
          },
        } : {}),
      },
    },
  }
})
