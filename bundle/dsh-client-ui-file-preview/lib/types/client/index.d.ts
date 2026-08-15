/**
 * Workspace file-preview plugin, browser half: the floating window
 * (shell.overlay) and the header toggle button
 * (conversation.session.header.utilities).
 * @module @undeadsheep/dsh-client-ui-file-preview/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services: the slot registry and the gateway's `remote` mount face. */
export declare const inject: string[];
/**
 * Client plugin body: self-mount the `filePreview` Remote, then register the
 * floating window into `shell.overlay` and the toggle button into the session
 * header utilities.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map