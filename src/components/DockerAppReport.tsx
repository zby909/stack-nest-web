import { useState } from 'react'
import { Alert, Button, Input, Modal, message } from 'antd'
import type { AppView } from '../types/app'

// DockerAppReport 仅整理当前授权页面的脱敏失败快照，预览确认后由用户复制。
export default function DockerAppReport({
  view,
  text,
  disabled,
}: {
  view: AppView
  text: string
  disabled: boolean
}) {
  const [report, setReport] = useState('')
  const [copyFailed, setCopyFailed] = useState(false)
  const [messageAPI, context] = message.useMessage()

  // preview 固定本次快照，复制期间的后台刷新不会悄悄改变报告。
  const preview = () => {
    const { app, progress } = view
    const stage = progress?.generation === app.generation ? progress.failedStage : undefined
    setReport(
      [
        'StackNest 应用排障信息',
        `界面版本：${__STACKNEST_BUILD__.version} (${__STACKNEST_BUILD__.revision})`,
        `应用：${app.name} (${app.slug})`,
        `应用 ID：${app.id}`,
        `任务代次：${app.generation}`,
        `当前配置镜像：${app.image}（失败后可能已恢复旧版）`,
        `配置更新时间：${app.updatedAt}`,
        `任务状态：${app.status}${stage ? ` / ${stage}` : ''}`,
        `失败摘要：${app.error || '见下方失败详情'}`,
        '',
        '本次失败快照（镜像与启动参数以此处为准；已隐藏平台已知配置值）：',
        text,
      ].join('\n'),
    )
    setCopyFailed(false)
  }

  // copy 剪贴板拒绝时保留预览供手动复制，不上传报告。
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(report)
      setCopyFailed(false)
      void messageAPI.success('排障信息已复制')
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <>
      {context}
      <Button disabled={disabled} onClick={preview}>
        复制排障信息
      </Button>
      <Modal
        open={!!report}
        title="预览排障信息"
        width={760}
        onCancel={() => setReport('')}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setReport('')}>关闭预览</Button>
            <Button type="primary" onClick={() => void copy()}>
              确认复制
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-muted">
          包含本次失败详情和应用信息，可发给 AI 或开发者排查。分享前检查日志是否含业务隐私。
        </p>
        <Input.TextArea
          aria-label="排障信息预览"
          value={report}
          readOnly
          rows={14}
          onFocus={(event) => event.currentTarget.select()}
        />
        {copyFailed && (
          <Alert
            className="mt-3"
            type="warning"
            showIcon
            title="浏览器未允许复制，点击上方文本选中后手动复制即可。"
          />
        )}
      </Modal>
    </>
  )
}
