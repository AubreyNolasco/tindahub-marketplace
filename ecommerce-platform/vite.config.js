import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Page-level splitting now comes from the lazy()/Suspense routes
        // in src/App.jsx instead of grouping by /src/pages/<Role>/ path
        // — that grouping was forcing pages that import across sections
        // into the same three chunks, which is what caused the circular
        // chunk warnings. Vendor libraries still get their own chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('/scheduler/')
          ) return 'react-vendor'
        }
      }
    }
  }
})
