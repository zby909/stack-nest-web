// 构建时仅注入公开版本信息，不包含运行配置或凭据。
declare const __STACKNEST_BUILD__: {
  version: string
  revision: string
}
