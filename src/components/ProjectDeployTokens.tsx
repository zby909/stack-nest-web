import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Tag,
  message as antdMessage,
} from 'antd'
import {
  createDeployToken,
  listDeployTokens,
  revokeDeployToken,
  type DeployToken,
  type TokenInput,
} from '../api/deployTokens'
import { getErrorMessage } from '../lib/format'

// ProjectDeployTokens 把自动部署凭据放在项目设置内，默认只允许生成预览。
export default function ProjectDeployTokens({ slug }: { slug: string }) {
  const [modal, modalContext] = Modal.useModal()
  const [message, messageContext] = antdMessage.useMessage()
  const [form] = Form.useForm<TokenInput>()
  const [tokens, setTokens] = useState<DeployToken[]>([])
  const [checkedAt, setCheckedAt] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void listDeployTokens(slug, controller.signal)
      .then((values) => {
        if (!controller.signal.aborted) {
          setTokens(values)
          setCheckedAt(Date.now())
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '部署凭据加载失败'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [slug, revision])

  // refresh 在明确操作后重读列表，不轮询或保存任何明文 Token。
  const refresh = () => {
    setError('')
    setLoading(true)
    setRevision((value) => value + 1)
  }
  // create 明文只留在当前弹窗内存，不写 localStorage、URL 或日志。
  const create = async (values: TokenInput) => {
    setCreating(true)
    setError('')
    try {
      const result = await createDeployToken(slug, { ...values, canPublish: !!values.canPublish })
      setSecret(result.secret)
      setTokens((current) => [result.token, ...current])
      form.resetFields()
    } catch (failure) {
      setError(
        getErrorMessage(failure, '创建失败；若响应中断，请刷新列表并撤销无法读取的凭据后重建'),
      )
    } finally {
      setCreating(false)
    }
  }
  // closeSecret 明确提示一次性展示，确认后立即清除内存中的凭据。
  const close = () => {
    if (creating) return
    if (!secret) {
      form.resetFields()
      setOpen(false)
      return
    }
    modal.confirm({
      title: '已保存部署 Token？',
      content: '关闭后无法再次查看。请保存到本机私有文件或 GitHub Actions Secret。',
      okText: '已保存，关闭',
      cancelText: '继续查看',
      onOk: () => {
        setSecret('')
        setOpen(false)
      },
    })
  }
  // revoke 确认后撤销指定凭据，失败时保留可再次操作的列表。
  const revoke = (token: DeployToken) => {
    modal.confirm({
      title: `撤销“${token.name}”？`,
      content: '使用它的脚本将无法继续请求。已发布站点和已经开始处理的发布不会被撤回。',
      okText: '撤销 Token',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await revokeDeployToken(slug, token.id)
          setTokens((current) => current.filter((item) => item.id !== token.id))
        } catch (failure) {
          void message.error(getErrorMessage(failure, '撤销失败'))
          throw failure
        }
      },
    })
  }
  return (
    <div className="border-t border-line pt-5">
      {modalContext}
      {messageContext}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">自动部署</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            让本机脚本、AI 或 GitHub Actions 上传新预览。每个 Token 仅用于本项目，最多保留 10 个。
          </p>
        </div>
        <Button
          className="h-11 sm:h-8"
          disabled={loading || tokens.length >= 10}
          onClick={() => {
            setError('')
            setOpen(true)
          }}
        >
          创建部署 Token
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted">
        <a
          href="https://github.com/zby909/stack-nest-server/blob/main/docs/AUTOMATION.md"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          查看命令行与 GitHub Actions 教程 ↗
        </a>
        <span> · 上传预览不改变正式站点；预览地址可被持有链接的人访问。</span>
      </p>
      {error && !open && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={refresh}>重试</Button>}
        />
      )}
      {loading ? (
        <Spin size="small" />
      ) : !tokens.length ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有部署 Token" />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line px-3">
          {tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium break-all">{token.name}</span>
                  <Tag>{token.canPublish ? '预览 + 正式发布' : '仅预览'}</Tag>
                  {Date.parse(token.expiresAt) <= checkedAt && <Tag color="default">已过期</Tag>}
                </div>
                <p className="mt-2 text-xs break-all text-muted">
                  到期 {new Date(token.expiresAt).toLocaleString('zh-CN')} · 创建者{' '}
                  {token.createdBy}
                </p>
                <p className="mt-1 text-xs text-muted">
                  最近使用：
                  {token.lastUsedAt
                    ? new Date(token.lastUsedAt).toLocaleString('zh-CN')
                    : '尚未使用'}
                </p>
              </div>
              <Button danger className="h-11 sm:h-8" onClick={() => revoke(token)}>
                撤销
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        title={secret ? '保存部署 Token' : '创建部署 Token'}
        open={open}
        onCancel={close}
        footer={secret ? <Button onClick={close}>已保存，关闭</Button> : null}
        destroyOnHidden
        mask={{ closable: false }}
      >
        {secret ? (
          <div className="space-y-4">
            <Alert
              type="warning"
              showIcon
              title="仅显示一次，请立即保存"
              description="不要发到聊天、写进代码或提交到 Git。丢失后请撤销并重新创建。"
            />
            <Input.TextArea
              aria-label="部署 Token"
              readOnly
              value={secret}
              autoSize={{ minRows: 2, maxRows: 4 }}
              className="font-mono"
            />
            <Button
              onClick={() => {
                if (!navigator.clipboard) {
                  void message.warning('无法自动复制，请在文本框中手动复制')
                  return
                }
                void navigator.clipboard.writeText(secret).then(
                  () => message.success('已复制'),
                  () => message.warning('无法自动复制，请在文本框中手动复制'),
                )
              }}
            >
              复制 Token
            </Button>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ expiresInDays: 30, canPublish: false }}
            onFinish={(values) => void create(values)}
          >
            <Form.Item
              name="name"
              label="用途名称"
              rules={[{ required: true, whitespace: true, message: '请填写名称' }, { max: 60 }]}
            >
              <Input
                placeholder="例如：本机 AI / GitHub Actions"
                maxLength={60}
                disabled={creating}
              />
            </Form.Item>
            <Form.Item name="expiresInDays" label="有效期">
              <Select
                disabled={creating}
                options={[
                  { value: 30, label: '30 天' },
                  { value: 90, label: '90 天' },
                  { value: 365, label: '1 年' },
                ]}
              />
            </Form.Item>
            <Form.Item name="canPublish" valuePropName="checked">
              <Checkbox disabled={creating}>允许正式发布</Checkbox>
            </Form.Item>
            <p className="mb-4 text-xs leading-relaxed text-muted">
              默认只能上传预览。勾选后脚本可通过单独的发布命令更新正式站点，无需再登录后台确认。
            </p>
            {error && <Alert className="mb-4" type="error" showIcon title={error} />}
            <Button type="primary" htmlType="submit" loading={creating}>
              创建
            </Button>
          </Form>
        )}
      </Modal>
    </div>
  )
}
