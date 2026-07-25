import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Tailwind v4 is wired as a Vite plugin — no tailwind.config.js / postcss.config.js
  // needed. A single `@import "tailwindcss"` in index.css is the whole setup.
  plugins: [react(), tailwindcss()],
  server: {
    // Dev: SPA on :5173, API on :8080. These proxies let the app call same-origin
    // "/api/..." and "/actuator/..." with no CORS config.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/actuator': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
