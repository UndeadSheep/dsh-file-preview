/**
 * Listing, search, and read/write gates shared by the file-preview Remote.
 * @module @undeadsheep/dsh-file-preview/gates
 */

/** Directory names to skip while listing: heavy/noise trees and secret stores. */
export const SKIP_DIRS = new Set([
  'node_modules', '.pnpm', '.pnpm-store', '.yarn', '.git', '.hg', '.svn',
  '.next', '.nuxt', '.cache', '.parcel-cache', '.turbo',
  '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.ssh',
])

/** Max children returned for one `listDir` (after sort). */
export const LIST_DIR_MAX_CHILDREN = 1000

/** Max UTF-8 byte length of theme/config JSON the preview will read. */
export const MAX_CONFIG_BYTES = 256 * 1024

const HEX_COLOR = /^#[0-9A-Fa-f]{3,8}$/
const FONT_FAMILY = /^[a-zA-Z0-9\s'",\-]+$/

/** Last path segment (slash-separated). */
export function basenameOf(path: string): string {
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const i = trimmed.lastIndexOf('/')
  return i < 0 ? trimmed : trimmed.slice(i + 1)
}

/** True when a file or directory name should never be listed, searched, read, or written. */
export function isSensitiveName(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower === '.env' || lower.startsWith('.env.')) return true
  if (lower.endsWith('.pem') || lower.endsWith('.key') || lower.endsWith('.p12') || lower.endsWith('.pfx')) return true
  if (lower === '.npmrc' || lower === '.netrc') return true
  if (lower === 'id_rsa' || lower.startsWith('id_rsa')) return true
  return false
}

/** True when a path segment is a skipped directory. Exact name only — `.git` must
 *  not match `.gitignore` or `.github`. */
export function isSkippedDirName(name: string): boolean {
  return SKIP_DIRS.has(name)
}
export function isSensitivePath(path: string): boolean {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  for (const part of parts) {
    if (isSkippedDirName(part) || isSensitiveName(part)) return true
  }
  return false
}

/** Accept only hex colors so theme JSON cannot break out of `style="color:…"`. */
export function sanitizeHexColor(value: string): string | undefined {
  return HEX_COLOR.test(value) ? value : undefined
}

/** Accept a CSS font-family list with no comments, urls, or braces. */
export function sanitizeFontFamily(value: string): string | undefined {
  if (value.length === 0 || value.length > 200) return undefined
  return FONT_FAMILY.test(value) ? value : undefined
}

/** Clamp the tree-poll interval to a bounded range (ms). */
export function clampPollInterval(value: number): number {
  if (!Number.isFinite(value)) return 1500
  return Math.min(60000, Math.max(500, Math.round(value)))
}
