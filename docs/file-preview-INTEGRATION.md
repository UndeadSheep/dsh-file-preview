# dsh-file-preview 集成指南

两个包已按仓库真实约定拆好，拷进 harness 仓库后按下面顺序接线。所有路径都在
`E:\Projects\deepseek-harness` 下。

## 0. 拷贝

```
dsh-file-preview/            →  packages/workspace/file-preview/
dsh-client-ui-file-preview/  →  packages/client/ui-file-preview/
```

拷贝后删除 host 包里的遗留文件（tsconfig 用 `files` 已经排除了它们，不删也不会编译，
但删掉更干净）：

```
packages/workspace/file-preview/src/spec.ts        # 早期脚手架误留，仓库用 typert 从类型生成 codec，不需要它
packages/workspace/file-preview/src/client/        # 早期单包脚手架的 client 半边，现已移到 client 包
```

## 1. 登记进根 tsconfig 聚合

**`tsconfig.host.json`** 的 `references` 里加（放 `feedback/message-feedback` 附近）：

```json
{ "path": "./packages/workspace/file-preview" }
```

**`tsconfig.client.json`** 的 `references` 里加（放 `client/ui-message-feedback` 附近）：

```json
{ "path": "./packages/client/ui-file-preview" }
```

## 2. 把新 Remote 接进 dsh-api-remotes（关键，共 3 个文件）

client 半边的 `ctx.remote.filePreview` 类型和运行时挂载都来自中央装配包
`dsh-api-remotes`，必须在它里面注册。

**`packages/api/remotes/src/client/index.ts`**：

```ts
// 顶部 import 区加
import filePreviewRemote from '@deepseek-ai/dsh-file-preview/remote'
// 类型合并区加（和 messageFeedback 那行并列）
export type {} from '@deepseek-ai/dsh-file-preview/remote'
// apply() 的 contributions 数组里加（放 messageFeedbackRemote 后面）
commandsRemote, goalsRemote, dynamicRemote, pluginInventoryRemote, messageFeedbackRemote, filePreviewRemote,
```

**`packages/api/remotes/package.json`** 的 `peerDependencies` 和 `devDependencies` 各加：

```json
"@deepseek-ai/dsh-file-preview": "workspace:^"
```

**`packages/api/remotes/tsconfig.client.json`** 的 `references` 里加：

```json
{ "path": "../../workspace/file-preview" }
```

## 3. 挂载 composition 行

**`packages/bundle/web-app/cordis.patch.yml`**：

host 行（放 `message-feedback` 行附近）：

```yaml
    - id: file-preview
      name: '@deepseek-ai/dsh-file-preview'
```

client 行（放 `ui-message-feedback` 行附近）：

```yaml
    - id: ui-file-preview
      name: '@deepseek-ai/dsh-client-ui-file-preview'
```

## 4. web-app 依赖

**`packages/bundle/web-app/package.json`** 的 `dependencies` 加：

```json
"@deepseek-ai/dsh-file-preview": "workspace:^",
"@deepseek-ai/dsh-client-ui-file-preview": "workspace:^"
```

## 5. 构建

```bash
cd E:\Projects\deepseek-harness
pnpm install
pnpm build:lib        # 先 host 面（跑 typert 代码生成），再 client 面
pnpm dev:web          # 重打包前端（或按你的 web 构建流程）
```

顺序很重要：host 面的 `tsdown --env.DSH_BUILD_FACE host` 会生成
`lib/typert.host.js` 和 `lib/typert.remote-client.js`；client 面 typecheck 依赖
后者已经存在，所以先 host 后 client。

## 6. 验证

1. `pnpm build:lib:host` 通过（host service + typert 契约）。
2. `pnpm build:lib:client` 通过（client 组件 + CSS module + 插槽注册）。
3. 起 web，点会话头部「文件预览」按钮 → 浮动窗口出现，目录树/预览/编辑/字号都正常。

## 需要 build 迭代验证的点（报错发我，逐条修）

1. **递归类型 `FileTreeNode.children: FileTreeNode[]`** —— typert 代码生成可能不接受递归。
   若报错，改成扁平数组 `{ path, name, type, parentPath }`，client 侧按 parentPath 拼树。
2. **`static Config` 的 schemastery 写法** —— 现在是 `s.object({ maxFileBytes: s.number().step(1).min(1) })`
   （可选、无 `.required()`），需按 config catalog 校验。
3. **`SessionId` 品牌类型** —— 请求参数用 `SessionId`（来自 `@deepseek-ai/dsh-session/types`），
   wire 类型注册表里已有 `@deepseek-ai/dsh-session/types#SessionId`（SessionStore 注册）。若 typert
   报不认识，把请求参数降级成 `string` 再试。
4. **CSS module 类名** —— 打包用 `[hash]_[local]` 哈希，组件里每个 `css.xxx` 都要在
   `FilePreviewWindow.module.css` 里有对应类，否则拿到 `undefined`。
5. **`ctx.remote.filePreview` 类型** —— 只有做完第 2 步 + host 代码生成后才存在；client 面
   typecheck 之前必须先完成第 2 步。

## 与动态插件 `float-1` 的功能对齐（已完成）

- Remote：`listTree` / `readFile` / `writeFile` / `readTheme` / `readConfig`。
- 目录树、Markdown/代码预览、覆盖层编辑器（自动缩进、括号闭合、Tab/Shift+Tab）、
  主题与配置导入、A−/A+ 字号、1.5s 轮询刷新。
- 两个插槽：`shell.overlay`（浮动窗口）+ `conversation.session.header.utilities`（头部开关）。
- 业务错误统一为结构化 `{ code, ... }`，与 message-feedback 一致。

## 已知限制（同动态插件）

- 预览只读文本；二进制 / 超 `maxFileBytes`（默认 2MB）给提示。
- 高亮是手写轻量 tokenizer，不是 highlight.js / TextMate；prettier 引擎无法内嵌。
- 自动刷新是轮询（`preview.config.json` 的 `pollInterval`），无真文件监视。
- 「会话里点击文件引用 → 预览」无合规挂接点，目前用目录树 + 路径输入打开。
