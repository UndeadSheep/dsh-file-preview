/**
 * CodeMirror 6-backed editor for code preview/edit. Replaces the hand-written
 * textarea + `<pre>` overlay: CodeMirror virtualizes the viewport and tokenizes
 * incrementally, so large files stay fast to open, scroll, and drag.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/CodeEditor
 */

import React, { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { tags as t } from '@lezer/highlight'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { sql } from '@codemirror/lang-sql'
import type { PreviewThemeColors } from '@undeadsheep/dsh-file-preview/types'
import { DEFAULT_COLORS } from './render.ts'
import cssModule from './FilePreviewWindow.module.css'

export interface CodeEditorProps {
  value: string
  path: string
  editable: boolean
  onChange?: (value: string) => void
  colors: PreviewThemeColors
  bg: string | undefined
  fg: string | undefined
  fontSize: number
  fontFamily: string
  dark: boolean
}

/** Map a file path to a CodeMirror language support (null = plain text). */
function languageFor(path: string): Extension | null {
  const lower = path.toLowerCase()
  if (/\.js$|\.mjs$|\.cjs$/.test(lower)) return javascript()
  if (/\.jsx$/.test(lower)) return javascript({ jsx: true })
  if (/\.ts$/.test(lower)) return javascript({ typescript: true })
  if (/\.tsx$/.test(lower)) return javascript({ jsx: true, typescript: true })
  if (/\.json$/.test(lower)) return json()
  if (/\.py$/.test(lower)) return python()
  if (/\.css$/.test(lower)) return css()
  if (/\.(html|htm|xml|svg|xhtml)$/.test(lower)) return html()
  if (/\.sql$/.test(lower)) return sql()
  return null
}

/**
 * Map the workspace palette (preview-theme.json) to CodeMirror's standard Lezer
 * highlight tags. The 8 palette colors override their tag groups; every other
 * tag (operators, punctuation, markdown headings/links, …) falls back to the
 * official `defaultHighlightStyle`, so nothing renders un-colored.
 */
function highlightStyleFor(colors: PreviewThemeColors, dark: boolean): HighlightStyle {
  const c = { ...DEFAULT_COLORS, ...colors }
  const fallback = dark ? oneDarkHighlightStyle.specs : defaultHighlightStyle.specs
  return HighlightStyle.define([
    ...fallback,
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.bool, t.null, t.atom], color: c.keyword },
    { tag: [t.string, t.special(t.string), t.character, t.regexp, t.escape], color: c.string },
    { tag: [t.number, t.integer, t.float], color: c.number },
    { tag: [t.comment, t.blockComment, t.lineComment, t.docComment], color: c.comment, fontStyle: 'italic' },
    { tag: [t.tagName, t.angleBracket], color: c.tag },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: c.function },
    { tag: [t.typeName, t.className, t.namespace, t.macroName], color: c.type },
    { tag: [t.variableName, t.propertyName, t.attributeName, t.attributeValue, t.definition(t.variableName), t.definition(t.propertyName)], color: c.variable },
  ])
}

export function CodeEditor({
  value,
  path,
  editable,
  onChange,
  colors,
  bg,
  fg,
  fontSize,
  fontFamily,
  dark,
}: CodeEditorProps): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // (Re)create the view when the static config changes. `value` is deliberately
  // NOT a dep — otherwise typing would recreate the editor on every keystroke.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      EditorState.readOnly.of(!editable),
      syntaxHighlighting(highlightStyleFor(colors, dark)),
      indentUnit.of('  '),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
          backgroundColor: bg ?? 'transparent',
          color: fg ?? 'inherit',
          fontFamily,
        },
        '.cm-content': { caretColor: fg ?? 'auto' },
        '.cm-gutters': { backgroundColor: 'transparent', color: '#999', border: 'none' },
        '&.cm-focused': { outline: 'none' },
        ...(editable ? {} : { '.cm-cursor': { display: 'none' } }),
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
      }),
    ]
    const lang = languageFor(path)
    if (lang) extensions.push(lang)
    if (editable) {
      extensions.push(keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]))
      extensions.push(closeBrackets())
    }
    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [path, editable, colors, bg, fg, fontSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync externally-changed `value` (loading another file) into the view.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={hostRef} className={cssModule.codeEditor} />
}
