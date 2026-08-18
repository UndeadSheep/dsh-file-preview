/**
 * Quick-open input: fuzzy-search workspace files (debounced) with a dropdown,
 * keyboard navigation, a clear button, and a "recent files" list when empty.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/QuickOpen
 */

import React, { forwardRef, useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { FilePreviewRemote } from './remote.ts'
import { loadRecent } from './recent.ts'
import { normalizeWorkspacePath } from './paths.ts'
import css from './FilePreviewWindow.module.css'

export interface QuickOpenProps {
  sessionId: SessionId | undefined
  remote: FilePreviewRemote
  onOpen: (path: string) => void
}

/** Highlight the matched subsequence characters of `query` within `path`. */
function highlightMatch(path: string, query: string): React.ReactNode {
  const q = query.toLowerCase()
  const p = path.toLowerCase()
  const indices: number[] = []
  let i = 0
  for (let j = 0; j < p.length && i < q.length; j++) {
    if (p[j] === q[i]) { indices.push(j); i++ }
  }
  if (indices.length === 0) return path
  const nodes: React.ReactNode[] = []
  let last = 0
  for (const idx of indices) {
    if (idx > last) nodes.push(path.slice(last, idx))
    nodes.push(<mark key={idx}>{path[idx]}</mark>)
    last = idx + 1
  }
  if (last < path.length) nodes.push(path.slice(last))
  return nodes
}

export const QuickOpen = forwardRef<HTMLInputElement, QuickOpenProps>(function QuickOpen(
  { sessionId, remote, onOpen },
  ref,
): React.ReactElement {
  const [value, setValue] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(() => loadRecent(sessionId === undefined ? undefined : String(sessionId)))
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const focusedRef = useRef(false)

  function setInputRef(el: HTMLInputElement | null): void {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
  }

  function openPath(path: string): void {
    const normalized = normalizeWorkspacePath(path)
    setValue('')
    setItems([])
    setOpen(false)
    onOpen(normalized ?? path)
  }

  useEffect(() => {
    const r = loadRecent(sessionId === undefined ? undefined : String(sessionId))
    setRecent(r)
    if (value.trim() === '') setItems(r)
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search (or recent files when the query is empty).
  // Only updates the candidate list — dropdown visibility is driven by focus / click-outside.
  useEffect(() => {
    if (!sessionId) return
    const q = value.trim()
    if (q === '') {
      setItems(recent)
      setActiveIndex(-1)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      const res = await remote.searchFiles({ sessionId, query: q })
      if (cancelled) return
      const matches = res.ok && res.value.ok ? res.value.value : []
      setItems(matches)
      setActiveIndex(matches.length > 0 ? 0 : -1)
    }, 150)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [value, sessionId, remote, recent])

  // Click outside the input + dropdown closes the suggestion list.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length === 0) return
      setOpen(true)
      setActiveIndex(i => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length === 0) return
      setOpen(true)
      setActiveIndex(i => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < items.length) {
        const item = items[activeIndex]
        if (item !== undefined) openPath(item)
      } else {
        const raw = value.trim()
        if (raw !== '') openPath(raw)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  function clear(): void {
    const r = loadRecent(sessionId === undefined ? undefined : String(sessionId))
    setRecent(r)
    setValue('')
    setItems(r)
    setOpen(true)
    inputRef.current?.focus()
  }

  const emptyHint = value.trim() === '' ? '暂无最近打开的文件' : '没有匹配的文件'

  return (
    <div className={css.quickOpen} ref={wrapRef}>
      <input
        ref={setInputRef}
        className={css.input}
        value={value}
        placeholder="输入文件路径 / 搜索文件"
        onChange={e => {
          setValue(e.target.value)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          focusedRef.current = true
          const r = loadRecent(sessionId === undefined ? undefined : String(sessionId))
          setRecent(r)
          if (value.trim() === '') setItems(r)
          setOpen(true)
        }}
        onBlur={() => {
          focusedRef.current = false
          setOpen(false)
        }}
      />
      {value !== '' && (
        <button type="button" className={css.clearBtn} title="清空" onMouseDown={e => { e.preventDefault(); clear() }}>×</button>
      )}
      {open && (
        <div className={css.quickOpenList}>
          {items.length === 0
            ? <div className={css.quickOpenEmpty}>{emptyHint}</div>
            : items.map((item, i) => (
              <div
                key={item}
                className={i === activeIndex ? `${css.quickOpenItem} ${css.quickOpenItemActive}` : css.quickOpenItem}
                onMouseDown={e => { e.preventDefault(); openPath(item) }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {value.trim() === '' ? item : highlightMatch(item, value.trim())}
              </div>
            ))}
        </div>
      )}
    </div>
  )
})
