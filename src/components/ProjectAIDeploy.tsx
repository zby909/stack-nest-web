import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, message as antdMessage } from 'antd'
import { downloadDeploySkill } from '../api/deployTools'
import { getErrorMessage } from '../lib/format'

const releasesURL = 'https://github.com/zby909/stack-nest-server/releases'

// ProjectAIDeploy 提供通用工具下载和本项目的部署说明，不接触部署 Token 原文。
export default function ProjectAIDeploy({ slug, projectId }: { slug: string; projectId: string }) {
  const [open, setOpen] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const [message, messageContext] = antdMessage.useMessage()
  useEffect(() => () => controller.current?.abort(), [])
  const instructions = `使用 stacknest-deploy Skill 上传我指定的文件，生成预览并返回链接，暂不正式发布。

后台：${window.location.origin}
项目：${slug}
项目 ID：${projectId}

复用已有配置，只询问缺失项。先用 Token 核对项目，不符或遇到版本冲突时停止；不要输出 Token。其余按 Skill 流程执行。`

  // close 关闭弹窗时取消尚未完成的下载请求。
  const close = () => {
    controller.current?.abort()
    setOpen(false)
  }

  // download 确认收到 ZIP 后才保存，失败时在原弹窗内提示而不跳转到错误页面。
  const download = async () => {
    if (downloading) return
    const active = new AbortController()
    controller.current = active
    setDownloading(true)
    setDownloadError('')
    try {
      const data = await downloadDeploySkill(active.signal)
      if (active.signal.aborted) return
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'stacknest-deploy-skill.zip'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000)
    } catch (failure) {
      if (!active.signal.aborted)
        setDownloadError(getErrorMessage(failure, 'Skill 下载失败，请稍后重试'))
    } finally {
      controller.current = null
      setDownloading(false)
    }
  }

  // copy 仅复制可见的非敏感说明；剪贴板不可用时保留文本供手动选择。
  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(instructions)
      setCopyFailed(false)
      void message.success('已复制，可粘贴给 AI')
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <>
      {messageContext}
      <Button className="h-11 sm:h-8" onClick={() => setOpen(true)}>
        交给 AI 部署
      </Button>
      <Modal
        title="交给 AI 部署"
        open={open}
        width={720}
        onCancel={close}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close}>关闭</Button>
            <Button type="primary" onClick={() => void copy()}>
              复制部署说明
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-muted">
          让 AI 上传文件，先预览，确认后再发布。
        </p>
        <ol className="mb-5 space-y-4 text-sm">
          <li>
            <p className="font-medium">1. 准备 Token</p>
            <p className="mt-1 leading-relaxed text-muted">
              创建或复用本项目的 Token，保存到仓库外的私有文件。只把文件路径告诉 AI。
            </p>
          </li>
          <li>
            <p className="font-medium">2. 首次安装</p>
            <div className="my-2 flex flex-wrap gap-2">
              <Button loading={downloading} onClick={() => void download()}>
                下载 Skill
              </Button>
              <Button href={releasesURL} target="_blank" rel="noopener noreferrer">
                下载 CLI ↗
              </Button>
            </div>
            <p className="leading-relaxed text-muted">
              将 Skill 解压到 AI 工具的 Skill 目录并重新加载。CLI 可让 AI 协助安装；已配置可跳过。
            </p>
            {downloadError && (
              <Alert className="mt-2" type="error" showIcon title={downloadError} />
            )}
          </li>
          <li>
            <p className="mb-2 font-medium">3. 复制给 AI</p>
            <p className="mb-2 leading-relaxed text-muted">
              粘贴以下说明，再告诉 AI 要上传哪个文件，例如「旅行攻略.html」。
            </p>
            <Input.TextArea
              aria-label="AI 部署说明"
              value={instructions}
              readOnly
              autoSize
              onFocus={(event) => event.target.select()}
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              已填入后台和项目信息，不含 Token。请在能访问此后台的电脑上使用。
            </p>
          </li>
        </ol>
        {copyFailed && (
          <Alert
            type="info"
            showIcon
            title="浏览器未允许复制。点击上方说明选中全文，手动复制即可。"
          />
        )}
      </Modal>
    </>
  )
}
