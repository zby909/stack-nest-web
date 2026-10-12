import { useState } from 'react'
import { Alert, Modal } from 'antd'
import { changeUserRole } from '../api/users'
import { getErrorMessage } from '../lib/format'
import type { AuthUser } from '../types/auth'

// UserRoleModal 明示权限变化和重新登录要求，出错时保留确认内容。
export default function UserRoleModal({
  target,
  onClose,
  onSaved,
}: {
  target: AuthUser
  onClose: () => void
  onSaved: (user: AuthUser) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const role = target.role === 'user' ? 'admin' : 'user'
  // save 使用页面读取的原角色，冲突时要求刷新而不覆盖。
  const save = async () => {
    if (saving || target.role === 'superadmin') return
    setSaving(true)
    setError('')
    try {
      onSaved(await changeUserRole(target.id, role, target.role))
    } catch (failure) {
      setError(getErrorMessage(failure, '无法确认角色变更结果，请刷新用户列表检查后再操作。'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      centered
      title={role === 'admin' ? '设为管理员？' : '撤销管理员权限？'}
      okText="确认调整角色"
      cancelText="取消"
      confirmLoading={saving}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
      onCancel={onClose}
      onOk={() => void save()}
    >
      <p className="my-4 font-semibold break-all">{target.email}</p>
      <p className="text-sm leading-relaxed">
        {role === 'admin'
          ? '将可管理所有用户的项目、普通用户邮箱，并查看服务器信息。'
          : '将仅能管理自己拥有的项目，无法管理其他用户和查看服务器信息。'}
      </p>
      <p className="mt-3 text-sm text-muted">
        项目归属保持不变。原有登录会话和验证码会失效，该用户需要重新获取验证码登录。
      </p>
      {error && <Alert className="mt-4" type="error" showIcon title={error} />}
    </Modal>
  )
}
