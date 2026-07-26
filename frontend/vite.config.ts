import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
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
