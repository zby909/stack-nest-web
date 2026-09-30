# StackNest Web

StackNest 管理端基于 Vite 官方 `react-ts` 模板创建，与 Go API 分别开发。当前支持邮件验证码登录、项目上传与管理、操作日志，以及管理员维护普通用户邮箱和查看服务器状态；接口契约由 server 仓库的 `openapi/openapi.yaml` 维护。纯 HTML 视觉探索稿保留在 `stacknest-html-design-neutral/`，不参与构建，也不作为验收依据。

普通用户只看到自己的项目和相关日志；管理员可以管理全部项目、查看项目所属邮箱及服务器状态。已发布的站点链接仍是公开的。

文档入口：[需求与验收](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md) · [Web 构建与部署](docs/DEPLOYMENT.md) · [后端与联合部署](https://github.com/zby909/stack-nest-server/blob/main/docs/DEPLOYMENT.md)。

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

服务端数据通过 Axios 访问，不在组件里直接创建独立 HTTP client。`AuthGate` 先查询服务端会话，再显示登录页或管理界面；会话只保存在服务端和 HttpOnly Cookie 中，前端不存储令牌。固定页面使用浏览器 History API 路由：`/login`、`/projects`、`/activity`、`/users`、`/system`，支持直接打开和前进、后退；无需额外路由或全局状态库。普通用户访问管理员页面会返回项目页，后台 API 另行执行权限校验。

## 样式约定

- 页面布局、间距、排版和响应式使用 Tailwind 工具类；重复 UI 通过 React 组件复用，例如 `src/components/StatCard.tsx`。
- `src/index.css` 是唯一全局样式入口，使用 v4 的 `@theme` 管理颜色、字号、圆角、阴影和断点。`desktop` 为 56.25rem（默认字号下为 900px），样式按移动端优先编写。
- 少量语义样式使用原生 CSS、CSS 变量和嵌套，放入合适的 `@layer`；避免重复的 `@apply` 封装和全局覆盖组件内部选择器。
- Ant Design 的控件外观优先通过 `ConfigProvider` token 和组件公开 API 配置。`StyleProvider layer` 与 `theme, base, antd, components, utilities` 层级配合，避免 Preflight 和组件样式冲突，无需 `!important`。
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

## 质量检查

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
