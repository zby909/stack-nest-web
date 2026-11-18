import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// 在测试进程内启停视觉稿，释放监听端口并与开发者正在浏览的实例分开缓存依赖。
export default async function startPreview() {
  process.env.VITE_API_BASE = 'https://visual-preview.invalid'
  const preview = await createServer({
    configFile: fileURLToPath(
      new URL('../stacknest-html-design-neutral/vite.config.ts', import.meta.url),
    ),
    cacheDir: 'node_modules/.vite-visual-screenshots',
    server: { port: 4177, strictPort: true },
  })
  await preview.listen()
  return () => preview.close()
}
