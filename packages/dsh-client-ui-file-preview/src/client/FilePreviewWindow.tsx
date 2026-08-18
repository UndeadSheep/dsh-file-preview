/**
 * Browser half: the floating file-preview window and the header toggle button.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/FilePreviewWindow
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConfigPayload, FileTreeNode, ImagePayload, PreviewThemeColors, ThemePayload } from '@undeadsheep/dsh-file-preview/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { FilePreviewRemote } from './remote.ts'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { highlight, isImagePath, isMdPath } from './render.ts'
import {
  hasUriScheme,
  isBlockedImageSrc,
  isDangerousHref,
  isSafeExternalHref,
  normalizeWorkspacePath,
  resolveLocalPath,
  basenameOf,
  ancestorDirPaths,
} from './paths.ts'
import { CodeEditor, type CodeEditorHandle } from './CodeEditor.tsx'
import { ImageView } from './ImageView.tsx'
import { DEFAULT_CODE_FONT_FAMILY } from './font.ts'
import { DARK_THEME } from './theme.ts'
import { QuickOpen } from './QuickOpen.tsx'
import { recordRecent } from './recent.ts'
import css from './FilePreviewWindow.module.css'

/** Module-level open store shared by the header button and the overlay window. */
let mdOpen = false
const openListeners = new Set<() => void>()
const openFileListeners = new Set<(path: string) => void>()
function setOpen(value: boolean): void {
  if (mdOpen === value) return
  mdOpen = value
  for (const fn of openListeners) fn()
}
function subscribeOpen(fn: () => void): () => void {
  openListeners.add(fn)
  return () => { openListeners.delete(fn) }
}
function subscribeOpenFile(fn: (path: string) => void): () => void {
  openFileListeners.add(fn)
  return () => { openFileListeners.delete(fn) }
}
/** Programmatic open (prose file mentions): reveal the window and load `path`. */
export function requestOpenFile(path: string): void {
  if (!mdOpen) {
    mdOpen = true
    for (const fn of openListeners) fn()
  }
  for (const fn of openFileListeners) fn(path)
}

/** Translate a structured business failure into user-facing text. */
function describeFailure(error: { code?: string; message?: string; path?: string }): string {
  const at = error.path ? `（${error.path}）` : ''
  switch (error.code) {
    case 'no-workspace': return '无工作区'
    case 'not-found': return `文件不存在${at}`
    case 'not-text': return `不是文本文件，无法预览${at}`
    case 'too-large': return '文件过大，暂不预览'
    case 'write-denied': return '写入被拒绝'
    case 'io-failure': return error.message ?? 'IO 错误'
    default: return error.code ?? '未知错误'
  }
}

/** Unwrap the two-level envelope (carrier `RemoteResult` + business `{ ok, value }`). */
function unwrap<X>(carried: RemoteResult<unknown>): { ok: true; value: X } | { ok: false; error: string } {
  if (!carried.ok) return { ok: false, error: carried.error.message }
  const result = carried.value as { ok?: boolean; value?: X; error?: { code?: string; message?: string; path?: string } }
  if (!result.ok) return { ok: false, error: describeFailure(result.error ?? {}) }
  return { ok: true, value: result.value as X }
}

