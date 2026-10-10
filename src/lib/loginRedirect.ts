const storageKey = 'stacknest:returnTo'
let memoryTarget: string | null = null

// rememberLoginTarget 保存登录前的页面，浏览器拒绝存储时保留当前页内的返回目标。
export function rememberLoginTarget(path: string) {
  memoryTarget = path
  try {
    sessionStorage.setItem(storageKey, path)
  } catch {
    /* 会话存储不是登录的前提。 */
  }
}

// clearLoginTarget 清除返回目标；浏览器存储失败不影响已完成的退出登录。
export function clearLoginTarget() {
  memoryTarget = null
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    /* 服务端会话撤销仍然有效。 */
  }
}

// consumeLoginTarget 登录成功后消费返回目标，仍由调用方验证路由及用户权限。
export function consumeLoginTarget() {
  let target = memoryTarget
  try {
    target ??= sessionStorage.getItem(storageKey)
  } catch {
    /* 使用当前页面保存的目标或默认项目页。 */
  }
  clearLoginTarget()
  return target ?? '/projects'
}
