/**
 * Built-in dark theme used by the light/dark toggle. The workspace
 * `preview-theme.json` still drives the LIGHT theme; toggling to dark switches
 * the window chrome, the editor, and the syntax palette to the official
 * One Dark values (the same palette `@codemirror/theme-one-dark` uses).
 * @module @undeadsheep/dsh-client-ui-file-preview/client/theme
 */

import type { PreviewThemeColors } from '@undeadsheep/dsh-file-preview/types'

export interface CodeTheme {
  bg: string
  fg: string
  colors: PreviewThemeColors
}

export const DARK_THEME: CodeTheme = {
  bg: '#282c34',
  fg: '#abb2bf',
  colors: {
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#5c6370',
    tag: '#e06c75',
    function: '#61afef',
    type: '#e5c07b',
    variable: '#e06c75',
  },
}
