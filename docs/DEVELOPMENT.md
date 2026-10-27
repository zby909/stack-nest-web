# 开发约定

## 目录

```text
src/
  api/         # 业务 API
  components/  # 页面与共享组件
  lib/         # 路由、请求、主题
  types/       # API 数据类型
tests/         # 浏览器回归与模拟接口
```

API 以 [Server OpenAPI](https://github.com/zby909/stack-nest-server/blob/main/openapi/openapi.yaml)为准。使用共享 Axios client，服务端执行权限校验。

## 页面与状态

使用 History API，支持深链接、刷新和前后退。新增页面同步维护路由及 AppNavigation 的角色入口。

会话使用 HttpOnly Cookie，不在浏览器保存登录令牌。编辑冲突保留输入并提示刷新。

低频页面和弹窗按需加载，主题切换不重新挂载表单。

## 样式

- Tailwind 处理布局、间距、排版和响应式，使用完整类名。
- `src/index.css` 的 `@theme` 管理语义颜色、字号和断点。
- Ant Design 使用公开 token 和组件 API，避免全局覆盖内部结构。
- 重复界面抽成组件，兼顾浅色、深色、手机和桌面。
- 主按钮至少 44px 高，长文本和弹窗不造成横向溢出。
- 使用 Tailwind Vite 插件与原生 CSS，不采用 SCSS 预处理 Tailwind。

ThemeProvider 统一配色，index.html 在应用加载前恢复主题，避免刷新闪白。

## 检查

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

自动整理用 `pnpm lint:fix` 和 `pnpm format`。行为变更运行 [浏览器回归](TESTING.md)。

`stacknest-html-design-neutral/` 是早期视觉稿，不参与产品构建。
