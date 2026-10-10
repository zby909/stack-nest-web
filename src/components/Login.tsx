import { useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Form, Input } from 'antd'
import { requestLoginCode, verifyLoginCode } from '../api/auth'
import type { AuthUser } from '../types/auth'
import ThemeSwitcher from './ThemeSwitcher'

interface LoginProps {
  onLogin: (user: AuthUser) => void
}

// Login 提供两步式邮件验证码登录表单。
function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resendAt, setResendAt] = useState<Record<string, number>>({})
  const [now, setNow] = useState(() => Date.now())
  const emailKey = email.trim().toLowerCase()
  const remaining = Math.max(0, Math.ceil(((resendAt[emailKey] ?? 0) - now) / 1000))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // 请求验证码时统一提示，不显示邮箱是否已在登录名单中。
  const handleRequestCode = async () => {
    if (busy || remaining > 0) return
    setBusy(true)
    setError('')
    try {
      await requestLoginCode(email.trim())
      const receivedAt = Date.now()
      setNow(receivedAt)
      setResendAt((previous) => ({ ...previous, [emailKey]: receivedAt + 60_000 }))
      setSent(true)
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
        setError(requestError.response?.data?.error ?? '验证码发送失败')
      } else {
        setError('验证码发送失败')
      }
    } finally {
      setBusy(false)
    }
  }

  // 验证数字验证码并进入管理端。
  const handleVerify = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onLogin(await verifyLoginCode(email.trim(), code.trim()))
    } catch (requestError) {
      if (axios.isAxiosError<{ error?: string }>(requestError)) {
        setError(requestError.response?.data?.error ?? '登录失败')
      } else {
        setError('登录失败')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <section className="page-enter w-full max-w-md rounded-panel border border-line bg-panel p-5 shadow-panel sm:p-9">
        <div className="mb-7 flex items-center justify-between gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-ink text-lg font-bold text-panel">
            S
          </div>
          <ThemeSwitcher />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">登录 StackNest</h1>
        <p className="mt-2 text-sm text-muted">使用已获准的邮箱接收一次性验证码。</p>
        {error && <Alert className="mt-5" type="error" showIcon title={error} />}
        {sent && (
          <Alert
            className="mt-5"
            type="info"
            showIcon
            title="如果邮箱在登录名单中，验证码将发送至该邮箱。验证码 10 分钟内有效。"
          />
        )}
        <Form
          layout="vertical"
          className="mt-6"
          onFinish={() => void (sent ? handleVerify() : handleRequestCode())}
        >
          <Form.Item label="邮箱地址" required>
            <Input
              size="large"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              disabled={busy || sent}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </Form.Item>
          {sent && (
            <Form.Item label="8 位验证码" required>
              <Input
                size="large"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                disabled={busy}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="请输入邮件中的验证码"
              />
            </Form.Item>
          )}
          <Button
            block
            type="primary"
            htmlType="submit"
            size="large"
            loading={busy}
            disabled={!email.trim() || (sent ? code.length !== 8 : remaining > 0)}
          >
            {sent ? '登录' : remaining > 0 ? `${remaining} 秒后重发` : '发送验证码'}
          </Button>
          {sent && (
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
              <Button
                type="link"
                className="min-h-11"
                size="small"
                disabled={busy}
                onClick={() => {
                  setSent(false)
                  setCode('')
                  setError('')
                }}
              >
                更换邮箱
              </Button>
              <Button
                type="link"
                className="min-h-11"
                size="small"
                disabled={busy || remaining > 0}
                onClick={() => void handleRequestCode()}
              >
                {remaining > 0 ? `${remaining} 秒后重发` : '重新发送'}
              </Button>
            </div>
          )}
        </Form>
      </section>
    </main>
  )
}

export default Login
