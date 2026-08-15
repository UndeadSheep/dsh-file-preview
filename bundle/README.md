# dsh-file-preview-bundle

把「悬浮文件预览窗口」打包成 `dsh plugin add` 组合包。它把 `float-1` 动态插件改成的正式插件
（`file-preview` 宿主 Remote 服务 + `ui-file-preview` 浏览器悬浮窗）组装成两个可分发包。

## 结构

```
dsh-file-preview-bundle/
├── dsh-file-preview/              # 组合包（bundle）+ 宿主服务
│   ├── package.json               # 声明 dsh.bundle.patch
│   ├── cordis.patch.yml           # 插入 file-preview + ui-file-preview 两行
│   └── lib/                       # 宿主 Remote 服务 + Typert 产物（typert.host / remote / types）
├── dsh-client-ui-file-preview/    # 客户端 UI 包（组合包的普通依赖，无 dsh.bundle）
│   ├── package.json               # 声明 dsh.client
│   └── lib/                       # 浏览器 bundle（lib/client.js）+ 节点空 apply + 类型
└── assemble-bundle.ps1            # 从 monorepo 构建产物组装 + 改名
```

与内置 `dsh-web-app` 组合包的宿主/客户端双行结构一致：

- `dsh-file-preview` 是**组合包**：`dsh.bundle` 指向 `cordis.patch.yml`，后者同时插入宿主行
  （`file-preview`，本包）和客户端行（`ui-file-preview`，依赖包）。
- `dsh-client-ui-file-preview` 是**客户端包**：没有 `dsh.bundle`，只有 `dsh.client`；它作为组合包的
  `dependencies` 被 pnpm 安装，modules 节点半区扫描到 `dsh.client` 行后把它的 `/client` bundle
  注入 `window.__DSH_BOOT__`。

## 改名（@deepseek-ai → @undeadsheep）

构建产物里烘焙了包名（Typert `typeSymbol`、客户端 bundle `id`、CSS tag、manifest 的 `package`
字段等），构建时写死。本仓库用 `@undeadsheep/*` 作用域，`assemble-bundle.ps1` 用**精确字符串替换**
完成改名。两个包名互不为前缀，替换安全；`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis`、
`@deepseek-ai/schemastery` 等内置依赖名不受影响（它们不是替换目标）。

## 从 monorepo 重建

在 `E:\Projects\deepseek-harness` 里：

```powershell
pnpm --filter @deepseek-ai/dsh-file-preview build
pnpm --filter @deepseek-ai/dsh-client-ui-file-preview build
& E:\DSHProjects\P_plugin\dsh-file-preview-bundle\assemble-bundle.ps1
```

`assemble-bundle.ps1` 把 `lib/` 复制进两个包目录并做改名。

## 安装 / 测试

需要一个**不含本插件**的官方 `dsh` CLI（否则会与内置同名包冲突；你的 fork 构建已内置这两个包，
不适合做「从外部安装」的测试）。

> 为什么 fork 里测不了：内置 `dsh-web-app` 的 `cordis.patch.yml` 已经插入了 `file-preview` /
> `ui-file-preview` 两行，且 patch 的 override 形式会因 `name` 不匹配而跳过（`vendor/include` 里
> `name mismatch ... skipping`），所以本组合包无法干净地覆盖内置行，会重复挂载 `filePreview` 服务。
>
> 两个可行路径：
> - **装官方 CLI（推荐，最接近真实用户）**：`npm i -g @deepseek-ai/dsh`（独立于 fork checkout），
>   再设一个干净的 `DSH_HOME` 测试。
> - **临时改 fork**：把 `packages/bundle/web-app/cordis.patch.yml` 里的 `file-preview` 和
>   `ui-file-preview` 两行注释掉，用 fork 启动测试，测完恢复。

### 本地测试（未发布前）

pnpm 对 `file:`/`link:` 装的包不会用它满足别的包的 semver 范围，所以 bundle 的 `dependencies` 里
**不能**写 `@undeadsheep/dsh-client-ui-file-preview: ^0.1.0-rc.0`（会去 npm 找、404）。本地测试用
「客户端作为顶层依赖单独装 + bundle 不依赖客户端」两步走：

```powershell
cd dsh-file-preview;               pnpm pack   # 产出 undeadsheep-dsh-file-preview-0.1.0-rc.0.tgz
cd ..\dsh-client-ui-file-preview;  pnpm pack   # 产出 undeadsheep-dsh-client-ui-file-preview-0.1.0-rc.0.tgz
cd ..

# 干净的测试 home（和下面 add 同一个窗口）
$env:DSH_HOME = "$env:TEMP\dsh-bundle-test"

# 第一步：先装客户端（顶层依赖，会有 peer 警告 + "无 dsh.bundle" 提示，正常）
dsh plugin --profile web add .\dsh-client-ui-file-preview\undeadsheep-dsh-client-ui-file-preview-0.1.0-rc.0.tgz
# 第二步：再装 bundle（其 dependencies 里已无客户端，不会 404）
dsh plugin --profile web add .\dsh-file-preview\undeadsheep-dsh-file-preview-0.1.0-rc.0.tgz

dsh web --dump-config   # 应出现 file-preview 与 ui-file-preview 两行
dsh web --port 3090     # 3080 被常驻 GUI 占用时换端口
```

内置依赖（`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`zod`）
由 npm / dsh 安装目录解析，无需发布。

### 发布到 npm 后的安装（目标形态）

发布后（两个包都在 npm 上），把客户端加回 bundle 的 `dependencies`：

```json
"dependencies": {
  "@undeadsheep/dsh-client-ui-file-preview": "^0.1.0-rc.0",
  "@deepseek-ai/schemastery": "^3.18.1",
  "zod": "^4.4.3"
}
```

用户即可一条命令安装：`dsh plugin --profile web add @undeadsheep/dsh-file-preview`。

## 分发

- **npm**：`pnpm publish` 两个包到 `@undeadsheep` 作用域，用户 `dsh plugin add @undeadsheep/dsh-file-preview`。
- **tarball**：`pnpm pack` 后 `dsh plugin add ./xxx.tgz`（预构建产物，无需 build 权限）。
- **git**：需要单包仓库 + 自包含 `prepare` 构建脚本，本骨架尚未实现（见下）。

## 已知限制 / 待办

1. **git 安装的 `prepare` 构建未实现**：当前只分发预构建产物（tarball / npm）。git 安装要求把 monorepo
   的 tsdown + `clientBundle` + Typert 生成器搬成单包自包含构建，属后续工作。
2. **依赖版本**用官方 `dsh@0.1.0-rc.6` 实际发布范围（`^0.1.0-rc.6`、`^4.0.1`、`^3.18.1`）；目标 dsh 安装版本不同时需相应调整。
3. 首次测试聚焦 `dsh plugin add` 的依赖解析与两行是否都成功挂载。
