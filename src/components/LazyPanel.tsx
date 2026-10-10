import { Component, Suspense, type ReactNode } from 'react'
import { Alert, Button, Spin } from 'antd'

// LazyPanel 提供模块加载反馈，旧页面加载失败时允许手动刷新。
export default class LazyPanel extends Component<
  { children: ReactNode; floating?: boolean },
  { failed: boolean }
> {
  state = { failed: false }

  // getDerivedStateFromError 将模块下载或渲染错误转为可恢复提示。
  static getDerivedStateFromError() {
    return { failed: true }
  }

  // render 保留外层导航，避免单个模块失败后整个应用白屏。
  render() {
    const wrapper = this.props.floating
      ? 'fixed right-4 bottom-4 left-4 z-50 rounded-xl bg-panel p-4 shadow-panel sm:left-auto'
      : 'py-8'
    if (this.state.failed) {
      return (
        <div className={wrapper}>
          <Alert
            type="error"
            showIcon
            title="页面加载失败"
            description="请检查网络，或刷新页面加载最新版本。"
            action={<Button onClick={() => window.location.reload()}>刷新页面</Button>}
          />
        </div>
      )
    }
    return (
      <Suspense
        fallback={
          <div className={`${wrapper} flex items-center justify-center gap-3`} role="status">
            <Spin />
            正在加载…
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    )
  }
}
