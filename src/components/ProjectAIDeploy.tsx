import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Modal, message as antdMessage } from 'antd'
import { downloadDeploySkill } from '../api/deployTools'
import { getErrorMessage } from '../lib/format'

const releasesURL = 'https://github.com/zby909/stack-nest-server/releases'
const skillURL = 'https://github.com/zby909/stack-nest-server/tree/main/skills/stacknest-deploy'

// ProjectAIDeploy 提供通用工具下载和本项目的部署说明，不接触部署 Token 原文。
export default function ProjectAIDeploy({ slug, projectId }: { slug: string; projectId: string }) {
  const [open, setOpen] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const [message, messageContext] = antdMessage.useMessage()
  useEffect(() => () => controller.current?.abort(), [])
  const instructions = `使用 stacknest-deploy Skill，把我指定的 HTML / HTM / ZIP / RAR 上传到已有静态项目，先生成预览并返回链接，本次不正式发布。

管理端地址：${window.location.origin}
目标项目标识：${slug}
目标项目 ID：${projectId}

先检查已有配置，调用 CLI 的 status，通过 Token 自动识别项目，并核对返回的 id、slug 与上述目标一致；一致即可继续，不用再问项目名称或 slug。不一致时停止，不向其他项目上传。
只询问缺失的 Token 文件路径和 CLI 路径；未安装 CLI 时可协助从官方发布页下载对应系统、架构的版本并校验 SHA-256。Token 从私有文件或已有环境变量读取，不输出内容，不写入聊天、Skill 或 Git。
Skill 下载后将 stacknest-deploy 整个目录安装到 AI 工具支持的 Skill 目录；已安装则复用。通用 Skill：${skillURL}
CLI 下载（v1.0.0-rc.2 或更新的兼容版本）：${releasesURL}
使用默认续传记录；已有其他草稿或版本冲突时停止，不自动丢弃或覆盖。保留这次上传返回的 draftId 和 expectedId，供之后确认发布该预览时使用。`

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
          让能操作本机文件和命令行的 AI 上传成品。默认先生成预览，确认后再发布到原网址。
        </p>
        <ol className="mb-5 space-y-4 text-sm">
          <li>
            <p className="font-medium">1. 准备部署 Token</p>
            <p className="mt-1 leading-relaxed text-muted">
              在当前页创建本项目的 Token，保存到仓库外的私有文件，只把文件路径告诉 AI。 已有 Token
              可复用；需要 AI 正式发布时再授予相应权限。
            </p>
          </li>
          <li>
            <p className="font-medium">2. 安装工具（首次使用）</p>
            <div className="my-2 flex flex-wrap gap-2">
              <Button loading={downloading} onClick={() => void download()}>
                下载 Skill
              </Button>
              <Button href={releasesURL} target="_blank" rel="noopener noreferrer">
                下载 CLI ↗
              </Button>
            </div>
            <p className="leading-relaxed text-muted">
              Skill 解压后，将 stacknest-deploy 整个目录放入 AI 工具的 Skill 目录并重新加载。 CLI
              按电脑系统和架构选择并校验配套 .sha256；也可以让 AI 协助安装。已安装可跳过。
            </p>
            {downloadError && (
              <Alert className="mt-2" type="error" showIcon title={downloadError} />
            )}
          </li>
          <li>
            <p className="mb-2 font-medium">3. 复制说明，并告诉 AI 要上传哪个文件</p>
            <Input.TextArea
              aria-label="AI 部署说明"
              value={instructions}
              readOnly
              autoSize={{ minRows: 6, maxRows: 10 }}
              onFocus={(event) => event.target.select()}
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              已填入当前后台地址和项目标识，不含 Token。AI
              须能访问此地址；本机隧道地址只能在同一台电脑使用。
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
