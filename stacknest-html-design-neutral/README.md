# StackNest 界面预览

**浏览截图**　双击 [index.html](index.html) 即可离线浏览。在 GitHub 可以直接点开以下截图，主分支更新后会自动重新生成。

- 静态项目　[项目列表](../docs/images/projects-desktop.png) · [待发布版本](../docs/images/versions-desktop.png) · [手机布局](../docs/images/projects-mobile.png)
- Docker 应用　[应用列表](../docs/images/docker-desktop.png) · [应用详情与资源用量](../docs/images/app-detail-desktop.png)
- 平台管理　[操作日志](../docs/images/activity-desktop.png) · [用户邮箱](../docs/images/users-desktop.png) · [网络设置](../docs/images/network-desktop.png) · [服务器状态与深色主题](../docs/images/system-desktop.png) · [手机登录](../docs/images/login-mobile.png)

**体验交互**　在前端仓库根目录使用 Node.js 24 和项目指定的 pnpm 运行：

```bash
pnpm install --frozen-lockfile
pnpm design
```

打开 [本地管理台](http://127.0.0.1:4176/projects)。默认以示例超管身份浏览，可以打开详情、切换主题、调整窗口宽度。[登录页](http://127.0.0.1:4176/__visual/login)可用 `owner@example.com` 和八位示例验证码 `12345678` 体验。业务数据只读，全部来自本地示例。

交互稿使用 `src/` 中的实际页面，改组件和样式即热更新。图册和两个仓库的项目介绍共用同一组截图。本机刷新截图可运行 `pnpm screenshots`。[浏览器测试说明](../docs/TESTING.md)
