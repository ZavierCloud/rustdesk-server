import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 开发时把 /api 代理到本地 hbbs 控制台 API（默认 21114），
// 生产由 hbbs 托管 dist 目录，前端使用相对路径 /api/...。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:21114',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
