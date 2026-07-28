import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Deployed as a GitHub Pages *project* site, so everything is served from
  // /combat-achievements-tracker/ rather than the domain root. Vite rewrites the
  // asset URLs in index.html to match. Share links stay intact: they only vary by
  // query string and hash on whatever pathname the app is already sitting on.
  base: '/combat-achievements-tracker/',
  // Tailwind v4 is wired as a Vite plugin — no tailwind.config.js / postcss.config.js
  // needed. A single `@import "tailwindcss"` in index.css is the whole setup.
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.app.json (shadcn/ui uses it).
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // No dev proxy: there is no API server. Task data comes from the wiki's Bucket
  // API (which sends `access-control-allow-origin: *`, so the browser can call it
  // directly), and progress lives in localStorage.
})
