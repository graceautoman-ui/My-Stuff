import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 用 '/'；GitHub Pages 在 workflow 里设 VITE_APP_BASE=/My-Stuff/
  base: process.env.VITE_APP_BASE || '/',
})
