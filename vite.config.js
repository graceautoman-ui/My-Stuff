import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // 使用根路径，适配 Vercel 部署
  server: {
    host: '0.0.0.0', // 允许局域网访问
    port: 5173,
    strictPort: false, // 如果端口被占用，尝试其他端口
  },
})
