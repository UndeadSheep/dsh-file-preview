/**
 * Browser half: the floating file-preview window and the header toggle button.
 * @module @deepseek-ai/dsh-client-ui-file-preview/client/FilePreviewWindow
 */

import React, { useEffect, useRef, useState } from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConfigPayload, FileTreeNode, PreviewThemeColors, ThemePayload } from '@deepseek-ai/dsh-file-preview/types'
import type { FilePreviewRemote } from './remote.ts'
import {
  escapeHtml, highlight, indentUnit, isMdPath, langFor, leadingIndent, renderMarkdown, trimmedLine,
} from './render.ts'
import css from './FilePreviewWindow.module.css'

/** Module-level open store shared by the header button and the overlay window. */
let mdOpen = false
const openListeners = new Set<() => void>()
function setOpen(value: boolean): void {
  if (mdOpen === value) return
  mdOpen = value
  for (const fn of openListeners) fn()
}
function subscribeOpen(fn: () => void): () => void {
  openListeners.add(fn)
  return () => { openListeners.delete(fn) }
}

/** Translate a structured business failure into user-facing text. */
function describeFailure(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case 'no-workspace': return '无工作区'
    case 'not-found': return '文件不存在'
    case 'not-text': return '不是文本文件，无法预览'
    case 'too-large': return '文件过大，暂不预览'
    case 'write-denied': return '写入被沙箱拒绝'
    case 'io-failure': return error.message ?? 'IO 错误'
    default: return error.code ?? '未知错误'
  }
}

/** Unwrap the two-level envelope (carrier `RemoteResult` + business `{ ok, value }`). */
function unwrap<X>(carried: RemoteResult<unknown>): { ok: true; value: X } | { ok: false; error: string } {
  if (!carried.ok) return { ok: false, error: carried.error.message }
  const result = carried.value as { ok?: boolean; value?: X; error?: { code?: string; message?: string } }
  if (!result.ok) return { ok: false, error: describeFailure(result.error ?? {}) }
  return { ok: true, value: result.value as X }
}

