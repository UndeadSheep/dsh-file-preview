/**
 * Embedded JetBrains Mono (SIL OFL 1.1). The .woff2 is base64-inlined at build
 * time by the `dsh-font-inline` plugin, so the preview shows the font without
 * requiring it to be installed locally.
 * @module @undeadsheep/dsh-client-ui-file-preview/client/font
 */

import jetbrainsMonoRegularUrl from './JetBrainsMono-Regular.woff2'

/** Font family registered by the embedded @font-face. */
export const EMBEDDED_CODE_FONT = 'JetBrains Mono'

const STYLE_TAG_ID = 'file-preview-font-jetbrains-mono'

/** Inject the embedded font's @font-face once (idempotent across module reloads). */
export function ensureCodeFont(): void {
  if (typeof document === 'undefined' || jetbrainsMonoRegularUrl === '') return
  if (document.querySelector(`style[data-plugin-font="${STYLE_TAG_ID}"]`) !== null) return
  const style = document.createElement('style')
  style.dataset.pluginFont = STYLE_TAG_ID
  style.textContent = `@font-face{font-family:'${EMBEDDED_CODE_FONT}';src:url(${jetbrainsMonoRegularUrl}) format('woff2');font-weight:400;font-style:normal;font-display:block}`
  document.head.appendChild(style)
}

/** Default monospace stack: embedded JetBrains Mono first, then system fallbacks. */
export const DEFAULT_CODE_FONT_FAMILY = `'${EMBEDDED_CODE_FONT}', ui-monospace, 'Cascadia Code', Consolas, monospace`
