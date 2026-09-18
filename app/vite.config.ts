import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must run before react() so route files are transformed first.
    // Generates src/routeTree.gen.ts from src/routes/**.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // maplibre-gl's worker is bundled by Vite as its own ES entry (see
  // src/components/map/city-map.tsx); it must stay a module worker.
  worker: { format: 'es' },
})
