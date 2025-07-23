import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/icf-activity-analyzer/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
