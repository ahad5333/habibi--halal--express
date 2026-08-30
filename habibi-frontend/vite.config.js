import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Captured at build time from whatever commit is checked out -- deploy.sh
// builds locally right after committing/pushing, so this reflects the
// actual deployed commit. Falls back gracefully if git isn't available.
function gitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'terser',
  },
  define: {
    __BUILD_INFO__: JSON.stringify({
      sha: gitShortSha(),
      date: new Date().toISOString().slice(0, 10),
    }),
  },
})
