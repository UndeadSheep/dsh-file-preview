/**
 * Recently-opened file paths, persisted in localStorage per session so switching
 * workspaces does not surface another project's files.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/recent
 */

const MAX = 20

function storageKey(sessionId: string): string {
  return `file-preview-recent-files:${sessionId}`
}

export function loadRecent(sessionId: string | undefined): string[] {
  if (!sessionId) return []
  try {
    const raw = localStorage.getItem(storageKey(sessionId))
    if (!raw) return []
    const arr: unknown = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordRecent(sessionId: string | undefined, path: string): void {
  if (!sessionId) return
  try {
    const list = loadRecent(sessionId).filter(p => p !== path)
    list.unshift(path)
    localStorage.setItem(storageKey(sessionId), JSON.stringify(list.slice(0, MAX)))
  } catch { /* ignore storage errors */ }
}