/** Renders one markdown image, resolving local/relative srcs to data URLs via readImage. */
function MarkdownImage(props: {
  src: string | undefined
  alt: string | undefined
  title: string | undefined
  width: string | number | undefined
  height: string | number | undefined
  remote: FilePreviewRemote
  sessionId: SessionId | undefined
  baseDir: string
}): React.ReactElement {
  const { src, alt, title, width, height, remote, sessionId, baseDir } = props
  const imgRef = useRef<HTMLImageElement>(null)
  const blocked = src === undefined || isBlockedImageSrc(src)
  const localPath = !blocked && sessionId !== undefined
    ? (resolveLocalPath(baseDir, src) ?? undefined)
    : undefined
  const cacheKey = localPath !== undefined && sessionId !== undefined
    ? `${String(sessionId)}::${localPath}`
    : undefined
  const [resolved, setResolved] = useState<string | undefined>(() =>
    cacheKey !== undefined ? imageCache.get(cacheKey) : undefined)
  const [shouldLoad, setShouldLoad] = useState<boolean>(resolved !== undefined)

  useEffect(() => {
    if (shouldLoad || blocked || localPath === undefined) return
    const el = imgRef.current
    if (el === null) return
    if (typeof IntersectionObserver === 'undefined') { setShouldLoad(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShouldLoad(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [shouldLoad, blocked, localPath])

  useEffect(() => {
    if (!shouldLoad || blocked || resolved !== undefined) return
    if (localPath === undefined || sessionId === undefined || cacheKey === undefined) return
    const cached = imageCache.get(cacheKey)
    if (cached !== undefined) { setResolved(cached); return }
    let cancelled = false
    void (async () => {
      const res = unwrap<ImagePayload>(await remote.readImage({ sessionId, path: localPath }))
      if (!cancelled && res.ok) {
        const url = `data:${res.value.mimeType};base64,${res.value.data}`
        cacheImage(cacheKey, url)
        setResolved(url)
      }
    })()
    return () => { cancelled = true }
  }, [shouldLoad, blocked, resolved, cacheKey, localPath, remote, sessionId])

  if (blocked || localPath === undefined) {
    return <span className={css.mdBlockedImg}>{alt || '图片已拦截'}</span>
  }
  return <img ref={imgRef} src={resolved} alt={alt} title={title} width={width} height={height} />
}

/** Renders a fenced code block with syntax highlighting. */
function MarkdownCode(props: {
  className: string | undefined
  children: React.ReactNode
  colors: PreviewThemeColors
}): React.ReactElement {
  const { className, children, colors } = props
  const lang = /language-([\w-]+)/.exec(className ?? '')?.[1]
  const text = String(children ?? '').replace(/\n$/, '')
  if (lang !== undefined) {
    return <code className={className} dangerouslySetInnerHTML={{ __html: highlight(text, lang, colors) }} />
  }
  return <code className={className}>{children}</code>
}

/** Renders one markdown link: local file links open in the preview, external links open in a new tab. */
function MarkdownLink(props: {
  href: string | undefined
  baseDir: string
  loadRef: React.MutableRefObject<(path: string) => void>
  children: React.ReactNode
}): React.ReactElement {
  const { href, baseDir, loadRef, children } = props
  if (href === undefined) return <a>{children}</a>
  if (isDangerousHref(href) || (hasUriScheme(href) && !isSafeExternalHref(href))) {
    return <span>{children}</span>
  }
  if (isSafeExternalHref(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  }
  if (href.startsWith('#')) {
    return <a href={href}>{children}</a>
  }
  const resolved = resolveLocalPath(baseDir, href)
  if (resolved === null) return <span>{children}</span>
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        loadRef.current(resolved)
      }}
    >
      {children}
    </a>
  )
}

const DEFAULT_CONFIG: ConfigPayload = { indentSize: 2, useTabs: false, pollInterval: 1500, fontSize: 13, fontFamily: DEFAULT_CODE_FONT_FAMILY }

/** Stable plugin arrays so `<Markdown>` doesn't re-parse on every window render. */
const MARKDOWN_REMARK_PLUGINS = [remarkGfm]
const MARKDOWN_REHYPE_PLUGINS = [rehypeSanitize]

/** Resolved-image cache budget (base64 chars across all entries); oldest entries are evicted beyond it. */
const IMAGE_CACHE_CHAR_BUDGET = 16 * 1024 * 1024

/** Resolved-image cache (session + resolved path → data URL) so remounts don't re-fetch or flicker. */
const imageCache = new Map<string, string>()
let imageCacheChars = 0

/** Store a resolved image data URL, evicting the oldest entries past the char budget. */
function cacheImage(key: string, url: string): void {
  const previous = imageCache.get(key)
  if (previous !== undefined) imageCacheChars -= previous.length
  imageCache.set(key, url)
  imageCacheChars += url.length
  while (imageCacheChars > IMAGE_CACHE_CHAR_BUDGET && imageCache.size > 1) {
    const oldest = imageCache.keys().next().value
    if (oldest === undefined) break
    const dropped = imageCache.get(oldest)
    imageCache.delete(oldest)
    if (dropped !== undefined) imageCacheChars -= dropped.length
  }
}

function clearImageCache(): void {
  imageCache.clear()
  imageCacheChars = 0
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

type FileEol = '\n' | '\r\n' | '\r'

function detectEol(text: string): FileEol {
  if (text.includes('\r\n')) return '\r\n'
  if (text.includes('\r')) return '\r'
  return '\n'
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function applyEol(text: string, eol: FileEol): string {
  const normalized = normalizeNewlines(text)
  return eol === '\n' ? normalized : normalized.replace(/\n/g, eol)
}

function sameDocument(a: string, b: string): boolean {
  return normalizeNewlines(a) === normalizeNewlines(b)
}

/** Nearest overflow scroller between `start` and `root` that can take this wheel delta. */
function wheelAbsorber(start: EventTarget | null, root: HTMLElement, e: WheelEvent): HTMLElement | null {
  let node = start instanceof HTMLElement ? start : null
  while (node && node !== root) {
    const style = getComputedStyle(node)
    const yScroll = (style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1
    const xScroll = (style.overflowX === 'auto' || style.overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1
    if (yScroll || xScroll) {
      const dy = e.deltaY
      const dx = e.deltaX
      if (dy < 0 && node.scrollTop > 0) return node
      if (dy > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1) return node
      if (dx < 0 && node.scrollLeft > 0) return node
      if (dx > 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 1) return node
    }
    node = node.parentElement
  }
  return null
}

function viewport(): { w: number; h: number } {
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return { w: window.innerWidth, h: window.innerHeight }
  }
  return { w: 4096, h: 4096 }
}

const CORNER_CLASS: Record<string, string | undefined> = {
  'top-left': css.cornerTopLeft,
  'top-right': css.cornerTopRight,
  'bottom-left': css.cornerBottomLeft,
  'bottom-right': css.cornerBottomRight,
}

export interface FilePreviewWindowProps {
  remote: FilePreviewRemote
  useSessions: SnapshotSelectorHook<SessionListState>
}

export function FilePreviewWindow({ remote, useSessions }: FilePreviewWindowProps): React.ReactElement | null {
  const sessionId = useSessions(s => s?.current)

  const [open, setOpenState] = useState(mdOpen)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 560, h: 600 })
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [drag, setDrag] = useState<null | { pointerId: number; dx: number; dy: number }>(null)
  const [resize, setResize] = useState<null | {
    pointerId: number
    startX: number
    startY: number
    w: number
    h: number
    x: number
    y: number
    corner: string
  }>(null)
  const [file, setFile] = useState<null | { path: string; name: string; isMarkdown: boolean; isImage: boolean; imageUrl?: string }>(null)
  const [source, setSource] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirs, setDirs] = useState<Record<string, FileTreeNode[]>>({})
  const [theme, setTheme] = useState<{
    colors: PreviewThemeColors
    bg: string | undefined
    fg: string | undefined
  }>({ colors: {}, bg: undefined, fg: undefined })
  const [config, setConfig] = useState<ConfigPayload>(DEFAULT_CONFIG)
  const [dark, setDark] = useState(false)
  const [leavePrompt, setLeavePrompt] = useState(false)
  const savedSourceRef = useRef('')
  const fileEolRef = useRef<FileEol>('\n')
  const dirSignaturesRef = useRef<Record<string, string>>({})
  const themeSignatureRef = useRef('')
  const configSignatureRef = useRef('')
  const dirInFlightRef = useRef<Record<string, Promise<void>>>({})
  const dirEpochRef = useRef(0)
  const fileCacheRef = useRef<Map<string, string>>(new Map())
  const loadRef = useRef<(path: string) => void>(() => {})
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  const placedRef = useRef(false)
  const editorRef = useRef<CodeEditorHandle>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarListRef = useRef<HTMLDivElement>(null)
  const pendingLeaveRef = useRef<((ok: boolean) => void) | null>(null)
  const leaveLockRef = useRef(false)
  const scrollToPathRef = useRef<string | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => {})
  const leavePromptRef = useRef(false)
  const fileRef = useRef(file)
  fileRef.current = file
  leavePromptRef.current = leavePrompt

  const effectiveColors = dark ? DARK_THEME.colors : theme.colors
  const effectiveBg = dark ? DARK_THEME.bg : theme.bg
  const effectiveFg = dark ? DARK_THEME.fg : theme.fg

  // Memoized markdown components: keep the `img`/`code` component identities stable across
  // re-renders (the file tree polls every 1.5s), so images aren't unmounted/remounted — which
  // would reset their resolved data URL and cause the flicker/reload.
  const baseDir = file !== null ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : ''
  const markdownComponents = useMemo<Components>(() => ({
    img: (props) => (
      <MarkdownImage
        src={props.src}
        alt={props.alt}
        title={props.title}
        width={props.width}
        height={props.height}
        remote={remote}
        sessionId={sessionId}
        baseDir={baseDir}
      />
    ),
    code: (props) => (
      <MarkdownCode className={props.className} children={props.children} colors={effectiveColors} />
    ),
    a: (props) => (
      <MarkdownLink href={props.href} baseDir={baseDir} loadRef={loadRef}>{props.children}</MarkdownLink>
    ),
  }), [remote, sessionId, baseDir, effectiveColors, loadRef])

  // Memoize the rendered markdown so unrelated re-renders (window drag/resize,
  // font-size tweaks, tree polls) don't re-run the remark/rehype parse of a
  // large document on every render.
  const markdownBody = useMemo<React.ReactNode>(() => {
    if (file === null || !file.isMarkdown) return null
    const size = `${config.fontSize || 13}px`
    return (
      <div className={css.scroll}>
        <div className={css.meta}>{file.name}</div>
        <div className={css.out} style={{ fontSize: size }}>
          <Markdown
            remarkPlugins={MARKDOWN_REMARK_PLUGINS}
            rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
            components={markdownComponents}
          >
            {source}
          </Markdown>
        </div>
      </div>
    )
  }, [file, source, config.fontSize, markdownComponents])

  useEffect(() => subscribeOpen(() => setOpenState(mdOpen)), [])
  useEffect(() => {
    if (!open || placedRef.current) return
    placedRef.current = true
    reveal()
  }, [open])
  useEffect(() => { if (open && sessionId) void loadDir('') }, [open])
  useEffect(() => {
    if (!sessionId) return
    // Session change (possibly a different workspace): drop the previous tree
    // cache and collapse state so the sidebar reads the new workspace.
    dirEpochRef.current++
    dirSignaturesRef.current = {}
    dirInFlightRef.current = {}
    fileCacheRef.current = new Map()
    clearImageCache()
    setDirs({})
    setExpanded({})
    if (dirtyRef.current) setError('工作区已切换，未保存的修改已丢弃')
    else setError(null)
    pendingLeaveRef.current?.(false)
    setFile(null)
    setSource('')
    setDirty(false)
    dirtyRef.current = false
    savedSourceRef.current = ''
    fileEolRef.current = '\n'
    void loadDir('')
    void loadTheme()
    void loadConfig()
  }, [sessionId])
  useEffect(() => {
    if (!open || !sessionId) return
    const id = setInterval(() => { refreshLoadedDirs() }, config.pollInterval || 1500)
    return () => clearInterval(id)
  }, [open, sessionId, config.pollInterval])
  useEffect(() => subscribeOpenFile((path) => { void loadRef.current(path) }), [])
  useEffect(() => {
    if (error === null) return
    const id = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(id)
  }, [error])

  // Keep wheel events inside the overlay so the conversation page does not scroll.
  useEffect(() => {
    const el = winRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (wheelAbsorber(e.target, el, e) === null) e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [])

  // Capture Ctrl+S / Ctrl+P so the browser does not save/print the page, even
  // when CodeMirror has focus.
  useEffect(() => {
    const el = winRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || leavePromptRef.current) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        void saveRef.current()
      } else if (k === 'p') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    el.addEventListener('keydown', onKey, true)
    return () => el.removeEventListener('keydown', onKey, true)
  }, [])

  // Expand ancestor folders and scroll the active file into view after it is opened.
  useEffect(() => {
    if (file === null) return
    const ancestors = ancestorDirPaths(file.path)
    if (ancestors.length > 0) {
      setExpanded(prev => {
        let changed = false
        const next = { ...prev }
        for (const d of ancestors) {
          if (!next[d]) { next[d] = true; changed = true }
        }
        return changed ? next : prev
      })
      for (const d of ancestors) void loadDir(d)
    }
  }, [file?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const want = scrollToPathRef.current
    if (want === null || !sidebarOpen || file?.path !== want) return
    const el = sidebarListRef.current?.querySelector('[data-tree-active="1"]')
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' })
      scrollToPathRef.current = null
      return
    }
    const ancestors = ancestorDirPaths(want)
    if (ancestors.every(d => dirs[d] !== undefined)) scrollToPathRef.current = null
  }, [file?.path, dirs, expanded, sidebarOpen])

  function reveal(): void {
    const vp = viewport()
    const w = clamp(size.w, 320, Math.max(320, vp.w - 32))
    const h = clamp(size.h, 240, Math.max(240, vp.h - 32))
    setSize({ w, h })
    setPos({ x: Math.max(8, vp.w - w - 16), y: 16 })
  }

  /** List one directory (single level), coalescing concurrent loads and skipping no-op updates. */
  function loadDir(path: string): Promise<void> {
    if (!sessionId) return Promise.resolve()
    const inflight = dirInFlightRef.current[path]
    if (inflight !== undefined) return inflight
    const epoch = dirEpochRef.current
    const task = (async () => {
      let nodes: FileTreeNode[] | null = null
      try {
        const res = unwrap<FileTreeNode[]>(await remote.listDir({ sessionId, path }))
        if (res.ok) nodes = res.value
      } catch {
        /* keep the last known listing on transient errors */
      }
      if (epoch !== dirEpochRef.current) return // stale: session switched mid-flight
      if (nodes !== null) {
        const value: FileTreeNode[] = nodes
        const signature = JSON.stringify(value)
        if (signature !== dirSignaturesRef.current[path]) {
          dirSignaturesRef.current[path] = signature
          setDirs(prev => ({ ...prev, [path]: value }))
        }
      } else {
        // A failed/empty dir shouldn't stay "加载中…" forever.
        setDirs(prev => (prev[path] === undefined ? { ...prev, [path]: [] } : prev))
      }
      delete dirInFlightRef.current[path]
    })()
    dirInFlightRef.current[path] = task
    return task
  }

  /** Re-list the root and every currently-expanded directory (used by the poll). */
  function refreshLoadedDirs(): void {
    void loadDir('')
    for (const path of Object.keys(expanded)) {
      if (expanded[path]) void loadDir(path)
    }
  }

  async function loadTheme(): Promise<void> {
    if (!sessionId) return
    const res = unwrap<ThemePayload>(await remote.readTheme({ sessionId }))
    if (!res.ok) return
    const next = { colors: res.value.colors, bg: res.value.bg ?? undefined, fg: res.value.fg ?? undefined }
    const signature = JSON.stringify(next)
    if (signature !== themeSignatureRef.current) {
      themeSignatureRef.current = signature
      setTheme(next)
    }
  }

  async function loadConfig(): Promise<void> {
    if (!sessionId) return
    const res = unwrap<ConfigPayload>(await remote.readConfig({ sessionId }))
    if (!res.ok) return
    const signature = JSON.stringify(res.value)
    if (signature !== configSignatureRef.current) {
      configSignatureRef.current = signature
      setConfig(res.value)
    }
  }

  function refreshAll(): void {
    refreshLoadedDirs()
    void loadTheme()
    void loadConfig()
  }

  function adoptDiskText(raw: string): string {
    fileEolRef.current = detectEol(raw)
    return normalizeNewlines(raw)
  }

  function flushEditor(): void {
    const v = editorRef.current?.getValue()
    if (v === undefined) return
    setSource(v)
    const nextDirty = !sameDocument(v, savedSourceRef.current)
    dirtyRef.current = nextDirty
    setDirty(nextDirty)
  }

  function confirmLeaveFile(): Promise<boolean> {
    flushEditor()
    if (!dirtyRef.current) return Promise.resolve(true)
    if (leaveLockRef.current) return Promise.resolve(false)
    leaveLockRef.current = true
    setLeavePrompt(true)
    return new Promise(resolve => {
      pendingLeaveRef.current = (ok) => {
        leaveLockRef.current = false
        pendingLeaveRef.current = null
        setLeavePrompt(false)
        resolve(ok)
      }
    })
  }

  function finishLeave(ok: boolean): void {
    pendingLeaveRef.current?.(ok)
  }

  function markOpened(path: string): void {
    if (sessionId !== undefined) recordRecent(String(sessionId), path)
    scrollToPathRef.current = path
    setSidebarOpen(true)
  }

  async function load(path: string): Promise<void> {
    if (!sessionId) return
    const normalized = normalizeWorkspacePath(path)
    if (normalized === null) {
      setError('路径不受理')
      return
    }
    if (fileRef.current !== null && fileRef.current.path === normalized) return
    if (!(await confirmLeaveFile())) return
    const firstOpen = fileRef.current === null
    const nextMode = isMdPath(normalized) ? 'preview' : 'edit'
    if (isImagePath(normalized)) {
      if (firstOpen) setLoading(true)
      setError(null)
      const res = unwrap<ImagePayload>(await remote.readImage({ sessionId, path: normalized }))
      if (res.ok) {
        markOpened(normalized)
        const imageUrl = `data:${res.value.mimeType};base64,${res.value.data}`
        setFile({ path: normalized, name: normalized, isMarkdown: false, isImage: true, imageUrl })
        setSource('')
        dirtyRef.current = false
        setDirty(false)
        savedSourceRef.current = ''
        fileEolRef.current = '\n'
        setMode('preview')
      } else {
        setError(res.error)
      }
      setLoading(false)
      return
    }
    const cached = fileCacheRef.current.get(normalized)
    if (cached !== undefined) {
      markOpened(normalized)
      const text = adoptDiskText(cached)
      setFile({ path: normalized, name: normalized, isMarkdown: isMdPath(normalized), isImage: false })
      setSource(text)
      dirtyRef.current = false
      setDirty(false)
      savedSourceRef.current = text
      setMode(nextMode)
      setError(null)
      return
    }
    if (firstOpen) setLoading(true)
    setError(null)
    const res = unwrap<{ path: string; content: string }>(await remote.readFile({ sessionId, path: normalized }))
    if (res.ok) {
      markOpened(normalized)
      const content = res.value.content
      const isMarkdown = isMdPath(normalized)
      fileCacheRef.current.set(normalized, content)
      const text = adoptDiskText(content)
      setFile({ path: normalized, name: res.value.path || normalized, isMarkdown, isImage: false })
      setSource(text)
      dirtyRef.current = false
      setDirty(false)
      savedSourceRef.current = text
      setMode(nextMode)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }
  loadRef.current = load

  async function save(): Promise<void> {
    if (file === null || !sessionId || savingRef.current) return
    const content = editorRef.current?.getValue() ?? source
    if (sameDocument(content, savedSourceRef.current)) {
      setSource(normalizeNewlines(content))
      setDirty(false)
      dirtyRef.current = false
      return
    }
    savingRef.current = true
    setSaving(true)
    const toWrite = applyEol(content, fileEolRef.current)
    const res = unwrap<{ path: string }>(await remote.writeFile({ sessionId, path: file.path, content: toWrite }))
    if (res.ok) {
      const text = normalizeNewlines(content)
      setSource(text)
      setDirty(false)
      dirtyRef.current = false
      savedSourceRef.current = text
      fileCacheRef.current.set(file.path, toWrite)
    } else {
      setError(res.error)
    }
    savingRef.current = false
    setSaving(false)
  }
  saveRef.current = save

  function toggleDir(path: string): void {
    const willOpen = !expanded[path]
    setExpanded(prev => ({ ...prev, [path]: willOpen }))
    if (willOpen) void loadDir(path)
  }

  function changeFontSize(delta: number): void {
    setConfig(c => ({ ...c, fontSize: clamp((c.fontSize || 13) + delta, 10, 32) }))
  }

  function switchToPreview(): void {
    flushEditor()
    setMode('preview')
  }

  /** Apply an editor change and mark dirty when it differs from the saved content. */
  function applyEdit(next: string): void {
    setSource(next)
    const nextDirty = !sameDocument(next, savedSourceRef.current)
    dirtyRef.current = nextDirty
    setDirty(nextDirty)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (leavePrompt) {
      if (e.key === 'Escape') { e.preventDefault(); finishLeave(false) }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const rootChildren = dirs['']
  const titleText = file === null
    ? '文件预览'
    : `${basenameOf(file.path)}${dirty ? ' *' : ''}`
  const actions = (
    <div className={css.actions}>
      <button className={css.modeBtn} title="减小字号" onClick={() => changeFontSize(-1)}>A−</button>
      <span className={css.fontSize}>{config.fontSize || 13}</span>
      <button className={css.modeBtn} title="增大字号" onClick={() => changeFontSize(1)}>A+</button>
      {file !== null && file.isMarkdown && (
        <>
          <span className={css.sep} />
          <button className={mode === 'preview' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn} onClick={switchToPreview}>预览</button>
          <button className={mode === 'edit' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn} onClick={() => { flushEditor(); setMode('edit') }}>编辑</button>
        </>
      )}
      <button className={css.saveBtn} disabled={file === null || !dirty || saving} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button>
    </div>
  )

  let body: React.ReactNode = null
  if (loading && file === null) {
    body = <div className={css.hint}>加载中…</div>
  } else if (file === null) {
    body = error !== null
      ? <div className={`${css.scroll} ${css.error}`}>{error}</div>
      : <div className={css.hint}>点击左侧文件预览</div>
  } else if (file.isImage) {
    body = <ImageView url={file.imageUrl ?? ''} name={file.name} />
  } else if (file.isMarkdown && mode === 'preview') {
    body = markdownBody
  } else {
    body = (
      <CodeEditor
        ref={editorRef}
        value={source}
        path={file.path}
        editable
        onChange={applyEdit}
        colors={effectiveColors}
        bg={effectiveBg}
        fg={effectiveFg}
        fontSize={config.fontSize || 13}
        fontFamily={config.fontFamily || DEFAULT_CODE_FONT_FAMILY}
        dark={dark}
      />
    )
  }

  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode => {
    const style = { paddingLeft: 10 + depth * 14 }
    if (node.type === 'dir') {
      const isOpen = !!expanded[node.path]
      const children = dirs[node.path]
      return (
        <div key={node.path}>
          <button className={css.treeNode} style={style} title={node.path} onClick={() => toggleDir(node.path)}>
            <span className={css.caret}>{isOpen ? '▾' : '▸'}</span>
            <span className={css.nodeIcon}>📁</span>
            <span className={css.nodeName}>{node.name}</span>
          </button>
          {isOpen && (children === undefined
            ? <div className={css.hint}>加载中…</div>
            : children.length > 0
              ? children.map(c => renderNode(c, depth + 1))
              : <div className={css.hint}>无文件</div>)}
        </div>
      )
    }
    const active = file !== null && file.path === node.path
    return (
      <button
        key={node.path}
        className={active ? `${css.treeNode} ${css.treeFileOn}` : css.treeNode}
        style={style}
        title={node.path}
        data-tree-active={active ? '1' : undefined}
        onClick={() => { void load(node.path) }}
      >
        <span className={css.caret}> </span>
        <span className={css.nodeIcon}>📄</span>
        <span className={css.nodeName}>{node.name}</span>
        {node.path.includes('/') && (
          <span className={css.nodeParent}>{node.path.slice(0, node.path.lastIndexOf('/'))}</span>
        )}
      </button>
    )
  }

  return (
    <div
      ref={winRef}
      className={dark ? `${css.win} ${css.dark}` : css.win}
      style={{
        display: open ? undefined : 'none',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        ['--fp-code-font' as string]: config.fontFamily || DEFAULT_CODE_FONT_FAMILY,
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={css.header}
        onPointerDown={(e) => {
          // Buttons inside the header must keep their own click; only drag from the bar itself.
          if ((e.target as HTMLElement).closest?.('button')) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag({ pointerId: e.pointerId, dx: e.clientX - pos.x, dy: e.clientY - pos.y })
        }}
        onPointerMove={(e) => {
          if (!drag || e.pointerId !== drag.pointerId) return
          const vp = viewport()
          setPos({
            x: clamp(e.clientX - drag.dx, 8, Math.max(8, vp.w - size.w - 8)),
            y: clamp(e.clientY - drag.dy, 8, Math.max(8, vp.h - size.h - 8)),
          })
        }}
        onPointerUp={(e) => { if (drag && e.pointerId === drag.pointerId) setDrag(null) }}
      >
        <button className={css.sideBtn} title={sidebarOpen ? '收起文件列表' : '展开文件列表'} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <div className={css.title} title={file === null ? undefined : file.path}>{titleText}</div>
        <button className={css.themeBtn} title={dark ? '切换到浅色模式' : '切换到深色模式'} onClick={() => setDark(!dark)}>
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="4" fill="#f6b83d" />
              <g stroke="#f6b83d" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v3" /><path d="M12 19v3" /><path d="M4.22 4.22l2.12 2.12" /><path d="M17.66 17.66l2.12 2.12" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="M4.22 19.78l2.12-2.12" /><path d="M17.66 6.34l2.12-2.12" />
              </g>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="#f6b83d" />
            </svg>
          )}
        </button>
        <button className={css.closeBtn} title="收起" onClick={() => setOpen(false)}>—</button>
      </div>
      <div className={css.toolbar}>
        <QuickOpen ref={searchRef} sessionId={sessionId} remote={remote} onOpen={path => { void load(path) }} />
      </div>
      {error !== null && (
        <div className={css.inlineError}>
          <span className={css.inlineErrorText}>{error}</span>
          <button type="button" className={css.inlineErrorClose} title="关闭" onClick={() => setError(null)}>×</button>
        </div>
      )}
      <div className={css.main}>
        {sidebarOpen
          ? (
            <div className={css.sidebar}>
              <div className={css.sidebarHead}>
                <span className={css.sidebarTitle}>文件</span>
                <span className={css.sidebarSpacer} />
                <button className={css.btn} title="刷新目录与配置" onClick={refreshAll}>↻</button>
                <button className={css.btn} title="折叠侧边栏" onClick={() => setSidebarOpen(false)}>◀</button>
              </div>
              {rootChildren === undefined
                ? <div className={css.hint}>加载中…</div>
                : rootChildren.length > 0
                  ? <div className={css.sidebarList} ref={sidebarListRef}>{rootChildren.map(n => renderNode(n, 0))}</div>
                  : <div className={css.hint}>无文件</div>}
            </div>
          )
          : (
            <div className={css.rail}>
              <button className={css.railBtn} title="展开文件列表" onClick={() => setSidebarOpen(true)}>▶</button>
            </div>
          )}
        <div className={css.body}>
          {body}
          {file !== null && !file.isImage && actions}
        </div>
      </div>
      {leavePrompt && (
        <div className={css.dialogMask} onMouseDown={e => e.stopPropagation()}>
          <div className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="fp-leave-title">
            <div className={css.dialogText} id="fp-leave-title">当前文件尚未保存，切换将丢失修改。确定切换？</div>
            <div className={css.dialogActions}>
              <button type="button" className={css.dialogCancel} autoFocus onClick={() => finishLeave(false)}>取消</button>
              <button type="button" className={css.dialogOk} onClick={() => finishLeave(true)}>确定切换</button>
            </div>
          </div>
        </div>
      )}
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map(corner => (
        <div
          key={corner}
          className={`${css.resize ?? ''} ${CORNER_CLASS[corner] ?? ''}`}
          title="拖动调整大小"
          onPointerDown={(e) => {
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            setResize({ pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, w: size.w, h: size.h, x: pos.x, y: pos.y, corner })
          }}
          onPointerMove={(e) => {
            if (!resize || e.pointerId !== resize.pointerId) return
            const vp = viewport()
            const dx = e.clientX - resize.startX
            const dy = e.clientY - resize.startY
            const minW = 320
            const minH = 240
            let w = resize.w
            let h = resize.h
            let x = resize.x
            let y = resize.y
            if (corner.includes('left')) { w = Math.max(minW, resize.w - dx); x = resize.x + resize.w - w }
            else { w = Math.max(minW, Math.min(resize.w + dx, vp.w - resize.x - 8)) }
            if (corner.includes('top')) { h = Math.max(minH, resize.h - dy); y = resize.y + resize.h - h }
            else { h = Math.max(minH, Math.min(resize.h + dy, vp.h - resize.y - 8)) }
            setSize({ w, h })
            setPos({ x, y })
          }}
          onPointerUp={(e) => { if (resize && e.pointerId === resize.pointerId) setResize(null) }}
        />
      ))}
    </div>
  )
}

export function FilePreviewFab(): React.ReactElement {
  const [open, setOpenState] = useState(mdOpen)
  useEffect(() => subscribeOpen(() => setOpenState(mdOpen)), [])
  return (
    <button className={css.fabBtn} title={open ? '收起文件预览' : '打开文件预览'} onClick={() => setOpen(!open)}>
      <svg width={18} height={18} viewBox="0 0 32 32" aria-hidden>
        <circle cx={16} cy={13} r={13} fill="#f6a6c8" />
        <ellipse cx={5.2} cy={19} rx={3.4} ry={10} fill="#f6a6c8" />
        <ellipse cx={26.8} cy={19} rx={3.4} ry={10} fill="#f6a6c8" />
        <ellipse cx={16} cy={17.5} rx={9} ry={8.5} fill="#ffe9da" />
        <path d="M7 17 C7 7.5 25 7.5 25 17 C21.5 11.5 10.5 11.5 7 17 Z" fill="#f6a6c8" />
        <ellipse cx={12.3} cy={18.6} rx={1.7} ry={2.7} fill="#5b4a52" />
        <ellipse cx={19.7} cy={18.6} rx={1.7} ry={2.7} fill="#5b4a52" />
        <circle cx={13} cy={17.7} r={0.75} fill="#ffffff" />
        <circle cx={20.4} cy={17.7} r={0.75} fill="#ffffff" />
        <ellipse cx={9.6} cy={21.6} rx={2} ry={1.2} fill="#ff9fb2" opacity={0.8} />
        <ellipse cx={22.4} cy={21.6} rx={2} ry={1.2} fill="#ff9fb2" opacity={0.8} />
        <path d="M14.6 22.8 Q16 24.2 17.4 22.8" fill="none" stroke="#e0697f" strokeWidth={1.1} strokeLinecap="round" />
        <circle cx={21.5} cy={4.5} r={2.3} fill="#ff6b9d" />
        <circle cx={25.5} cy={4.5} r={2.3} fill="#ff6b9d" />
        <circle cx={23.5} cy={4.5} r={1.1} fill="#ffe1ec" />
      </svg>
      <span>文件预览</span>
    </button>
  )
}
