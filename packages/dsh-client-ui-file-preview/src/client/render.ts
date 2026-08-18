/**
 * Pure renderers shared by the preview and editor surfaces.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/render
 */

import type { PreviewThemeColors } from '@undeadsheep/dsh-file-preview/types'

const DQ = '"'
const SQ = "'"
const TAB = '\t'
const LF = '\n'
const CR = '\r'
const BT = '`'
const BS = '\\'

export const DEFAULT_COLORS: Required<PreviewThemeColors> = {
  keyword: '#a626a4',
  string: '#50a14f',
  number: '#986801',
  comment: '#a0a1a7',
  tag: '#e45649',
  function: '#4078f2',
  type: '#c18401',
  variable: '#1a1a1a',
}

export function escapeHtml(value: string): string {
  return value
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split(DQ).join('&quot;')
    .split(SQ).join('&#39;')
}

function isDigit(c: string): boolean { return c >= '0' && c <= '9' }
function isWordStart(c: string): boolean { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' }
function isWordChar(c: string): boolean { return isWordStart(c) || isDigit(c) }

const JS_KEYWORDS = ['var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'typeof', 'instanceof', 'this', 'class', 'extends', 'super', 'import', 'export', 'default', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'null', 'undefined', 'true', 'false', 'of', 'in', 'delete', 'void', 'static', 'get', 'set']
const JSON_KEYWORDS = ['true', 'false', 'null']
const PY_KEYWORDS = ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'global', 'nonlocal', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'del', 'yield', 'assert']
const SH_KEYWORDS = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'echo', 'export', 'local', 'return', 'exit', 'in', 'readonly', 'set', 'unset']
const SQL_KEYWORDS = ['select', 'from', 'where', 'and', 'or', 'not', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop', 'alter', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'offset', 'distinct', 'as', 'null', 'primary', 'key', 'foreign', 'references']

function keywordsFor(lang: string | null): string[] {
  if (lang === 'js') return JS_KEYWORDS
  if (lang === 'json') return JSON_KEYWORDS
  if (lang === 'py') return PY_KEYWORDS
  if (lang === 'sh') return SH_KEYWORDS
  if (lang === 'sql') return SQL_KEYWORDS
  return []
}

export function langFor(path: string): string | null {
  const lower = path.toLowerCase()
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs') || lower.endsWith('.jsx') || lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'js'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.htm') || lower.endsWith('.svg') || lower.endsWith('.xhtml')) return 'xml'
  if (lower.endsWith('.py')) return 'py'
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.zsh')) return 'sh'
  if (lower.endsWith('.sql')) return 'sql'
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) return 'css'
  if (lower.endsWith('.yml') || lower.endsWith('.yaml') || lower.endsWith('.toml') || lower.endsWith('.ini') || lower.endsWith('.cfg') || lower.endsWith('.conf')) return 'yaml'
  return null
}

export function isMdPath(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase()
  return /\.(png|jpe?g|gif|webp)$/.test(lower)
}

const HEX_COLOR = /^#[0-9A-Fa-f]{3,8}$/

function safeColor(value: string | undefined): string | undefined {
  return value !== undefined && HEX_COLOR.test(value) ? value : undefined
}

type TokenKind = 'keyword' | 'string' | 'number' | 'comment' | 'tag' | 'function' | 'type' | 'variable'

