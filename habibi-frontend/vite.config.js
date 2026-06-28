import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Use esbuild minifier instead of Rolldown's OXC minifier to avoid
    // TDZ errors caused by incorrect variable reordering in the OXC output.
    minify: 'esbuild',
  },
})
