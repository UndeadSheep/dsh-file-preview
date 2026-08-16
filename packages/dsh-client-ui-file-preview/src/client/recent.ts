/**
 * Recently-opened file paths, persisted in localStorage. Used by the quick-open
 * input to show "recent files" when the query is empty.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/recent
 */

const KEY = 'file-preview-recent-files'
const MAX = 20

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordRecent(path: string): void {
  try {
    const list = loadRecent().filter(p => p !== path)
    list.unshift(path)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch { /* ignore storage errors */ }
}
