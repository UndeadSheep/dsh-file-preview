#!/usr/bin/env node
/**
 * dev.mjs — 一键本地开发验证：构建 → 打包 → 装进干净的 dsh profile → 打印启动命令。
 * 贡献者改完源码后跑 `pnpm dev` 即可把最新改动装进官方 dsh 看效果。
 */
import { execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hostDir = join(root, 'packages', 'dsh-file-preview')
const clientDir = join(root, 'packages', 'dsh-client-ui-file-preview')
const hostPkgPath = join(hostDir, 'package.json')
const CLIENT_DEP = '@undeadsheep/dsh-client-ui-file-preview'

const run = (cmd, args, opts = {}) =>
  execSync([cmd, ...args.map(a => `"${a}"`)].join(' '), { cwd: root, stdio: 'inherit', ...opts })

const readPkg = dir => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
const tgzPath = (dir, pkg) =>
  join(dir, `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`)
// 1. 构建
run('pnpm', ['build'])

// 2. 测试形态：临时去掉宿主对客户端的依赖（本地未发布时 pnpm 无法从 npm 解析它）
const original = readFileSync(hostPkgPath, 'utf8')
const hostPkg = JSON.parse(original)
delete hostPkg.dependencies[CLIENT_DEP]
writeFileSync(hostPkgPath, JSON.stringify(hostPkg, null, 2) + '\n')

let clientTgz, hostTgz
try {
  // 3. 打包两个 tarball
  run('pnpm', ['pack'], { cwd: clientDir })
  run('pnpm', ['pack'], { cwd: hostDir })
  clientTgz = tgzPath(clientDir, readPkg(clientDir))
  hostTgz = tgzPath(hostDir, readPkg(hostDir))
} finally {
  // 4. 恢复发布形态
  writeFileSync(hostPkgPath, original)
}

// 5. 装进干净 profile（先客户端后宿主）
const home = join(tmpdir(), 'dsh-dev-profile')
rmSync(home, { recursive: true, force: true })
const env = { ...process.env, DSH_HOME: home }
run('dsh', ['plugin', '--profile', 'web', 'add', clientTgz], { env })
run('dsh', ['plugin', '--profile', 'web', 'add', hostTgz], { env })

// 6. 解析参数：--port <n> 换端口；--no-start 只打印命令、不自动起服务。
const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const rawPort = portIdx >= 0 ? Number(args[portIdx + 1]) : 3090
const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : 3090
const noStart = args.includes('--no-start')

console.log(`\n✓ 已装进临时 profile（DSH_HOME=${home}）。`)
if (noStart) {
  // 手动启动时必须带上同一个 DSH_HOME，否则 dsh web 会读 ~/.dsh（没有本插件）。
  console.log('  手动验证（PowerShell）：')
  console.log(`  $env:DSH_HOME = "${home}"; dsh web --port ${port}`)
  console.log('  手动验证（bash/zsh）：')
  console.log(`  DSH_HOME="${home}" dsh web --port ${port}`)
} else {
  console.log(`  启动 dsh web：http://127.0.0.1:${port}（Ctrl+C 停止）\n`)
  // 用整条命令字符串（而非 args 数组）+ shell，避免 node 的 DEP0190 注入告警。
  // port 已在上面校验为正整数，不会拼接进任何非数字内容。
  const child = spawn(`dsh web --port ${port}`, { cwd: root, stdio: 'inherit', shell: true, env })
  child.on('exit', (code) => { process.exit(code ?? 0) })
}
