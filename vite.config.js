import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vercel 部署在根路径用 '/'；GitHub Pages 若在 /My-Stuff/ 可在构建时设置 VITE_APP_BASE=/My-Stuff/
  base: import.meta.env.VITE_APP_BASE || '/',
})
