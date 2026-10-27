// 同时声明扩展名和 MIME，兼容手机文件选择器按内容类型过滤文件的行为。
export const siteUploadAccept =
  '.zip,.rar,.html,.htm,text/html,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed'

// supportedSiteFile 统一创建、更新与恢复上传的文件类型判断。
export function supportedSiteFile(name: string): boolean {
  return /\.(zip|rar|html?)$/i.test(name)
}
