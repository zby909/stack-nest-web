import { useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Checkbox, Form, Input, Modal, Spin } from 'antd'
import { addUser, deleteUser, listUsers } from '../api/users'
import type { AuthUser } from '../types/auth'

// UserManagement 允许管理员维护可登录邮箱列表。
function UserManagement() {
  const [form] = Form.useForm<{ email: string }>()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [addTarget, setAddTarget] = useState<string | null>(null)
  const [addError, setAddError] = useState('')
  const [sendInvitation, setSendInvitation] = useState(false)
  const [invitationLoginUrl, setInvitationLoginUrl] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'warning'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)

  // 从后端刷新当前白名单。
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listUsers()
      setUsers(result.users)
      setInvitationLoginUrl(result.invitationLoginUrl ?? '')
      if (!result.invitationLoginUrl) setSendInvitation(false)
    } catch {
      setError('用户列表加载失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // openAddConfirmation 校验邮箱后打开确认弹窗，每次都默认不发送邀请。
  const openAddConfirmation = ({ email }: { email: string }) => {
    if (saving || loading) return
    setAddTarget(email.trim())
    setAddError('')
    setSendInvitation(false)
    setError('')
    setNotice(null)
  }

  // closeAddConfirmation 取消时保留输入的邮箱，不创建用户或发送邮件。
  const closeAddConfirmation = () => {
    if (saving) return
    setAddTarget(null)
    setAddError('')
    setSendInvitation(false)
  }

  // 添加普通用户并按本次勾选尝试邀请，发信失败时仍展示已添加的邮箱。
  const handleAdd = async () => {
    if (saving || loading || !addTarget) return
    setSaving(true)
    setAddError('')
    setNotice(null)
    try {
      const user = await addUser(addTarget, sendInvitation)
      setUsers((current) => [...current, user])
      form.resetFields()
      setAddTarget(null)
      setSendInvitation(false)
      if (user.invitation === 'failed') {
        setNotice({
          type: 'warning',
          text: `${user.email} 已添加，但邀请邮件未能确认发送。请手动告知对方登录地址，无需重复添加邮箱。`,
        })
      } else {
        setNotice({
          type: 'success',
          text:
            user.invitation === 'sent'
              ? `${user.email} 已添加，邀请邮件已发送。若对方未收到，请检查垃圾邮件。`
              : `${user.email} 已添加，请告知对方登录地址。`,
        })
      }
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
        setAddError(
          requestError.response?.data?.error ??
            (requestError.response
              ? '添加邮箱失败'
              : '连接中断，无法确认添加和邀请结果；请刷新邮箱列表后再操作。'),
        )
      } else {
        setAddError('添加邮箱失败')
      }
    } finally {
      setSaving(false)
    }
  }

  // 移除普通用户；后端撤销会话并将其项目转交管理员。
  const handleDelete = async () => {
    if (!deleteTarget || saving) return
    setSaving(true)
    setError('')
    setNotice(null)
    try {
      await deleteUser(deleteTarget.id)
      setUsers((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('删除邮箱失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">登录邮箱</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted sm:text-xs">
            普通用户管理自己的项目，管理员可管理所有项目和邮箱。
          </p>
        </div>
        <Button
          className="h-11 shrink-0 sm:h-8"
          onClick={() => void refresh()}
          disabled={loading || saving}
        >
          刷新
        </Button>
      </div>
      {error && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          title={error}
          closable
          onClose={() => setError('')}
        />
      )}
      {notice && (
        <Alert
          className="mt-4"
          type={notice.type}
          showIcon
          title={notice.text}
          closable
          onClose={() => setNotice(null)}
        />
      )}
      <Form<{ email: string }>
        form={form}
        className="mt-5 grid gap-x-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        onFinish={openAddConfirmation}
        disabled={saving}
      >
        <Form.Item
          className="mb-3 min-w-0 sm:mb-0"
          name="email"
          rules={[
            { required: true, whitespace: true, message: '请输入邮箱地址' },
            { type: 'email', transform: (value: string) => value.trim(), message: '邮箱格式无效' },
          ]}
        >
          <Input
            aria-label="新用户邮箱"
            size="large"
            type="email"
            autoComplete="off"
            placeholder="添加普通用户邮箱"
          />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          className="h-11 sm:h-10"
          disabled={loading || saving}
        >
          添加邮箱
        </Button>
      </Form>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spin />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {users.map((user) => (
            <div className="flex items-center justify-between gap-3 p-3.5" key={user.id}>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm break-all" title={user.email}>
                  {user.email}
                </strong>
                <span className="mt-1 block text-xs text-dim">
                  {user.role === 'admin' ? '管理员' : '普通用户'} ·{' '}
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')} 加入
                </span>
              </div>
              {user.role === 'user' && (
                <Button
                  danger
                  className="h-11 shrink-0 sm:h-8"
                  disabled={saving}
                  onClick={() => setDeleteTarget(user)}
                >
                  移除
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal
        open={addTarget !== null}
        centered
        title="确认添加邮箱"
        okText={sendInvitation ? '添加并发送邀请' : '确认添加'}
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ className: 'h-11 sm:h-8' }}
        cancelButtonProps={{ disabled: saving, className: 'h-11 sm:h-8' }}
        closable={!saving}
        keyboard={!saving}
        mask={{ closable: !saving }}
        onOk={() => void handleAdd()}
        onCancel={closeAddConfirmation}
      >
        <div className="my-4 rounded-xl bg-subtle p-4">
          <strong className="block text-base break-all">{addTarget}</strong>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            添加为普通用户，可以通过邮箱验证码登录并管理自己的项目。
          </p>
        </div>
        <Checkbox
          className="min-h-11 items-center text-sm"
          checked={sendInvitation}
          disabled={saving || !invitationLoginUrl}
          onChange={(event) => setSendInvitation(event.target.checked)}
        >
          发送邀请邮件
        </Checkbox>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {invitationLoginUrl ? (
            <>
              默认不发送邮件。勾选后会发送登录说明和地址：
              <a
                className="mt-1 block break-all underline underline-offset-2"
                href={invitationLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {invitationLoginUrl}
              </a>
            </>
          ) : (
            '邀请登录地址尚未配置；可以先添加邮箱，再手动告知对方登录地址。'
          )}
        </p>
        {addError && <Alert className="mt-4" type="error" showIcon title={addError} />}
      </Modal>
      <Modal
        open={deleteTarget !== null}
        centered
        title={<span className="break-all">移除 {deleteTarget?.email ?? ''}？</span>}
        okText="移除邮箱"
        cancelText="取消"
        okButtonProps={{ danger: true, className: 'h-11 sm:h-8' }}
        cancelButtonProps={{ disabled: saving, className: 'h-11 sm:h-8' }}
        confirmLoading={saving}
        closable={!saving}
        keyboard={!saving}
        mask={{ closable: !saving }}
        onOk={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      >
        该邮箱将无法继续登录，现有会话会立即失效。其项目会转交管理员，站点仍可访问。
      </Modal>
    </section>
  )
}

export default UserManagement
