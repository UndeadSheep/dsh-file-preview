/**
 * Workspace file-preview plugin, browser half: the floating window
 * (shell.overlay) and the header toggle button
 * (conversation.session.header.utilities).
 * @module @undeadsheep/dsh-client-ui-file-preview/client
 */

import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `ctx.remote` base face (TypertClientRemote) via the assembly.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Runtime: self-mounts the generated `filePreview` contribution instead of
// relying on the api-remotes assembly (bundle-package spike).
import filePreviewRemote from '@undeadsheep/dsh-file-preview/remote'
// Type-only: pulls the `filePreview` namespace type merge.
import type {} from '@undeadsheep/dsh-file-preview/remote'
// Type-only: pulls the SlotMap merges for the slots this plugin registers into.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FilePreviewRemote } from './remote.ts'
import { FilePreviewFab, FilePreviewWindow, requestOpenFile } from './FilePreviewWindow.tsx'

/** Required services: the slot registry and the gateway's `remote` mount face. */
export const inject = ['slots', 'remote']

/** Last path segment (slash- or backslash-separated). */
function basenameOf(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** Whether an OS-open target names a file (dotted segment) rather than a directory. */
function isFileTarget(path: string): boolean {
  const seg = basenameOf(path)
  if (seg === '' || seg === '.' || seg === '..') return false
  return seg.includes('.')
}

/**
 * Route "open a file with the OS" (file-mention links and tool rows) into this
 * preview window instead. Directory targets — e.g. the deliverables "show
 * folder" action — keep opening with the OS default application.
 * @returns a disposer restoring the original opener.
 */
function redirectFileOpens(ctx: ClientContext): () => void {
  const workspaces = ctx.get('workspaces') as
    | { openPath?: (path: string) => Promise<unknown> }
    | undefined
  const original = workspaces?.openPath
  if (workspaces === undefined || original === undefined) return () => {}
  const bound = original.bind(workspaces)
  workspaces.openPath = (path: string) => {
    if (isFileTarget(path)) {
      requestOpenFile(path)
      return Promise.resolve(undefined)
    }
    return bound(path)
  }
  return () => { workspaces.openPath = original }
}

/**
 * Client plugin body: self-mount the `filePreview` Remote, register the floating
 * window into `shell.overlay`, the toggle button into the session header, and
 * redirect file opens into the preview.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(filePreviewRemote)
  // Read the mounted namespace through ctx.get (a soft read) rather than the
  // `ctx.remote.filePreview` proxy access, which would require declaring
  // `remote.filePreview` in `inject` — impossible here, since this very apply
  // creates it.
  const remote = ctx.get('remote.filePreview') as FilePreviewRemote

  const disposeFileOpens = redirectFileOpens(ctx)

  const disposeOverlay = ctx.slots.inject('shell.overlay', () => {
    const dispose = ctx.slots.register({
      name: 'shell.overlay',
      id: 'file-preview',
      order: 0,
      label: '文件预览',
    }, (props) => createElement(FilePreviewWindow, { remote, useSessions: props.useSessions }))
    return () => { dispose() }
  })

  const disposeFab = ctx.slots.inject('conversation.session.header.utilities', () => {
    const dispose = ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'file-preview-toggle',
      order: 100,
      label: '文件预览',
    }, () => createElement(FilePreviewFab))
    return () => { dispose() }
  })

  return async () => {
    disposeFileOpens()
    disposeOverlay()
    disposeFab()
    await disposeRemote()
  }
}
