/**
 * Workspace-relative path and Markdown href/src policy for the preview window.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/paths
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{3,8}$/

/** Collapse a user/model path to a workspace-relative POSIX path, or null if unsafe. */
export function normalizeWorkspacePath(input: string): string | null {
  if (input.includes('\0')) return null
  const trimmed = input.trim()
  if (trimmed === '') return null
  if (/^[A-Za-z]:/.test(trimmed)) return null
  if (trimmed.startsWith('\\\\')) return null
  let p = trimmed.replace(/\\/g, '/')
  if (p.startsWith('//')) return null
  while (p.startsWith('/')) p = p.slice(1)
  if (p === '') return null
  const parts: string[] = []
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else {
      parts.push(seg)
    }
  }
  if (parts.length === 0) return null
  return parts.join('/')
}

/** Last path segment for window titles. */
export function basenameOf(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i < 0 ? path : path.slice(i + 1)
}

/**
 * Well-known extensionless filenames that session/tool "open path" should still
 * treat as files (otherwise they would be sent to the OS as folders).
 */
const EXTENSIONLESS_FILES = new Set([
  'makefile', 'gnumakefile', 'dockerfile', 'containerfile',
  'license', 'licence', 'copying', 'notice', 'authors', 'contributors',
  'changelog', 'changes', 'gemfile', 'rakefile', 'procfile',
  'jenkinsfile', 'vagrantfile', 'brewfile', 'justfile',
  'gruntfile', 'gulpfile', 'readme', 'todo', 'codeowners', 'podfile',
])

/**
 * Whether an OS-open target names a file rather than a directory.
 * Trailing slashes are directories. Dotted names (`.gitignore`, `foo.ts`) are
 * files. Extensionless names like `Makefile` / `LICENSE` are files only when
 * they match a known basename; `src` stays a directory.
 */
export function isFileTarget(path: string): boolean {
  const trimmed = path.trim()
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) return false
  const seg = basenameOf(trimmed.replace(/\\/g, '/'))
  if (seg === '' || seg === '.' || seg === '..') return false
  if (seg.includes('.')) return true
  return EXTENSIONLESS_FILES.has(seg.toLowerCase())
}

/** Parent directory paths of a workspace-relative file, root first. */
export function ancestorDirPaths(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length <= 1) return []
  const dirs: string[] = []
  for (let i = 1; i < parts.length; i++) {
    dirs.push(parts.slice(0, i).join('/'))
  }
  return dirs
}

/** Resolve a markdown local src/href against the markdown file's directory. */
export function resolveLocalPath(baseDir: string, src: string): string | null {
  if (isBlockedImageSrc(src) || isDangerousHref(src)) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null
  const joined = src.startsWith('/') ? src : `${baseDir}${src}`
  return normalizeWorkspacePath(joined)
}

/** http(s)/data/protocol-relative image sources must not be fetched by the browser. */
export function isBlockedImageSrc(src: string): boolean {
  const lower = src.trim().toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || src.startsWith('//')
}

/** Schemes that must never become an `<a href>`. */
export function isDangerousHref(href: string): boolean {
  const lower = href.trim().toLowerCase()
  return lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:') || href.startsWith('//')
}

/** Links allowed to open in a new tab. */
export function isSafeExternalHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim())
}

/** True when `href` has a URI scheme (or is protocol-relative). */
export function hasUriScheme(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

/** Accept only hex colors so theme JSON cannot break out of inline styles. */
export function sanitizeHexColor(value: string): string | undefined {
  return HEX_COLOR.test(value) ? value : undefined
}
