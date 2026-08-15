/**
 * Package-owned invariant companion for `@undeadsheep/dsh-client-ui-file-preview`.
 * @module @undeadsheep/dsh-client-ui-file-preview/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@undeadsheep/dsh-client-ui-file-preview'

/** Cordis companion plugin name. */
export const name = 'client-ui-file-preview-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin owns two slot registrations, both released
 * by their effect disposers. The lifecycle spec proves the registrations are
 * withdrawn when the owning fiber is disposed, so no second authority exists
 * to check at runtime.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
