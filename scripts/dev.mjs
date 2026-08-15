#!/usr/bin/env node
/**
 * dev.mjs — 一键本地开发验证：构建 → 打包 → 装进干净的 dsh profile → 打印启动命令。
 * 贡献者改完源码后跑 `pnpm dev` 即可把最新改动装进官方 dsh 看效果。
 */
import { execSync } from 'node:child_process'
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

console.log('\n✓ 已装进临时 profile。验证：')
console.log('  dsh web --port 3090')