export function highlight(code: string, lang: string | null, colors: PreviewThemeColors = {}): string {
  const xml = lang === 'xml'
  const keywords = keywordsFor(lang)
  const palette: Required<PreviewThemeColors> = {
    keyword: safeColor(colors.keyword) ?? DEFAULT_COLORS.keyword,
    string: safeColor(colors.string) ?? DEFAULT_COLORS.string,
    number: safeColor(colors.number) ?? DEFAULT_COLORS.number,
    comment: safeColor(colors.comment) ?? DEFAULT_COLORS.comment,
    tag: safeColor(colors.tag) ?? DEFAULT_COLORS.tag,
    function: safeColor(colors.function) ?? DEFAULT_COLORS.function,
    type: safeColor(colors.type) ?? DEFAULT_COLORS.type,
    variable: safeColor(colors.variable) ?? DEFAULT_COLORS.variable,
  }
  const out: string[] = []
  let i = 0
  const n = code.length

  const push = (token: string, kind: TokenKind | null): void => {
    if (kind === null || !palette[kind]) { out.push(escapeHtml(token)); return }
    const extra = kind === 'comment' ? ';font-style:italic' : ''
    out.push(`<span style="color:${palette[kind]}${extra}">${escapeHtml(token)}</span>`)
  }

  while (i < n) {
    const c = code.charAt(i)

    if (c === '/' && code.charAt(i + 1) === '/') {
      let j = i + 2
      while (j < n && code.charAt(j) !== LF && code.charAt(j) !== CR) j++
      push(code.slice(i, j), 'comment')
      i = j
      continue
    }
    if (c === '/' && code.charAt(i + 1) === '*') {
      let j = i + 2
      while (j < n && !(code.charAt(j) === '*' && code.charAt(j + 1) === '/')) j++
      if (j < n) j += 2
      push(code.slice(i, j), 'comment')
      i = j
      continue
    }
    if (c === '#' && (lang === 'py' || lang === 'sh' || lang === 'yaml')) {
      let j = i + 1
      while (j < n && code.charAt(j) !== LF && code.charAt(j) !== CR) j++
      push(code.slice(i, j), 'comment')
      i = j
      continue
    }
    if (xml && c === '<' && code.slice(i, i + 4) === '<!--') {
      let j = i + 4
      while (j < n && code.slice(j, j + 3) !== '-->') j++
      if (j < n) j += 3
      push(code.slice(i, j), 'comment')
      i = j
      continue
    }
    if (xml && c === '<') {
      let j = i + 1
      while (j < n && code.charAt(j) !== '>' && code.charAt(j) !== LF) j++
      if (j < n) j += 1
      push(code.slice(i, j), 'tag')
      i = j
      continue
    }
    if (c === DQ || c === SQ || c === BT) {
      const quote = c
      let j = i + 1
      while (j < n) {
        if (code.charAt(j) === BS) { j += 2; continue }
        if (code.charAt(j) === quote) { j += 1; break }
        j++
      }
      push(code.slice(i, j), 'string')
      i = j
      continue
    }
    if (isDigit(c) || (c === '.' && isDigit(code.charAt(i + 1)))) {
      let j = i
      while (j < n && (isDigit(code.charAt(j)) || code.charAt(j) === '.' || code.charAt(j) === '_')) j++
      push(code.slice(i, j), 'number')
      i = j
      continue
    }
    if (isWordStart(c)) {
      let j = i + 1
      while (j < n && isWordChar(code.charAt(j))) j++
      const word = code.slice(i, j)
      let kind: TokenKind | null
      if (keywords.includes(word)) kind = 'keyword'
      else if (code.charAt(j) === '(') kind = 'function'
      else if (word.charAt(0) >= 'A' && word.charAt(0) <= 'Z') kind = 'type'
      else kind = 'variable'
      push(word, kind)
      i = j
      continue
    }
    push(c, null)
    i++
  }

  return out.join('')
}


/** Editor helpers. */
export function leadingIndent(line: string): string {
  let i = 0
  while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === TAB)) i++
  return line.slice(0, i)
}

export function trimmedLine(line: string): string {
  let end = line.length
  while (end > 0 && (line.charAt(end - 1) === ' ' || line.charAt(end - 1) === TAB || line.charAt(end - 1) === CR || line.charAt(end - 1) === LF)) end--
  return line.slice(0, end)
}

export function indentUnit(cfg: { useTabs?: boolean; indentSize?: number }): string {
  if (cfg.useTabs) return TAB
  const n = cfg.indentSize && cfg.indentSize > 0 ? cfg.indentSize : 2
  return ' '.repeat(n)
}
