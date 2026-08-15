/**
 * Public request, value, and failure vocabulary for workspace file preview.
 * Types only, so the generated Remote client can consume it without importing
 * Host runtime code.
 * @module @undeadsheep/dsh-file-preview/types
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One node in the workspace file tree (directories nest their children). */
export type FileTreeNode =
  | { readonly type: 'dir'; readonly name: string; readonly path: string; readonly children: FileTreeNode[] }
  | { readonly type: 'file'; readonly name: string; readonly path: string; readonly size?: number }
  | { readonly type: 'other'; readonly name: string; readonly path: string; readonly size?: number }

/** Successful business-operation branch. */
export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

/** The Session has no resolvable workspace root. */
export interface FilePreviewNoWorkspace {
  readonly code: 'no-workspace'
}

/** The requested path does not exist or is not reachable. */
export interface FilePreviewNotFound {
  readonly code: 'not-found'
  readonly path: string
}

/** The requested path is not a regular text file. */
export interface FilePreviewNotText {
  readonly code: 'not-text'
  readonly path: string
}

/** The requested file exceeds the configured read size bound. */
export interface FilePreviewTooLarge {
  readonly code: 'too-large'
  readonly path: string
  readonly maxBytes: number
  readonly size: number
}

/** The write was rejected by the resolved sandbox policy. */
export interface FilePreviewWriteDenied {
  readonly code: 'write-denied'
  readonly path: string
}

/** Unexpected filesystem/transport failure caught at the service boundary. */
export interface FilePreviewIoFailure {
  readonly code: 'io-failure'
  readonly message: string
}

/** Failures shared by the file-preview operations. */
export type FilePreviewFailure =
  | FilePreviewNoWorkspace
  | FilePreviewNotFound
  | FilePreviewNotText
  | FilePreviewTooLarge
  | FilePreviewWriteDenied
  | FilePreviewIoFailure

/** Rejected business-operation branch with a stable failure. */
export interface Rejected<E extends FilePreviewFailure> {
  readonly ok: false
  readonly error: E
}

/** Request: list the workspace file tree for one Session. */
export interface ListTreeRequest {
  readonly sessionId: SessionId
}

/** Request: read one UTF-8 text file. */
export interface ReadFileRequest {
  readonly sessionId: SessionId
  readonly path: string
}

/** Request: read one image file as base64 for inline preview. */
export interface ReadImageRequest {
  readonly sessionId: SessionId
  readonly path: string
}

/** Request: overwrite one text file. */
export interface WriteFileRequest {
  readonly sessionId: SessionId
  readonly path: string
  readonly content: string
}

/** Request: resolve the preview theme for one Session. */
export interface ReadThemeRequest {
  readonly sessionId: SessionId
}

/** Request: resolve the preview config for one Session. */
export interface ReadConfigRequest {
  readonly sessionId: SessionId
}

/** Full tree listing outcome. */
export type ListTreeResult =
  | Ok<FileTreeNode[]>
  | Rejected<FilePreviewNoWorkspace | FilePreviewIoFailure>

/** Read one UTF-8 text file. */
export type ReadFileResult =
  | Ok<{ path: string; content: string }>
  | Rejected<FilePreviewNotFound | FilePreviewNotText | FilePreviewTooLarge | FilePreviewIoFailure>

/** Decoded image payload: base64 bytes plus MIME type for an inline <img>. */
export interface ImagePayload {
  path: string
  mimeType: string
  /** Base64-encoded bytes. */
  data: string
}

/** Read one image file as base64. */
export type ReadImageResult =
  | Ok<ImagePayload>
  | Rejected<FilePreviewNotFound | FilePreviewNotText | FilePreviewTooLarge | FilePreviewIoFailure>

/** Overwrite one text file. */
export type WriteFileResult =
  | Ok<{ path: string }>
  | Rejected<FilePreviewNotFound | FilePreviewWriteDenied | FilePreviewIoFailure>

/** Syntax-highlight palette keys the browser half consumes. */
export interface PreviewThemeColors {
  keyword?: string
  string?: string
  number?: string
  comment?: string
  tag?: string
  function?: string
  type?: string
  variable?: string
}

/** Resolved theme payload: palette plus optional editor background/foreground. */
export interface ThemePayload {
  readonly colors: PreviewThemeColors
  readonly bg: string | null
  readonly fg: string | null
}

/** Theme resolution always succeeds (missing files yield defaults). */
export type ReadThemeResult = Ok<ThemePayload>

/** Editor/behaviour knobs resolved from the workspace config. */
export interface ConfigPayload {
  indentSize: number
  useTabs: boolean
  pollInterval: number
  /** Preview/editor text size in px. */
  fontSize: number
}

/** Config resolution always succeeds (missing files yield defaults). */
export type ReadConfigResult = Ok<ConfigPayload>
