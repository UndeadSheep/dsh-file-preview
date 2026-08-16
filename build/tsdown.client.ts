/**
 * Shared tsdown preset for UI plugin client bundles (vendored from the dsh
 * monorepo's packages/client/tsdown.client.ts). Emits a closure-factory
 * artifact: the bundle calls window.__ModuleLoader__.load({id, factory})
 * and resolves externals through the injected require. CSS Modules are
 * compiled by lightningcss inside the bundle. The virtual loader registers
 * each real stylesheet as a watch dependency.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'
import { PLATFORM_MODULES } from './platform.ts'

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Wire/type layers a client bundle may inline: browser-safe contracts. */
export const INLINE_SAFE = /^@deepseek-ai\/dsh-(host-apiproxy|session|llm|tools|brand)(\/|$)/

/** Vendored framework libraries: rescoped into @deepseek-ai. */
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/

/** Generated descriptor/codec contribution with no shared runtime identity. */
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

const SKIP_WORKSPACE_BUILD: UserConfig = { entry: '' }

/** The runtime store engine exemption (snapshot-store lives in runtime). */
const RUNTIME_STORE_EXEMPTION = '@deepseek-ai/dsh-client-runtime/client'

/** Externals resolved from the loader module table. */
export const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, RUNTIME_STORE_EXEMPTION]

// This vendored file lives in <repo>/build/, so the repository root is one level up.
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Rebase a physical lib-relative source onto a browser URL that mirrors the repository directories. */
function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physicalSource = resolvePath(dirname(sourcemapPath), source)
  const repositoryPath = relative(REPOSITORY_ROOT, physicalSource).split(sep).join('/')
  return repositoryPath.startsWith('packages/') ? `../../../${repositoryPath}` : source
}

export function clientBundle(
  id: string,
  libEntry: readonly string[],
  options: ClientBundleOptions = {},
): BuildFaceConfig {
  const lib = clientLibraryConfig(id, libEntry, options.lib)
  return ({ env }) => {
    const face = buildFace(env?.DSH_BUILD_FACE)
    const client = clientConfig(id, face === undefined
      ? 'src/client/index.ts'
      : 'lib/types/client/index.js')
    const node = [lib, ...(options.companions ?? [])]
    if (face === 'host') return options.hostPhase === true ? node : [SKIP_WORKSPACE_BUILD]
    if (face === 'client') return options.hostPhase === true ? [client] : [...node, client]
    return [...node, client]
  }
}

export function clientLibrary(id: string, libEntry: readonly string[]): BuildFaceConfig {
  const lib = clientLibraryConfig(id, libEntry)
  return clientOnly([lib])
}

export function clientOnly(configs: readonly UserConfig[]): BuildFaceConfig {
  return ({ env }) => buildFace(env?.DSH_BUILD_FACE) === 'host'
    ? [SKIP_WORKSPACE_BUILD]
    : [...configs]
}

interface ClientBundleOptions {
  readonly hostPhase?: boolean
  readonly companions?: readonly UserConfig[]
  readonly lib?: UserConfig
}

type BuildFace = 'host' | 'client' | undefined

type BuildFaceConfig = (inlineConfig: Pick<UserConfig, 'env'>) => UserConfig[]

function buildFace(value: unknown): BuildFace {
  if (value === undefined || value === 'host' || value === 'client') return value
  throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

function clientLibraryConfig(
  id: string,
  libEntry: readonly string[],
  overrides: UserConfig = {},
): UserConfig {
  return {
    name: id,
    entry: [...libEntry],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    ...overrides,
  }
}

function clientConfig(id: string, entry: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [{
      // react-markdown pulls in unified/vfile which import node builtins; the
      // frozen module table cannot answer those, so map them to browser shims.
      name: 'dsh-node-builtin-shim',
      resolveId(source: string) {
        if (source === 'node:process' || source === 'process') return '\0node-process'
        if (source === 'node:path' || source === 'path') return '\0node-path'
        if (source === 'node:url' || source === 'url') return '\0node-url'
        return null
      },
      load(id: string) {
        if (id === '\0node-process') {
          return 'const cwd = () => "/"; export default { cwd, env: {} }; export { cwd };'
        }
        if (id === '\0node-path') {
          return [
            'const sep = "/";',
            'const join = (...p) => p.filter(Boolean).join("/").replace(/\\/+/g, "/");',
            'const resolve = (...p) => join(...p);',
            'const dirname = (p) => { const i = p.lastIndexOf("/"); return i < 0 ? "." : (p.slice(0, i) || "/"); };',
            'const basename = (p, ext) => { let b = p.split("/").pop() ?? ""; if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length); return b; };',
            'const extname = (p) => { const b = p.split("/").pop() ?? ""; const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; };',
            'const relative = (from, to) => to.replace(from, "").replace(/^\\/+/, "");',
            'const posix = { sep, join, resolve, dirname, basename, extname, relative };',
            'export default posix;',
            'export { sep, join, resolve, dirname, basename, extname, relative, posix };',
          ].join('\n')
        }
        if (id === '\0node-url') {
          return [
            'const fileURLToPath = (u) => decodeURIComponent(String(u).replace(/^file:\\/\\//, ""));',
            'const pathToFileURL = (p) => ({ href: "file://" + p });',
            'export default { fileURLToPath, pathToFileURL };',
            'export { fileURLToPath, pathToFileURL };',
          ].join('\n')
        }
        return null
      },
    }, {
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.includes(source)) return null
        if (VENDORED_LIBRARY.test(source)) return null
        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null
        throw new Error(
          `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS), an inline-safe wire layer, or a generated /remote contribution — `
          + 'cross-plugin value imports are forbidden; collaborate through cordis services (type-only imports are erased and never reach this gate)',
        )
      },
    }, {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
        return [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(`${id}/${basename(fileId)}`)};`,
          'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
          '  const tag = document.createElement(\'style\');',
          `  tag.dataset.plugin = ${JSON.stringify(id)};`,
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      },
    }, {
      name: 'dsh-font-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!/\.(woff2|woff|ttf)$/.test(source)) return null
        const abs = importer !== undefined ? sourceAssetPath(source, importer) : source
        return '\0font:' + abs
      },
      async load(id: string) {
        if (!id.startsWith('\0font:')) return null
        const fileId = id.slice('\0font:'.length)
        this.addWatchFile(fileId)
        if (!existsSync(fileId)) {
          console.warn(`[dsh-font-inline] missing font file ${fileId} — code font falls back to system monospace`)
          return 'export default ""'
        }
        const data = await readFile(fileId)
        const ext = fileId.slice(fileId.lastIndexOf('.') + 1).toLowerCase()
        const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf'
        return `export default "data:${mime};base64,${data.toString('base64')}"`
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapPathTransform: browserSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

/** Resolve an emitted JS asset import against its source-tree counterpart. */
function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const marker = `${sep}lib${sep}types${sep}`
  const boundary = emitted.indexOf(marker)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + marker.length))
}
