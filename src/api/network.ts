import { http } from '../lib/http'
import type { NetworkConfig, NetworkView } from '../types/network'

// getNetwork 获取超管可见的实际宿主网络配置。
export async function getNetwork() {
  const { data } = await http.get<NetworkView>('/api/network', { timeout: 30_000 })
  return data
}

// updateNetwork 携带读取版本，避免覆盖其他维护者刚保存的配置。
export async function updateNetwork(config: NetworkConfig, expectedRevision: string) {
  const { data } = await http.put<NetworkView>(
    '/api/network',
    { config, expectedRevision },
    { timeout: 30_000 },
  )
  return data
}
