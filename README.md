# StackNest Web

StackNest 面向个人开发者和中小型公司的自托管私有项目管理，由管理员邀请可信成员使用。功能设计优先考虑易部署、易维护、易迁移；后续取舍以 [产品定位与原则](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md#1-目标) 为依据。

StackNest 管理端基于 Vite 官方 `react-ts` 模板创建，与 Go API 分别开发。当前支持邮件验证码登录、项目上传与管理、操作日志，以及管理员维护普通用户邮箱和查看服务器状态；接口契约由 server 仓库的 `openapi/openapi.yaml` 维护。纯 HTML 视觉探索稿保留在 `stacknest-html-design-neutral/`，不参与构建，也不作为验收依据。

普通用户只看到自己的项目和相关日志；管理员可以管理全部项目、查看项目所属邮箱及服务器状态。超管另可配置容器网络及实例资源预算，并在新增邮箱的确认弹窗中选择管理员角色。已发布的站点链接仍是公开的。

项目常用操作为打开与更新；“更多”中可编辑信息、导出 ZIP、暂停/恢复访问、回退及删除。暂停保留文件和版本，更新不会解除暂停。日志在服务端按项目、类型、结果、邮箱、日期与关键词查询并分页。需要配套 API 0.10.0，所有项目操作沿用归属限制。

项目列表只显示文件大小合计；悬浮信息图标可查看草稿、当前版和上一版的大小、文件数，键盘聚焦或手机点按也可查看。可按更新时间或保留版本合计占用排序。没有上一版时详情显示“无”；统计失败时显示“统计暂不可用”，不会按零排序。点击“刷新项目”重新读取。这里不包含数据库、日志、备份及临时文件，也不等同于磁盘分配的实际块数。

登录页和导航栏提供外观切换：浅色、深色、跟随系统，默认跟随系统。选择保存在当前浏览器并同步到其他标签页，刷新和退出登录后仍保留。浏览器禁止本地存储时，当前页面仍可切换，但刷新后恢复跟随系统。

登录、管理页和低频弹窗按需加载；模块下载失败提示手动刷新。发布时完整更新同一次构建的 `dist`。

管理员输入邮箱并点击“添加邮箱”后，在确认弹窗中选择是否发送邀请邮件，默认不勾选；超管还可选择普通用户或管理员角色，每次打开默认普通用户；取消时保留输入且不添加用户、不发邮件。邀请使用后端配置的固定 HTTPS 登录地址。页面分别反馈添加和发信结果，发信失败时用户仍已添加。

文档入口：[完整文档导航](https://github.com/zby909/stack-nest-server/blob/main/docs/README.md) · [Docker Compose 首次部署](https://github.com/zby909/stack-nest-server/blob/main/docs/GETTING_STARTED.md) · [家用电脑 Cloudflare Tunnel](https://github.com/zby909/stack-nest-server/blob/main/docs/HOME_SERVER_TUNNEL.md) · [需求与验收](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md) · [Web 构建与部署](docs/DEPLOYMENT.md) · [后端与联合部署](https://github.com/zby909/stack-nest-server/blob/main/docs/DEPLOYMENT.md)。

## 技术栈

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4（官方 Vite 插件）
- Axios
- Ant Design 6
- ESLint 10
- Prettier 3

## 目录约定

```text
src/
  api/        # 按业务模块封装 API 调用
  components/ # 复用的界面组件
  lib/        # Axios 等基础设施
  types/      # 共享 TypeScript 类型
  App.tsx     # 项目、日志、邮箱与服务器状态界面
```

服务端数据通过 Axios 访问，不在组件里直接创建独立 HTTP client。`AuthGate` 先查询服务端会话，再显示登录页或管理界面；会话只保存在服务端和 HttpOnly Cookie 中，前端不存储令牌。页面使用浏览器 History API 路由：`/login`、`/projects`、`/activity`、`/users`、`/system`，以及项目详情 `/projects/{slug}/{overview|versions|files|activity|settings}`，支持直接打开和前进、后退；无需额外路由或全局状态库。普通用户访问管理员页面会返回项目页，后台 API 另行执行权限校验。

桌面使用左侧菜单，手机和平板使用顶部导航，由 `AppNavigation` 统一生成入口和管理员权限。页面标题旁只保留当前页面的业务操作，例如部署项目；不重复展示导航按钮。窄屏项目列表使用卡片，主要操作按钮至少 44px 高，长名称、邮箱和归档文件名按需换行。

## 样式约定

- 页面布局、间距、排版和响应式使用 Tailwind 工具类；重复 UI 通过 React 组件复用，例如 `src/components/StatCard.tsx`。
- `src/index.css` 是唯一全局样式入口，使用 v4 的 `@theme` 管理颜色、字号、圆角、阴影和断点。`desktop` 为 56.25rem（默认字号下为 900px），样式按移动端优先编写。
- 少量语义样式使用原生 CSS、CSS 变量和嵌套，放入合适的 `@layer`；避免重复的 `@apply` 封装和全局覆盖组件内部选择器。
- Ant Design 的控件外观优先通过 `ConfigProvider` token 和组件公开 API 配置。`StyleProvider layer` 与 `theme, base, antd, components, utilities` 层级配合，避免 Preflight 和组件样式冲突，无需 `!important`。
- `ThemeProvider` 统一 Ant Design 算法与选中、悬浮状态的对比度；`data-theme` 控制 Tailwind 语义颜色与原生控件的 `color-scheme`。`index.html` 的短脚本在应用加载前恢复外观，防止深色刷新闪白；主题切换不重新挂载表单或弹窗。
- 类名必须以完整字符串出现在源码中，避免拼接 `bg-${color}` 这类无法静态检测的名称。Prettier 插件自动维护 Tailwind 类名顺序。
- Tailwind v4 不支持 Sass/SCSS 预处理集成；本项目不安装 Sass，也不使用 `.scss` 作为 Tailwind 入口。单独编译的遗留 SCSS 虽可输出普通 CSS 共存，仍应作为独立迁移边界处理。
- 使用官方 Vite 插件，不额外配置 Tailwind PostCSS 插件、Autoprefixer 或旧版 `tailwind.config.js`。

参考：[Tailwind Vite 安装](https://tailwindcss.com/docs/installation/using-vite)、[Tailwind 兼容性](https://tailwindcss.com/docs/compatibility)、[Ant Design 样式层级](https://ant.design/docs/react/compatible-style/)。Tailwind v4 的核心浏览器要求为 Chrome 111+、Safari 16.4+、Firefox 128+；项目整体还需满足 Ant Design 的浏览器支持范围。

## 开发

在 `web/` 执行以下命令。建议使用 Node.js 24 和项目声明的 pnpm 10.32.1；先按 [Server 本地开发说明](https://github.com/zby909/stack-nest-server/blob/main/README.md) 启动 PostgreSQL、应用 migration 并运行 Go API。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的 Vite 地址（默认 `http://localhost:5173`），使用后端配置的白名单邮箱接收验证码并登录。开发服务器把管理 API 和 `stack-nest-{slug}.localhost` 预览主机的页面、资源代理到 Go，无需先打包前端。上传页面与后台使用不同来源；后台的 `/sites/` 不再提供项目内容。`/openapi.yaml` 不在管理主机的 Vite 代理范围内，本地请直接访问 Go 的 `http://localhost:8080/openapi.yaml`。

生产构建、API 地址配置、镜像更新与常见问题统一见 [Web 构建与部署](docs/DEPLOYMENT.md)。

上传支持 4 MiB 分片、暂停/继续、放弃及刷新后续传。项目页会提示本浏览器未完成的上传，点击后自动恢复原表单；重新选择原压缩包并校验一致后，按服务端进度继续，任务保留 24 小时。文件已传完时无需重选文件，可直接确认处理结果。恢复信息按账号保存，仅含任务编号和表单等元数据，不保存原文件；本地存储受限时只在当前页面有效。文件 SHA-256 校验使用浏览器 Web Crypto，管理入口须使用 HTTPS 或 localhost。项目“更多 → 查看文件”及详情文件页可选择草稿、当前版或上一版，浏览目录、查看大小并搜索文件路径。

## 版本预览与发布

点击项目名称进入详情：概览、版本、文件、日志、设置各有独立 URL。新建或更新先上传为待发布版，可填写更新说明；先用独立地址预览，再确认正式发布。上传不影响已有正式站点；每个项目保留当前正式版、上一正式版和一个独立草稿。已有草稿时先发布或丢弃，才能继续上传或回退。

版本页可复制预览地址，查看新增、修改、删除文件。内容比较使用摘要，大小不变的修改也会显示。版本预览持有地址即可访问，在版本被清理、丢弃或项目暂停后失效；不要把它当作私密分享。

## 质量检查

首次安装浏览器后，使用仓库内的一键回归入口：

```bash
pnpm exec playwright install chromium
pnpm check
```

它依次完成类型、Lint、生产构建以及桌面/手机浏览器测试。模拟接口不会发送邮件或修改线上数据；测试范围、环境准备和报告见 [自动化回归](docs/TESTING.md)。也可以单独运行：

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

自动修复：

```bash
pnpm lint:fix
pnpm format
```

Docker 应用页位于 /apps，支持仓库镜像地址部署、启停、更新、日志及永久删除。普通用户管理自己的应用，管理员管理全部；配置值不回显，应用数据目录在更新与重启后保留。范围和限制见后端 docs/DOCKER_APPS.md。

超级管理员可在 `/network` 配置 Docker 应用的局域网保护、单 IP/端口例外和公共 DNS。身份由部署配置指定；普通管理员和用户没有此入口。后端未安装 Go 网络服务时会显示不可用，安装说明见后端 `docs/NETWORK_EGRESS.md`。
