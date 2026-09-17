import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    // Rapier includes its WASM payload; keep it separately cacheable.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@dimforge/rapier')) return 'physics'
          if (id.includes('three')) return 'graphics'
        },
      },
    },
  },
})
