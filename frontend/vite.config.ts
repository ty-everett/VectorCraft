import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@huggingface/transformers') || id.includes('onnxruntime-web')) return 'local-ai'
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react'
          return undefined
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
