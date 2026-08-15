/**
 * Workspace file-preview plugin, browser half: the floating window
 * (shell.overlay) and the header toggle button
 * (conversation.session.header.utilities).
 * @module @deepseek-ai/dsh-client-ui-file-preview/client
 */

import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `ctx.remote` base face (TypertClientRemote) via the assembly.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Runtime: self-mounts the generated `filePreview` contribution instead of
// relying on the api-remotes assembly (bundle-package spike).
import filePreviewRemote from '@deepseek-ai/dsh-file-preview/remote'
// Type-only: pulls the `filePreview` namespace type merge.
import type {} from '@deepseek-ai/dsh-file-preview/remote'
// Type-only: pulls the SlotMap merges for the slots this plugin registers into.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FilePreviewRemote } from './remote.ts'
import { FilePreviewFab, FilePreviewWindow } from './FilePreviewWindow.tsx'

/** Required services: the slot registry and the gateway's `remote` mount face. */
export const inject = ['slots', 'remote']

/**
 * Client plugin body: self-mount the `filePreview` Remote, then register the
 * floating window into `shell.overlay` and the toggle button into the session
 * header utilities.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(filePreviewRemote)
  // Read the mounted namespace through ctx.get (a soft read) rather than the
  // `ctx.remote.filePreview` proxy access, which would require declaring
  // `remote.filePreview` in `inject` — impossible here, since this very apply
  // creates it.
  const remote = ctx.get('remote.filePreview') as FilePreviewRemote

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
    disposeOverlay()
    disposeFab()
    await disposeRemote()
  }
}
