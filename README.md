# file-peek 👀

> 昵称 `file-peek` · 正式仓库/npm 名 `dsh-file-preview`

![file-peek 吉祥物：粉发女仆抱着一摞书快摔倒](assets/github-social-preview.png)

抱书女仆帮你偷瞄工作区 —— DeepSeek Harness 的「悬浮文件预览窗口」插件（宿主 Typert Remote 服务 + 浏览器客户端悬浮窗）。

## 功能演示

<table>
  <tr>
    <td align="center" width="50%">
      <img src="assets/btnPos.gif" alt="点会话头按钮打开悬浮预览窗" />
      <br /><strong>一键唤出</strong>
      <br />会话头部按钮打开悬浮窗
    </td>
    <td align="center" width="50%">
      <img src="assets/change.gif" alt="拉动边缘调整悬浮窗宽高" />
      <br /><strong>拖改大小</strong>
      <br />拉动边缘调整悬浮窗宽高
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="assets/write.gif" alt="在悬浮窗里编辑并保存文件" />
      <br /><strong>预览也能改</strong>
      <br />切编辑，保存写回工作区
    </td>
    <td align="center" width="50%">
      <img src="assets/clickOpen.gif" alt="点会话里的文件路径打开预览" />
      <br /><strong>对话里偷瞄</strong>
      <br />点路径进预览，不唤系统打开
    </td>
  </tr>
</table>

## 安装

只需一条命令（pnpm 会自动把客户端依赖一起装上）：

```powershell
dsh plugin --profile web add @undeadsheep/dsh-file-preview
```

装完启动 / 重启 Web：

```powershell
dsh web
```

打开页面后，点会话头部右上角的「文件预览」按钮，即可打开悬浮预览窗口。

## 卸载

```powershell
dsh plugin --profile web remove @undeadsheep/dsh-file-preview
```

移除后重启 `dsh web` 生效。

## 功能

- **悬浮预览窗口**：会话头部按钮唤出，可拖动、调大小、折叠侧边栏。
- **文件树**：递归列出工作区（目录在前、文件在后），自动跳过 `node_modules` / `.git` / `.next` 等重目录，并有 5000 节点上限——大仓库也不卡。
- **文本预览 + 编辑**：只读预览（代码带轻量语法高亮），切「编辑」可改文本并保存（`Ctrl+S`）。编辑态支持回车自动缩进、Tab 缩进、自动闭合引号/括号；撤销重做走浏览器原生 `Ctrl+Z` / `Ctrl+Y`。
- **Markdown 渲染**：`react-markdown` + GFM（表格 / 任务列表 / 删除线），原生 HTML 经 `rehype-sanitize` 白名单过滤；本地相对路径图片自动内联预览。
- **图片懒加载 + 缓存**：md 里的本地图片滚动到视口附近（提前 200px）才读取；解析结果按字节预算缓存（16MB，淘汰最老），不重复请求、不闪烁。
- **主题与配置**：工作区根目录放 `preview-theme.json` 自定义 8 种高亮色 + 背景/前景（缺省回退 `.vscode/settings.json`，再回退内置默认）；`preview.config.json` 可配缩进 / 字号 / 轮询间隔。详见[宿主包 README](packages/dsh-file-preview/README.md)。

## 目录结构

```
├── packages/
│   ├── dsh-file-preview/              # 宿主：Typert Remote 服务 + 组合包清单
│   │   ├── src/                       #   宿主源码
│   │   ├── cordis.patch.yml           #   dsh.bundle 层（插入 file-preview + ui-file-preview 两行）
│   │   └── package.json / tsconfig.json
│   ├── dsh-client-ui-file-preview/    # 客户端：浏览器悬浮窗 UI
│   │   ├── src/                       #   客户端源码（含 CSS Module）
│   │   └── package.json / tsconfig.json / tsdown.config.ts
│   └── dsh-typert-protocol/           # vendor 的协议源码（仅构建期，让 typert 生成器识别 @Remote）
├── build/                             # vendor 的构建辅助（clientBundle 预设 + platform 清单）
├── tsconfig.{base,base.client,host,client}.json
├── tsdown.config.ts                   # 根构建（workspace 模式，跑 Typert 代码生成）
├── scripts/                           # dev.mjs 一键开发脚本
├── assets/  test-fixtures/
└── LICENSE / THIRD_PARTY_NOTICES.md
```

## 开发（本仓库即源码，可独立构建）

本仓库是**自包含的插件源码仓库**。装依赖并构建：

```powershell
pnpm install
pnpm build        # = build:host + build:client
```

构建流程（产物 `packages/*/lib/`）：

1. `tsc -b` 编译各包 `src/` → `lib/types/`（类型声明 + 编译 JS）。
2. `tsdown --env.DSH_BUILD_FACE host`：打包宿主 `lib/index.js`，并跑 Typert 代码生成，产出 `typert.host.js` + `typert.remote-client.js`。
3. `tsdown --env.DSH_BUILD_FACE client`：出浏览器 bundle `lib/client.js`（CSS Module 内联 + `__ModuleLoader__` 包装）。

## 本地验证（一键）

改完源码后，一条命令构建 + 打包 + 装进干净的 dsh profile 并自动起 `dsh web`（自动处理「测试形态」的客户端依赖）：

```powershell
pnpm dev
```

启动后浏览器访问 `http://127.0.0.1:3090` 看效果（Ctrl+C 停止）。换端口用 `pnpm dev --port 3091`；只想构建+安装、不自动起服务用 `pnpm dev --no-start`（会打印带 `DSH_HOME` 的手动启动命令）。

> 装好的 profile 在 `%TEMP%\dsh-dev-profile`；整个过程不改动仓库的「发布形态」，只在你本地临时切换。
>
> ⚠️ 手动起服务时必须带上同一个 `DSH_HOME`（见 `--no-start` 打印的命令），否则 `dsh web` 读的是 `~/.dsh`
> ——那里没有本插件，就会「看不到文件预览按钮」。

## 发布到 npm

1. bump 版本：两个 `packages/*/package.json` 的 `version` 一起改成同一个版本号（例如 `0.1.0-rc.3`）。
2. 构建：`pnpm build`。
3. 发布（**先客户端后宿主**，因为宿主依赖客户端）：

   ```powershell
   Set-Location .\packages\dsh-client-ui-file-preview; pnpm publish --access public --tag latest
   Set-Location .\packages\dsh-file-preview;        pnpm publish --access public --tag latest
   ```

   > 用 `pnpm publish` 而不是 `npm publish`：宿主 `package.json` 里的客户端依赖写的是
   > `workspace:^`，`pnpm publish` 会自动把它转成 `^<version>` 再上传（本地 `pnpm pack`
   > 也是同样的转换）。发布后核对：
   >
   > ```powershell
   > npm view @<YourNpmName>/dsh-file-preview dependencies
   > ```
   >
   > 客户端依赖应是 `^<version>`，不能是 `workspace:^`。
   >
   > prerelease 也带 `--tag latest`（本插件尚未发过 stable，`latest` 即最新 rc）。

## 作者与许可

- 作者：UndeadSheep
- 许可：[MIT](LICENSE)。
- 第三方声明：[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
