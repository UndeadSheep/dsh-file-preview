# @undeadsheep/dsh-file-preview

Workspace file-preview **host** half: a Typert Remote (`filePreview`) that lists the
workspace tree, reads/writes text files, and resolves the preview theme and config for
the browser half.

The browser UI lives in a separate package:
[`@undeadsheep/dsh-client-ui-file-preview`](../dsh-client-ui-file-preview).

## Remote surface

| Method | Request | Result |
|--------|---------|--------|
| `listDir` | `{ sessionId, path }` | `Ok<FileTreeNode[]> \| Rejected` |
| `readFile` | `{ sessionId, path }` | `Ok<{ path, content }> \| Rejected` |
| `readImage` | `{ sessionId, path }` | `Ok<{ path, mimeType, data }> \| Rejected` |
| `writeFile` | `{ sessionId, path, content }` | `Ok<{ path }> \| Rejected` |
| `readTheme` | `{ sessionId }` | `Ok<{ colors, bg, fg }>` |
| `readConfig` | `{ sessionId }` | `Ok<{ indentSize, useTabs, pollInterval, fontSize }>` |

Business results use the repo's `{ ok: true, value } | { ok: false, error: { code, ... } }`
convention; the generated `./remote` face wraps them in the `RemoteResult` carrier.
Wire codecs are generated from the `@Remote` method types by typert codegen — there is
no hand-written schema file.

`listDir` lists a single directory (`path` = `''` for the workspace root) and skips
heavy/noise directories (`node_modules`, `.git`, `.next`, …); dir nodes carry empty
`children`, which the browser half fills lazily by calling `listDir` again when a
directory is expanded.

## Config

| Key | Default | Meaning |
|-----|---------|---------|
| `maxFileBytes` | 2097152 | Maximum UTF-8 byte length the preview will read |
| `maxImageBytes` | 5242880 | Maximum byte length of an inline image the preview will read |

## Workspace config files (read per Session, optional)

- `preview.config.json` — `indentSize`, `useTabs`, `pollInterval`, `fontSize`
  (with `.prettierrc` / `package.json#prettier` fallback for indent knobs)
- `preview-theme.json` — `keyword`, `string`, `number`, `comment`, `tag`,
  `function`, `type`, `variable`, `background`, `foreground`
- `.vscode/settings.json` — `editor.tokenColorCustomizations` and
  `workbench.colorCustomizations` are read as a fallback theme

## Known limitations

- Preview is text-only; binary or oversized files return `not-text` / `too-large`.
- Syntax highlighting is a lightweight hand-written tokenizer (not highlight.js /
  TextMate), and a prettier engine cannot be embedded.
- Auto-refresh is polling (`pollInterval`), not a real file watcher.
