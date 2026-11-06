import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// BASE_PATH задаёт подпуть хостинга (GitHub Pages: /<repo>/); локально — '/'.
const base = process.env.BASE_PATH ?? '/'
// На корне сайта — лендинг (index.html), само приложение — в подкаталоге app/ (app/index.html).
const appBase = `${base}app/`

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
        docs: resolve(import.meta.dirname, 'docs/index.html'),
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify(commitHash()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Сервис-воркер обслуживает только приложение: лендинг на корне открывается из сети как обычный сайт
      scope: appBase,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MBT: My Budget Tracker',
        short_name: 'MBT',
        description: 'Офлайн-приложение для учёта личных финансов',
        display: 'standalone',
        theme_color: '#09090b',
        background_color: '#09090b',
        // id — прежний start_url: уже установленное приложение остаётся тем же, а не дублируется
        id: base,
        start_url: appBase,
        scope: appBase,
        lang: 'ru',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Лендинг и инструкция — обычные страницы сайта, в офлайн-кэш приложения не попадают
        globIgnores: ['index.html', 'assets/landing-*', 'docs/**', 'assets/docs-*'],
        navigateFallback: 'app/index.html',
        navigateFallbackAllowlist: [new RegExp(`^${appBase}`)],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              ['style', 'script', 'image', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
