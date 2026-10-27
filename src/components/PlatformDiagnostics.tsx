import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Tag } from 'antd'
import { runDiagnostics } from '../api/operations'
import { getErrorMessage } from '../lib/format'
import type { DiagnosticReport } from '../types/operations'

const names: Record<string, string> = {
  auth: '认证配置',
  database: '数据库',
  schema: '数据库结构',
  roles: '管理账号',
  storage: '上传空间',
  docker: 'Docker 运行器',
  quota: '磁盘配额',
  'network-protection': '容器局域网保护',
  network: '宿主网络服务',
  smtp: '邮件服务',
  invitation: '邀请地址',
  frontend: '前端入口',
}
const states = {
  pass: { color: 'success', label: '通过' },
  warn: { color: 'warning', label: '提示' },
  fail: { color: 'error', label: '失败' },
}

// PlatformDiagnostics 由超管主动发起只读检查，保留旧报告并明确标出请求失败。
export default function PlatformDiagnostics() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  // inspect 只允许一个在途请求，关闭页面会取消检查，不发送邮件。
  const inspect = async () => {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setLoading(true)
    setError('')
    try {
      const next = await runDiagnostics(controller.signal)
      if (!controller.signal.aborted) setReport(next)
    } catch (failure) {
      if (!controller.signal.aborted) setError(getErrorMessage(failure, '诊断未能完成，请稍后重试'))
    } finally {
      if (!controller.signal.aborted) {
        active.current = null
        setLoading(false)
      }
    }
  }

  return (
    <section
      aria-label="平台诊断"
      className="mt-5 rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">平台诊断</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted sm:text-xs">
            检查数据库、邮件、Docker 与可选保护配置。只读检查，最多 30 秒，不发送邮件。
          </p>
        </div>
        <Button className="h-11 shrink-0 sm:h-8" loading={loading} onClick={() => void inspect()}>
          {loading ? '正在诊断' : report ? '重新诊断' : '运行诊断'}
        </Button>
      </div>
      {error && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          title={error}
          description={report ? '下方保留上次结果，尚未确认当前状态。' : undefined}
        />
      )}
      {!report && !loading && !error && (
        <p className="mt-4 text-sm text-muted">
          部署后或出现异常时运行一次；可选功能未启用会显示提示。
        </p>
      )}
      {report && (
        <>
          <p className="mt-4 text-xs text-muted">
            检查于 {new Date(report.checkedAt).toLocaleString('zh-CN')} · 耗时{' '}
            {(report.durationMs / 1000).toFixed(1)} 秒
          </p>
          <ul className="mt-3 divide-y divide-line">
            {report.checks.map((check) => (
              <li key={check.name} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{names[check.name] ?? check.name}</span>
                  <Tag color={states[check.status].color} className="m-0 shrink-0">
                    {states[check.status].label}
                  </Tag>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed break-words text-muted">
                  {check.message}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            邮件检查通过只代表连接与认证成功；公网域名、证书及邮件最终送达仍需实际访问确认。
          </p>
        </>
      )}
    </section>
  )
}
