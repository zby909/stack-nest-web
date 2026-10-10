# 自动化回归

在 `web/` 运行。需要 Node.js 24 和 `package.json` 指定的 pnpm。

## 首次准备

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Linux CI 可用 `pnpm exec playwright install --with-deps chromium` 安装系统依赖。浏览器版本随锁定的 Playwright 版本更新，升级依赖后需重新安装。安装步骤会联网。

## 一键检查

```bash
pnpm check
```

依次执行 TypeScript、ESLint、生产构建和浏览器回归，任何一步失败都返回非零退出码。测试自动启动和关闭仅监听 `127.0.0.1:4175` 的预览服务；端口已占用时直接报错，不复用正在运行的开发服务。无需 Go、数据库、真实登录账号或 SMTP 配置。

只运行浏览器用例（仍会先构建）：

```bash
pnpm test:e2e
pnpm test:e2e --project=mobile
pnpm test:e2e tests/projects.spec.ts
```

默认使用 Playwright 配套 Chromium，也可通过 `PLAYWRIGHT_CHANNEL=chrome` 使用本机已安装的 Chrome。两套浏览器配置分别模拟桌面与手机；布局用例另外检查 320、375、390、768、1440px。

## 覆盖范围与边界

- 分片响应丢失、发布响应丢失、暂停后刷新重选原文件、放弃上传；检查实际请求偏移以及只发布一次。
- 项目页恢复入口、创建/更新表单自动回填、服务端真实偏移、同名同大小错误文件拒绝后重选、版本变化拒绝、按账号隔离、过期清理及存储受限降级；文件已传完可不选文件确认，已提交结果不会被新上传暂停误拦截。
- 项目详情深链接、刷新、前后退及项目范围日志；草稿独立保留、预览 URL、发布/丢弃确认、过期版本拒绝与更新说明纯文本显示。
- 版本文件变化清单，以及桌面和 320px 下的明暗主题布局。
- 草稿/当前版/上一版文件目录、跨目录搜索、权限错误反馈、把包含 HTML 的文件名作为纯文本展示。
- 项目合计占用与悬浮/聚焦/点按查看保留版本详情，大小升降序，缺失统计置后，搜索与刷新。
- 编辑校验及过期页面保护、更新和回退后的统计刷新、暂停确认/取消/重试/恢复、ZIP 下载及空间不足错误。
- Docker 应用部署与编辑、敏感配置保留、日志文本安全、删除确认；HTTP 异常与进程状态区分、CPU/内存用量、采样缺失降级及健康路径地址注入拒绝。
- 邮箱添加确认、默认不发邀请、邀请失败反馈、退出确认、普通用户界面限制。
- 日志分页和组合筛选、日期时区、清空条件、备份过期与读取失败提示。
- 按需加载、模块加载失败后的导航，以及窄屏页面与弹窗溢出。
- 浅色/深色/跟随系统、刷新与跨标签页同步、首屏主题、本地存储受限降级、切换后保留草稿；实际计算下拉框选中和悬浮状态的文字对比度（至少 4.5:1）。

`tests/fixtures.ts` 在每个独立浏览器上下文中模拟 API，未定义接口和外部请求会直接失败。不会连接生产 API、写入线上项目或发送邮件；ZIP 夹具是仓库内的两个无敏感信息的示例文件。界面测试验证交互和请求契约，不代替服务端权限检查、真实邮件到达、Cloudflare 或真实 iPhone Safari 验收。

真实 PostgreSQL、ZIP/RAR 解压及后端权限回归由 [Server 检查入口](https://github.com/zby909/stack-nest-server/blob/main/README.md#3-检查与测试) 负责。两边都通过后，再执行部署文档中的环境验收。

## GitHub 自动检查

提交 `.github/workflows/check.yml` 到仓库后，GitHub 会在推送、拉取请求或手动触发时运行同一个 `pnpm check`。在仓库的 **Actions → Web checks** 中看结果；失败时可下载保留 7 天的浏览器报告、截图和轨迹。CI 只读代码，不连接生产环境，不部署、不发送邮件。

自动化测试的重点是固定重要行为，防止后续改动造成回归。例如我们故意让第一个 4 MiB 分片的响应丢失，再检查浏览器查询服务端进度后从 4 MiB 继续，而不是重新上传或重复发布。这些检查不能证明程序完全无错；新发现的问题仍需补成用例，视觉效果和真实网络环境也需人工验收。

## 查看本地失败详情

```bash
pnpm exec playwright show-report
```

HTML 报告在 `playwright-report/`；失败截图、调用轨迹和布局截图在 `test-results/`。两者都不提交或进入 Docker 镜像。轨迹文件可用报告给出的 `playwright show-trace` 命令查看。测试不做自动重试，以便直接暴露不稳定行为。

配置用法参考 [Playwright 配置](https://playwright.dev/docs/test-configuration) 和 [预览服务生命周期](https://playwright.dev/docs/test-webserver)。