const DEFAULT_CONFIG: ConfigPayload = { indentSize: 2, useTabs: false, pollInterval: 1500, fontSize: 13 }

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
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
  const [pathInput, setPathInput] = useState('')
  const [file, setFile] = useState<null | { path: string; name: string; isMarkdown: boolean }>(null)
  const [source, setSource] = useState('')
  const [html, setHtml] = useState('')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [theme, setTheme] = useState<{
    colors: PreviewThemeColors
    bg: string | undefined
    fg: string | undefined
  }>({ colors: {}, bg: undefined, fg: undefined })
  const [config, setConfig] = useState<ConfigPayload>(DEFAULT_CONFIG)
  const editorPreRef = useRef<HTMLPreElement>(null)

  useEffect(() => subscribeOpen(() => setOpenState(mdOpen)), [])
  useEffect(() => { if (open) reveal() }, [open])
  useEffect(() => { if (open && sessionId) void refreshTree() }, [open, sessionId])
  useEffect(() => {
    if (sessionId) { void refreshTree(); void loadTheme(); void loadConfig() }
  }, [sessionId])
  useEffect(() => {
    if (!open || !sessionId) return
    const id = setInterval(() => { void refreshTree() }, config.pollInterval || 1500)
    return () => clearInterval(id)
  }, [open, sessionId, config.pollInterval])

  function reveal(): void {
    const vp = viewport()
    const w = clamp(size.w, 320, Math.max(320, vp.w - 32))
    const h = clamp(size.h, 240, Math.max(240, vp.h - 32))
    setSize({ w, h })
    setPos({ x: Math.max(8, vp.w - w - 16), y: 16 })
  }

  async function refreshTree(): Promise<void> {
    if (!sessionId) return
    const res = unwrap<FileTreeNode[]>(await remote.listTree({ sessionId }))
    if (res.ok) setTree(res.value)
  }

  async function loadTheme(): Promise<void> {
    if (!sessionId) return
    const res = unwrap<ThemePayload>(await remote.readTheme({ sessionId }))
    if (res.ok) setTheme({ colors: res.value.colors, bg: res.value.bg ?? undefined, fg: res.value.fg ?? undefined })
  }

  async function loadConfig(): Promise<void> {
    if (!sessionId) return
    const res = unwrap<ConfigPayload>(await remote.readConfig({ sessionId }))
    if (res.ok) setConfig(res.value)
  }

  function refreshAll(): void {
    void refreshTree()
    void loadTheme()
    void loadConfig()
  }

  async function load(path: string): Promise<void> {
    if (!path || !sessionId) return
    setLoading(true)
    setError(null)
    const res = unwrap<{ path: string; content: string }>(await remote.readFile({ sessionId, path }))
    if (res.ok) {
      const content = res.value.content
      const isMarkdown = isMdPath(path)
      setFile({ path, name: res.value.path || path, isMarkdown })
      setSource(content)
      setHtml(isMarkdown ? renderMarkdown(content) : '')
      setDirty(false)
      setMode('preview')
    } else {
      setFile(null)
      setError(res.error)
    }
    setLoading(false)
  }

  async function save(): Promise<void> {
    if (file === null || !sessionId) return
    setLoading(true)
    const res = unwrap<{ path: string }>(await remote.writeFile({ sessionId, path: file.path, content: source }))
    if (res.ok) {
      setDirty(false)
      if (file.isMarkdown) setHtml(renderMarkdown(source))
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  function toggleDir(path: string): void {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }))
  }

  function changeFontSize(delta: number): void {
    setConfig(c => ({ ...c, fontSize: clamp((c.fontSize || 13) + delta, 10, 32) }))
  }

  function switchToPreview(): void {
    if (file?.isMarkdown) setHtml(renderMarkdown(source))
    setMode('preview')
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      e.stopPropagation()
      if (file !== null && dirty) void save()
    }
  }

  if (!open) return null

  const fontSizePx = `${config.fontSize || 13}px`
  const actions = (
    <div className={css.actions}>
      <button className={css.modeBtn} title="减小字号" onClick={() => changeFontSize(-1)}>A−</button>
      <span className={css.fontSize}>{config.fontSize || 13}</span>
      <button className={css.modeBtn} title="增大字号" onClick={() => changeFontSize(1)}>A+</button>
      <span className={css.sep} />
      <button className={mode === 'preview' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn} onClick={switchToPreview}>预览</button>
      <button className={mode === 'edit' ? `${css.modeBtn} ${css.modeBtnOn}` : css.modeBtn} onClick={() => setMode('edit')}>编辑</button>
      <button className={css.saveBtn} disabled={file === null || !dirty} onClick={() => void save()}>保存</button>
    </div>
  )

  let body: React.ReactNode = null
  if (loading) {
    body = <div className={css.hint}>加载中…</div>
  } else if (error !== null) {
    body = <div className={`${css.scroll} ${css.error}`}>{error}</div>
  } else if (file === null) {
    body = <div className={css.hint}>点击左侧文件预览</div>
  } else if (mode === 'edit') {
    const lang = langFor(file.path)
    const editorHtml = (lang ? highlight(source, lang, theme.colors) : escapeHtml(source)) + '\n'
    const wrapStyle = theme.bg ? { background: theme.bg } : undefined
    const preStyle: React.CSSProperties = { fontSize: fontSizePx, color: theme.fg ?? '#1a1a1a' }
    const caretColor = theme.fg || '#1a1a1a'
    body = (
      <div className={css.editorWrap} style={wrapStyle}>
        <pre ref={editorPreRef} className={css.editorBg} aria-hidden style={preStyle} dangerouslySetInnerHTML={{ __html: editorHtml }} />
        <textarea
          className={css.editor}
          value={source}
          spellCheck={false}
          autoFocus
          style={{ caretColor, fontSize: fontSizePx }}
          onScroll={(e) => {
            if (editorPreRef.current) {
              editorPreRef.current.scrollTop = e.currentTarget.scrollTop
              editorPreRef.current.scrollLeft = e.currentTarget.scrollLeft
            }
          }}
          onChange={(e) => { setSource(e.target.value); setDirty(true) }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || (e.nativeEvent as KeyboardEvent).keyCode === 229) return
            if (e.key === 'Enter') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const before = source.slice(0, start)
              const lineStart = before.lastIndexOf('\n') + 1
              const lineText = before.slice(lineStart)
              let indent = leadingIndent(lineText)
              const lastCh = trimmedLine(lineText).slice(-1)
              if (lastCh === '{' || lastCh === '[' || lastCh === '(') indent += indentUnit(config)
              setSource(before + '\n' + indent + source.slice(end))
              setDirty(true)
              const cursor = start + 1 + indent.length
              requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor))
            } else if (e.key === 'Tab') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const unit = indentUnit(config)
              setSource(source.slice(0, start) + unit + source.slice(end))
              setDirty(true)
              const cursor = start + unit.length
              requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor))
            } else if (e.key === '"' || e.key === "'" || e.key === '`') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              setSource(source.slice(0, start) + e.key + source.slice(start, end) + e.key + source.slice(end))
              setDirty(true)
              const cursor = start === end ? start + 1 : end + 2
              requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor))
            } else if (e.key === '(' || e.key === '[' || e.key === '{') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const close = e.key === '(' ? ')' : e.key === '[' ? ']' : '}'
              setSource(source.slice(0, start) + e.key + source.slice(start, end) + close + source.slice(end))
              setDirty(true)
              const cursor = start === end ? start + 1 : end + 2
              requestAnimationFrame(() => ta.setSelectionRange(cursor, cursor))
            }
          }}
        />
      </div>
    )
  } else if (file.isMarkdown) {
    body = (
      <div className={css.scroll}>
        <div className={css.meta}>{file.name}</div>
        <div className={css.out} style={{ fontSize: fontSizePx }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    )
  } else {
    const lang = langFor(file.path)
    const plainHtml = lang ? highlight(source, lang, theme.colors) : escapeHtml(source)
    const scrollStyle = theme.bg ? { background: theme.bg } : undefined
    const preStyle: React.CSSProperties = { fontSize: fontSizePx }
    if (theme.fg) preStyle.color = theme.fg
    body = (
      <div className={css.scroll} style={scrollStyle}>
        <div className={css.meta} style={theme.fg ? { color: theme.fg } : undefined}>{file.name}</div>
        <pre className={css.plain} style={preStyle} dangerouslySetInnerHTML={{ __html: plainHtml }} />
      </div>
    )
  }

  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode => {
    const style = { paddingLeft: 10 + depth * 14 }
    if (node.type === 'dir') {
      const isOpen = !!expanded[node.path]
      return (
        <div key={node.path}>
          <button className={css.treeNode} style={style} title={node.path} onClick={() => toggleDir(node.path)}>
            <span className={css.caret}>{isOpen ? '▾' : '▸'}</span>
            <span className={css.nodeIcon}>📁</span>
            <span className={css.nodeName}>{node.name}</span>
          </button>
          {isOpen && node.children.map(c => renderNode(c, depth + 1))}
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
        onClick={() => { setPathInput(node.path); void load(node.path) }}
      >
        <span className={css.caret}> </span>
        <span className={css.nodeIcon}>{node.type === 'file' ? '📄' : '▪'}</span>
        <span className={css.nodeName}>{node.name}</span>
      </button>
    )
  }

  return (
    <div
      className={css.win}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
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
        <div className={css.title}>文件预览</div>
        <button className={css.closeBtn} title="收起" onClick={() => setOpen(false)}>—</button>
      </div>
      <div className={css.toolbar}>
        <input
          className={css.input}
          value={pathInput}
          placeholder="输入文件路径（相对工作区或绝对）"
          onChange={e => setPathInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load(pathInput) }}
        />
        <button className={css.btn} onClick={() => void load(pathInput)}>打开</button>
      </div>
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
              {tree.length > 0
                ? <div className={css.sidebarList}>{tree.map(n => renderNode(n, 0))}</div>
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
          {file !== null && actions}
        </div>
      </div>
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
