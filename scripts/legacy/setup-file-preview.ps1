# setup-file-preview.ps1
# Copies the two packages into the harness repo and performs all 7 wiring edits.
# Idempotent: safe to re-run. Run once; approve the permission prompt.
$ErrorActionPreference = 'Stop'

$Repo = 'E:\Projects\deepseek-harness'
$Ws   = 'E:\DSHProjects\P_plugin'

function Patch-Lines {
  param([string]$Path, [string[]]$AnchorLines, [string[]]$InsertLines, [string]$Marker)
  $full = Join-Path $Repo $Path
  if (-not (Test-Path -LiteralPath $full)) { Write-Output "  MISSING: $Path"; return }
  $text = [IO.File]::ReadAllText($full)
  if ($text.Contains($Marker)) { Write-Output "  SKIP (done): $Path"; return }
  $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $anchor = $AnchorLines -join $nl
  if (-not $text.Contains($anchor)) { Write-Output "  NOMATCH: $Path"; return }
  $count = ([regex]::Matches($text, [regex]::Escape($anchor))).Count
  if ($count -ne 1) { Write-Output "  AMBIGUOUS($count): $Path"; return }
  $text = $text.Replace($anchor, ($anchor + $nl + ($InsertLines -join $nl)))
  [IO.File]::WriteAllText($full, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Output "  PATCHED: $Path"
}

function Patch-All {
  param([string]$Path, [string[]]$AnchorLines, [string[]]$InsertLines, [string]$Marker)
  $full = Join-Path $Repo $Path
  if (-not (Test-Path -LiteralPath $full)) { Write-Output "  MISSING: $Path"; return }
  $text = [IO.File]::ReadAllText($full)
  if ($text.Contains($Marker)) { Write-Output "  SKIP (done): $Path"; return }
  $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $anchor = $AnchorLines -join $nl
  if (-not $text.Contains($anchor)) { Write-Output "  NOMATCH: $Path"; return }
  $text = $text.Replace($anchor, ($anchor + $nl + ($InsertLines -join $nl)))
  [IO.File]::WriteAllText($full, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Output "  PATCHED(all): $Path"
}

Write-Output '== 0. Copy packages =='

$hostPkg   = Join-Path $Repo 'packages\workspace\file-preview'
$clientPkg = Join-Path $Repo 'packages\client\ui-file-preview'

if (Test-Path $hostPkg)   { Remove-Item -Recurse -Force $hostPkg }
if (Test-Path $clientPkg) { Remove-Item -Recurse -Force $clientPkg }
Copy-Item -Recurse -Force (Join-Path $Ws 'dsh-file-preview')          $hostPkg
Copy-Item -Recurse -Force (Join-Path $Ws 'dsh-client-ui-file-preview') $clientPkg

# Drop the stale single-package leftovers in the host package.
$staleClient = Join-Path $hostPkg 'src\client'
$staleSpec   = Join-Path $hostPkg 'src\spec.ts'
if (Test-Path $staleClient) { Remove-Item -Recurse -Force $staleClient }
if (Test-Path $staleSpec)   { Remove-Item -Force $staleSpec }
Write-Output '  copied + cleaned.'

Write-Output '== 1. Root tsconfig aggregates =='
Patch-Lines 'tsconfig.host.json' @('    { "path": "./packages/workspace/workspace" }') @('    { "path": "./packages/workspace/file-preview" }') './packages/workspace/file-preview'
Patch-Lines 'tsconfig.client.json' @('    { "path": "./packages/client/ui-message-feedback" }') @('    { "path": "./packages/client/ui-file-preview" }') './packages/client/ui-file-preview'

Write-Output '== 2. dsh-api-remotes wiring =='
Patch-Lines 'packages\api\remotes\src\client\index.ts' @("import messageFeedbackRemote from '@deepseek-ai/dsh-message-feedback/remote'") @("import filePreviewRemote from '@deepseek-ai/dsh-file-preview/remote'") 'filePreviewRemote'
Patch-Lines 'packages\api\remotes\src\client\index.ts' @("export type {} from '@deepseek-ai/dsh-message-feedback/remote'") @("export type {} from '@deepseek-ai/dsh-file-preview/remote'") "'@deepseek-ai/dsh-file-preview/remote'"
Patch-Lines 'packages\api\remotes\src\client\index.ts' @('      commandsRemote, goalsRemote, dynamicRemote, pluginInventoryRemote, messageFeedbackRemote,') @('      commandsRemote, goalsRemote, dynamicRemote, pluginInventoryRemote, messageFeedbackRemote, filePreviewRemote,') 'messageFeedbackRemote, filePreviewRemote'
Patch-All  'packages\api\remotes\package.json' @('    "@deepseek-ai/dsh-message-feedback": "workspace:^"') @('    "@deepseek-ai/dsh-file-preview": "workspace:^"') '"@deepseek-ai/dsh-file-preview": "workspace:^"'
Patch-Lines 'packages\api\remotes\tsconfig.client.json' @('      "path": "../../feedback/message-feedback"') @('      "path": "../../workspace/file-preview"') '"../../workspace/file-preview"'

Write-Output '== 3. Composition rows (web-app/cordis.patch.yml) =='
Patch-Lines 'packages\bundle\web-app\cordis.patch.yml' @('        maxNoteBytes: 8192') @('', '    - id: file-preview', "      name: '@deepseek-ai/dsh-file-preview'") '- id: file-preview'
Patch-Lines 'packages\bundle\web-app\cordis.patch.yml' @("    - id: ui-message-feedback", "      name: '@deepseek-ai/dsh-client-ui-message-feedback'") @('', '    - id: ui-file-preview', "      name: '@deepseek-ai/dsh-client-ui-file-preview'") '- id: ui-file-preview'

Write-Output '== 4. web-app dependencies =='
Patch-Lines 'packages\bundle\web-app\package.json' @('    "@deepseek-ai/dsh-message-feedback": "workspace:^"') @('    "@deepseek-ai/dsh-file-preview": "workspace:^"') '"@deepseek-ai/dsh-file-preview": "workspace:^"'
Patch-Lines 'packages\bundle\web-app\package.json' @('    "@deepseek-ai/dsh-client-ui-message-feedback": "workspace:^"') @('    "@deepseek-ai/dsh-client-ui-file-preview": "workspace:^"') '"@deepseek-ai/dsh-client-ui-file-preview": "workspace:^"'

Write-Output ''
Write-Output 'Done. Next: cd E:\Projects\deepseek-harness; pnpm install; pnpm build:lib'
