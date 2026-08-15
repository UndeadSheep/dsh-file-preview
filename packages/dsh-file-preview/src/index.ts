/**
 * Workspace file preview: tree listing, text read/write, theme and config
 * resolution for the browser half's floating preview window.
 * @module @undeadsheep/dsh-file-preview
 */

import { Context } from '@deepseek-ai/cordis'
import s from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the `ctx.sandboxPolicy` Context augmentation.
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {
  ConfigPayload,
  FileTreeNode,
  ImagePayload,
  ListTreeRequest,
  ListTreeResult,
  PreviewThemeColors,
  ReadConfigRequest,
  ReadConfigResult,
  ReadFileRequest,
  ReadFileResult,
  ReadImageRequest,
  ReadImageResult,
  ReadThemeRequest,
  ReadThemeResult,
  ThemePayload,
  WriteFileRequest,
  WriteFileResult,
} from './types.ts'

export type * from './types.ts'

/** Optional deployment policy. */
export interface Config {
  /** Maximum UTF-8 byte length of a file the preview will read. */
  maxFileBytes?: number
  /** Maximum byte length of an inline image the preview will read. */
  maxImageBytes?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    filePreview: FilePreviewService
  }
}

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_DEPTH = 12

/** Map an image path extension to a browser-safe MIME type. */
function mimeFor(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  return 'application/octet-stream'
}

/** Host-facing Remote for the floating file-preview window. */
export class FilePreviewService extends TypertRemoteService {
  static inject = ['fs', 'sandboxPolicy', 'sessions']
  static Config: s<Config> = s.object({
    maxFileBytes: s.number().step(1).min(1),
    maxImageBytes: s.number().step(1).min(1),
  })

  private readonly maxFileBytes: number
  private readonly maxImageBytes: number

  constructor(ctx: Context, config: Config) {
    super(ctx, 'filePreview')
    this.maxFileBytes = config.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
    this.maxImageBytes = config.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES
  }

  /** Resolve the per-call sandbox policy from a session id (fallback: deployment default). */
  private policyFor(sessionId?: SessionId) {
    if (sessionId !== undefined) {
      const session = this.ctx.sessions.get(sessionId)
      if (session) return this.ctx.sandboxPolicy.resolve({ session })
    }
    return this.ctx.sandboxPolicy.resolve()
  }

  /** Recursively list a directory into the wire tree shape (directories first). */
  private async walk(target: FsTarget, rel: string, depth: number): Promise<FileTreeNode[]> {
    const entries = await this.ctx.fs.listDir(target)
    const nodes: FileTreeNode[] = []
    for (const entry of entries) {
      const name = entry.name
      if (!name) continue
      const childRel = rel ? `${rel}/${name}` : name
      if (entry.type === 'directory') {
        const children = depth > 0
          ? await this.walk(entry.target, childRel, depth - 1).catch(() => [])
          : []
        nodes.push({ type: 'dir', name, path: childRel, children })
      } else if (entry.type === 'file') {
        nodes.push(entry.size === undefined
          ? { type: 'file', name, path: childRel }
          : { type: 'file', name, path: childRel, size: entry.size })
      } else {
        nodes.push(entry.size === undefined
          ? { type: 'other', name, path: childRel }
          : { type: 'other', name, path: childRel, size: entry.size })
      }
    }
    nodes.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1
      if (a.type !== 'dir' && b.type === 'dir') return 1
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    return nodes
  }

  @Remote('listTree')
  async listTree(request: ListTreeRequest): Promise<ListTreeResult> {
    try {
      const policy = this.policyFor(request.sessionId)
      const root = await this.ctx.fs.resolve(policy.workspaceRoot, {})
      const tree = await this.walk(root, '', MAX_DEPTH)
      return { ok: true, value: tree }
    } catch (error) {
      return { ok: false, error: { code: 'io-failure', message: error instanceof Error ? error.message : String(error) } }
    }
  }

  @Remote('readFile')
  async readFile(request: ReadFileRequest): Promise<ReadFileResult> {
    try {
      const policy = this.policyFor(request.sessionId)
      const target = await this.ctx.fs.resolve(request.path, { cwd: policy.workspaceRoot })
      const info = await this.ctx.fs.stat(target)
      if (!info) return { ok: false, error: { code: 'not-found', path: request.path } }
      if (info.type !== 'file') return { ok: false, error: { code: 'not-text', path: request.path } }
      if (info.size !== undefined && info.size > this.maxFileBytes) {
        return { ok: false, error: { code: 'too-large', path: request.path, maxBytes: this.maxFileBytes, size: info.size } }
      }
      const content = await this.ctx.fs.readText(target)
      return { ok: true, value: { path: request.path, content } }
    } catch (error) {
      if (error !== null && typeof error === 'object' && (error as { code?: string }).code === 'FS_NOT_TEXT') {
        return { ok: false, error: { code: 'not-text', path: request.path } }
      }
      return { ok: false, error: { code: 'io-failure', message: error instanceof Error ? error.message : String(error) } }
    }
  }

