import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: the app build needs the React and
// Tailwind plugins, the tests need neither. Everything under test is pure
// TypeScript, so loading the plugins here would only slow the run down.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    // Node, not jsdom. The one module that touches the DOM (progress-store) is
    // tested against an injected fake localStorage, which lets us exercise the
    // failure modes a real one won't reproduce on demand -- private browsing,
    // a refused read, an exhausted quota.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
