import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
      allowedHosts: [
    'grew-chancellor-tea-appear.trycloudflare.com',
  ],
    proxy: {
      '/api': {
        ws: true,
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})