  @Remote('readImage')
  async readImage(request: ReadImageRequest): Promise<ReadImageResult> {
    try {
      const policy = this.policyFor(request.sessionId)
      const target = await this.ctx.fs.resolve(request.path, { cwd: policy.workspaceRoot })
      const info = await this.ctx.fs.stat(target)
      if (!info) return { ok: false, error: { code: 'not-found', path: request.path } }
      if (info.type !== 'file') return { ok: false, error: { code: 'not-text', path: request.path } }
      if (info.size !== undefined && info.size > this.maxImageBytes) {
        return { ok: false, error: { code: 'too-large', path: request.path, maxBytes: this.maxImageBytes, size: info.size } }
      }
      const bytes = await this.ctx.fs.readBytes(target, undefined, this.maxImageBytes)
      const data = Buffer.from(bytes).toString('base64')
      const value: ImagePayload = { path: request.path, mimeType: mimeFor(request.path), data }
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error: { code: 'io-failure', message: error instanceof Error ? error.message : String(error) } }
    }
  }

  @Remote('writeFile')
  async writeFile(request: WriteFileRequest): Promise<WriteFileResult> {
    try {
      const policy = this.policyFor(request.sessionId)
      const target = await this.ctx.fs.resolve(request.path, { cwd: policy.workspaceRoot })
      await this.ctx.fs.writeText(target, request.content, undefined, undefined, policy)
      return { ok: true, value: { path: request.path } }
    } catch {
      return { ok: false, error: { code: 'write-denied', path: request.path } }
    }
  }

  @Remote('readTheme')
  async readTheme(request: ReadThemeRequest): Promise<ReadThemeResult> {
    const policy = this.policyFor(request.sessionId)
    const colors: PreviewThemeColors = {}
    let bg: string | null = null
    let fg: string | null = null

    try {
      const target = await this.ctx.fs.resolve('preview-theme.json', { cwd: policy.workspaceRoot })
      const parsed = JSON.parse(await this.ctx.fs.readText(target)) as Record<string, unknown>
      for (const key of ['keyword', 'string', 'number', 'comment', 'tag', 'function', 'type', 'variable'] as const) {
        if (typeof parsed[key] === 'string') colors[key] = parsed[key] as string
      }
      if (typeof parsed.background === 'string') bg = parsed.background
      if (typeof parsed.foreground === 'string') fg = parsed.foreground
    } catch { /* no dedicated theme file */ }

    try {
      const target = await this.ctx.fs.resolve('.vscode/settings.json', { cwd: policy.workspaceRoot })
      const parsed = JSON.parse(await this.ctx.fs.readText(target)) as Record<string, unknown>
      const tcc = (parsed['editor.tokenColorCustomizations'] ?? {}) as Record<string, unknown>
      const wcc = (parsed['workbench.colorCustomizations'] ?? {}) as Record<string, unknown>
      const map: Array<[keyof PreviewThemeColors, string]> = [
        ['keyword', 'keywords'], ['string', 'strings'], ['number', 'numbers'], ['comment', 'comments'],
        ['function', 'functions'], ['type', 'types'], ['variable', 'variables'],
      ]
      for (const [mine, theirs] of map) {
        if (colors[mine] === undefined && typeof tcc[theirs] === 'string') colors[mine] = tcc[theirs] as string
      }
      if (bg === null && typeof wcc['editor.background'] === 'string') bg = wcc['editor.background'] as string
      if (fg === null && typeof wcc['editor.foreground'] === 'string') fg = wcc['editor.foreground'] as string
    } catch { /* no vscode settings */ }

    const payload: ThemePayload = { colors, bg, fg }
    return { ok: true, value: payload }
  }

  @Remote('readConfig')
  async readConfig(request: ReadConfigRequest): Promise<ReadConfigResult> {
    const policy = this.policyFor(request.sessionId)
    const cfg: ConfigPayload = { indentSize: 2, useTabs: false, pollInterval: 1500, fontSize: 13 }
    let indentSet = false
    let tabsSet = false

    try {
      const target = await this.ctx.fs.resolve('preview.config.json', { cwd: policy.workspaceRoot })
      const parsed = JSON.parse(await this.ctx.fs.readText(target)) as Record<string, unknown>
      if (typeof parsed.indentSize === 'number') { cfg.indentSize = parsed.indentSize; indentSet = true }
      if (typeof parsed.useTabs === 'boolean') { cfg.useTabs = parsed.useTabs; tabsSet = true }
      if (typeof parsed.pollInterval === 'number') cfg.pollInterval = parsed.pollInterval
      if (typeof parsed.fontSize === 'number') cfg.fontSize = parsed.fontSize
    } catch { /* no dedicated config */ }

    let prettier: Record<string, unknown> | null = null
    for (const path of ['.prettierrc', '.prettierrc.json', 'package.json']) {
      try {
        const target = await this.ctx.fs.resolve(path, { cwd: policy.workspaceRoot })
        const parsed = JSON.parse(await this.ctx.fs.readText(target)) as Record<string, unknown>
        prettier = path === 'package.json' ? (parsed.prettier as Record<string, unknown> | null) : parsed
        if (prettier) break
      } catch { /* try next */ }
    }
    if (prettier && typeof prettier === 'object') {
      if (!indentSet && typeof prettier.tabWidth === 'number') cfg.indentSize = prettier.tabWidth
      if (!tabsSet && typeof prettier.useTabs === 'boolean') cfg.useTabs = prettier.useTabs
    }

    return { ok: true, value: cfg }
  }
}

export default FilePreviewService
