import { useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Form, Input, Modal, Spin } from 'antd'
import { addUser, deleteUser, listUsers } from '../api/users'
import type { AuthUser } from '../types/auth'

// UserManagement 允许管理员维护可登录邮箱列表。
function UserManagement() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)

  // 从后端刷新当前白名单。
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await listUsers())
    } catch {
      setError('用户列表加载失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // 添加普通用户；新增邮箱的持有人可自行请求登录验证码。
  const handleAdd = async () => {
    setSaving(true)
    setError('')
    try {
      const user = await addUser(email.trim())
      setUsers((current) => [...current, user])
      setEmail('')
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
        setError(requestError.response?.data?.error ?? '添加邮箱失败')
      } else {
        setError('添加邮箱失败')
      }
    } finally {
      setSaving(false)
    }
  }

  // 移除普通用户；后端撤销会话并将其项目转交管理员。
  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    setError('')
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
    <section className="rounded-panel border border-line bg-panel p-4.5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">登录邮箱</h2>
          <p className="mt-1 text-xs text-muted">
            普通用户管理自己的项目，管理员可管理所有项目和邮箱。
          </p>
        </div>
        <Button onClick={() => void refresh()} disabled={loading}>
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
      <Form
        layout="inline"
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onFinish={() => void handleAdd()}
      >
        <Form.Item className="m-0 min-w-0 flex-1">
          <Input
            aria-label="新用户邮箱"
            type="email"
            autoComplete="off"
            placeholder="添加普通用户邮箱"
            value={email}
            disabled={saving}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} disabled={!email.trim()}>
          添加邮箱
        </Button>
      </Form>
      <p className="mt-2 text-caption text-dim">
        添加后告知对方登录地址即可；系统不会自动发送邀请。
      </p>
      {loading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spin />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {users.map((user) => (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5" key={user.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm" title={user.email}>
                  {user.email}
                </strong>
                <span className="mt-1 block text-caption text-dim">
                  {user.role === 'admin' ? '管理员' : '普通用户'} ·{' '}
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')} 加入
                </span>
              </div>
              {user.role === 'user' && (
                <Button danger size="small" disabled={saving} onClick={() => setDeleteTarget(user)}>
                  移除
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal
        open={deleteTarget !== null}
        title={`移除 ${deleteTarget?.email ?? ''}？`}
        okText="移除邮箱"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
        onOk={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      >
        该邮箱将无法继续登录，现有会话会立即失效。其项目会转交管理员，站点仍可访问。
      </Modal>
    </section>
  )
}

export default UserManagement
