import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __STACKNEST_BUILD__: JSON.stringify({
      version: process.env.STACKNEST_BUILD_VERSION || 'dev',
      revision: process.env.STACKNEST_BUILD_REVISION || 'unknown',
    }),
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
      '/sites': { target: 'http://localhost:8080', changeOrigin: false },
      '^/': {
        target: 'http://localhost:8080',
        changeOrigin: false,
        // 隔离预览的页面与绝对资源路径交给 Go，管理页由 Vite 处理。
        bypass(request) {
          if (!/^stack-nest-[a-z0-9-]+\.localhost(?::\d+)?$/.test(request.headers.host ?? '')) {
            return request.url ?? '/'
          }
        },
      },
    },
  },
})
