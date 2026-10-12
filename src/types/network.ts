export interface NetworkException {
  address: string
  port: number
  protocol: 'tcp' | 'udp'
}

export interface NetworkConfig {
  lanInterfaces: string[]
  blockedCIDRs: string[]
  allow: NetworkException[]
  dnsServers: string[]
}

export interface NetworkView {
  config: NetworkConfig
  revision: string
  ready: boolean
  checkedAt: string
  effectiveBlockedCIDRs: string[]
  interfaces: { name: string; addresses: string[]; eligible: boolean }[]
  error?: string
  dnsChanged?: boolean
}
