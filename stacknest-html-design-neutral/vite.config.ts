import { defineConfig } from 'vite'
import application from '../vite.config.ts'
import { visualAPI } from './api.ts'

// 复用管理台的 React、Tailwind 和入口；视觉稿独立监听本机，不加载部署环境或开发代理。
export default defineConfig({
  ...application,
  cacheDir: 'node_modules/.vite-visual',
  envDir: false,
  define: {
    ...application.define,
    'import.meta.env.VITE_API_BASE': JSON.stringify(''),
    __STACKNEST_BUILD__: JSON.stringify({ version: 'dev', revision: 'unknown' }),
  },
  server: { host: '127.0.0.1', port: 4176, strictPort: true },
  plugins: [
    ...(application.plugins ?? []),
    {
      name: 'stacknest-visual-api',
      // 只拦截此预览实例的演示请求。
      configureServer(server) {
        server.middlewares.use(visualAPI)
      },
    },
  ],
})
