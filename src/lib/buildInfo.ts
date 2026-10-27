import type { BuildInfo } from '../types/operations'

export const frontendBuild: BuildInfo = __STACKNEST_BUILD__

// releaseMismatch 只有双方都声明发布版本且不同才提示配套升级。
export function releaseMismatch(frontend: BuildInfo, backend: BuildInfo) {
  return (
    frontend.version !== 'dev' && backend.version !== 'dev' && frontend.version !== backend.version
  )
}
