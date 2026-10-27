import { useEffect, useState } from 'react'
import { Alert, Button } from 'antd'
import { getVersion } from '../api/operations'
import { frontendBuild, releaseMismatch } from '../lib/buildInfo'
import { getErrorMessage } from '../lib/format'
import type { BuildInfo } from '../types/operations'

// BuildLabel 将未注入版本的源码构建明确标为开发版，并显示短提交号。
function BuildLabel({ value }: { value: BuildInfo }) {
  return (
    <span className="break-all">
      <span>{value.version === 'dev' ? '开发构建' : value.version}</span>{' '}
      <span className="ml-2 text-xs text-muted" title={value.revision}>
        {value.revision === 'unknown' ? '提交号未记录' : value.revision.slice(0, 12)}
      </span>
    </span>
  )
}

// PlatformVersion 展示构建身份，帮助管理员在升级后核对前后端配套关系。
export default function PlatformVersion() {
  const [backend, setBackend] = useState<BuildInfo | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    // loadVersion 读取编译信息，退出页面后忽略未完成的结果。
    const loadVersion = async () => {
      try {
        const value = await getVersion(controller.signal)
        if (!controller.signal.aborted) {
          setBackend(value)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '版本信息暂时无法读取'))
      }
    }
    void loadVersion()
    return () => controller.abort()
  }, [retry])
  return (
    <section
      aria-label="平台版本"
      className="mt-5 rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
    >
      <h2 className="font-semibold">平台版本</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="mb-1.5 text-xs text-muted">管理界面</dt>
          <dd>
            <BuildLabel value={frontendBuild} />
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs text-muted">后端服务</dt>
          <dd>{backend ? <BuildLabel value={backend} /> : error ? '暂不可用' : '正在读取…'}</dd>
        </div>
      </dl>
      {error && (
        <Alert
          className="mt-3"
          type="warning"
          showIcon
          title={error}
          action={
            <Button size="small" onClick={() => setRetry((value) => value + 1)}>
              重试
            </Button>
          }
        />
      )}
      {backend && releaseMismatch(frontendBuild, backend) && (
        <Alert
          className="mt-3"
          type="warning"
          showIcon
          title="前后端发布版本不同"
          description="先刷新页面；若仍不一致，请使用同一发布包配套更新 API、Runner、Web 和迁移镜像。"
        />
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        升级前保留完整备份，使用同一发布包更新镜像并执行数据库迁移。{' '}
        <a
          href="https://github.com/zby909/stack-nest-server/blob/main/docs/OPERATIONS.md#升级"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          升级说明 ↗
        </a>
      </p>
    </section>
  )
}
