/**
 * Local structural face of the `filePreview` Remote namespace. The generated
 * `/remote` contribution (mounted by the dsh-api-remotes assembly) types
 * `ctx.remote.filePreview`; this interface names only the surface the window
 * consumes, so the generated face satisfies it structurally.
 * @module @deepseek-ai/dsh-client-ui-file-preview/client/remote
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {
  ListTreeRequest,
  ListTreeResult,
  ReadConfigRequest,
  ReadConfigResult,
  ReadFileRequest,
  ReadFileResult,
  ReadThemeRequest,
  ReadThemeResult,
  WriteFileRequest,
  WriteFileResult,
} from '@deepseek-ai/dsh-file-preview/types'

export interface FilePreviewRemote {
  listTree(request: ListTreeRequest): Promise<RemoteResult<ListTreeResult>>
  readFile(request: ReadFileRequest): Promise<RemoteResult<ReadFileResult>>
  writeFile(request: WriteFileRequest): Promise<RemoteResult<WriteFileResult>>
  readTheme(request: ReadThemeRequest): Promise<RemoteResult<ReadThemeResult>>
  readConfig(request: ReadConfigRequest): Promise<RemoteResult<ReadConfigResult>>
}
