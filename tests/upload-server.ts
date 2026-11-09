import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mockUploads, type UploadMock } from './upload-mock.ts'
import type { Project } from '../src/types/project.ts'

// startUploadReceiver 让 WebKit 发送真实 Blob；其拦截 API 无法读取文件请求体，不能拿空值模拟分片。
// 上游限制：https://github.com/microsoft/playwright/issues/6479
export async function startUploadReceiver(
  state: UploadMock,
  projects: Project[],
  origin: string,
  errors: string[],
) {
  const server = createServer(async (req, res) => {
    try {
      const cors = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Upload-Offset, Cache-Control, Pragma',
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors).end()
        return
      }
      if (req.method !== 'PATCH' || !/^\/api\/uploads\/[a-f0-9-]+$/.test(req.url ?? '')) {
        res.writeHead(404).end()
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of req) {
        bytes += chunk.length
        if (bytes > 4 * 1024 ** 2) throw new Error('测试分片超过协议上限')
        chunks.push(Buffer.from(chunk))
      }
      const body = Buffer.concat(chunks)
      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(', ') : (value ?? ''),
        ]),
      )
      await mockUploads(
        {
          request: () => ({
            url: () => origin + req.url,
            method: () => 'PATCH',
            headers: () => headers,
            postDataJSON: () => JSON.parse(body.toString()),
            postDataBuffer: () => body,
          }),
          fulfill: async (options) => {
            res.writeHead(options?.status ?? 200, {
              ...cors,
              'Content-Type': options?.contentType ?? 'application/json',
            })
            res.end(options?.body)
          },
          abort: async () => {
            req.socket.destroy()
          },
        },
        state,
        projects,
      )
    } catch (error) {
      // 测试主动暂停上传可以关闭连接，其他接收错误不能静默通过。
      if (!req.aborted) errors.push(`upload receiver: ${String(error)}`)
      if (!res.headersSent) res.writeHead(500)
      res.end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    // close 关闭本次测试的接收端与连接，不留下后台服务。
    close: async () => {
      const stopped = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
      server.closeAllConnections()
      await stopped
    },
  }
}
