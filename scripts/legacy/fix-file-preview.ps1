# fix-file-preview.ps1 — repair the comma bugs from the first wiring run + sync fixed sources
$ErrorActionPreference = 'Stop'
$Repo = 'E:\Projects\deepseek-harness'
$Ws   = 'E:\DSHProjects\P_plugin'

function Fix-Rep {
  param([string]$Path, [string[]]$Broken, [string[]]$Fixed)
  $full = Join-Path $Repo $Path
  if (-not (Test-Path -LiteralPath $full)) { Write-Output "  MISSING: $Path"; return }
  $text = [IO.File]::ReadAllText($full)
  $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $b = $Broken -join $nl
  $f = $Fixed -join $nl
  if (-not $text.Contains($b)) { Write-Output "  NOMATCH: $Path"; return }
  $text = $text.Replace($b, $f)
  [IO.File]::WriteAllText($full, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Output "  FIXED: $Path"
}

function Fix-All {
  param([string]$Path, [string[]]$Broken, [string[]]$Fixed)
  $full = Join-Path $Repo $Path
  if (-not (Test-Path -LiteralPath $full)) { Write-Output "  MISSING: $Path"; return }
  $text = [IO.File]::ReadAllText($full)
  $nl = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $b = $Broken -join $nl
  $f = $Fixed -join $nl
  if (-not $text.Contains($b)) { Write-Output "  NOMATCH: $Path"; return }
  $text = $text.Replace($b, $f)
  [IO.File]::WriteAllText($full, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Output "  FIXED(all): $Path"
}

Write-Output '== 0. Sync fixed sources into repo =='
Copy-Item -Force (Join-Path $Ws 'dsh-file-preview\src\index.ts') (Join-Path $Repo 'packages\workspace\file-preview\src\index.ts')
Copy-Item -Force (Join-Path $Ws 'dsh-file-preview\src\types.ts') (Join-Path $Repo 'packages\workspace\file-preview\src\types.ts')
Write-Output '  copied index.ts + types.ts.'

Write-Output '== 1. Fix broken JSON (missing commas) =='
Fix-Rep 'tsconfig.host.json' `
  @('    { "path": "./packages/workspace/workspace" }', '    { "path": "./packages/workspace/file-preview" },') `
  @('    { "path": "./packages/workspace/workspace" },', '    { "path": "./packages/workspace/file-preview" },')

Fix-Rep 'tsconfig.client.json' `
  @('    { "path": "./packages/client/ui-message-feedback" }', '    { "path": "./packages/client/ui-file-preview" },') `
  @('    { "path": "./packages/client/ui-message-feedback" },', '    { "path": "./packages/client/ui-file-preview" },')

Fix-Rep 'packages\api\remotes\tsconfig.client.json' `
  @('      "path": "../../feedback/message-feedback"', '      "path": "../../workspace/file-preview"', '    },') `
  @('      "path": "../../feedback/message-feedback"', '    },', '    {', '      "path": "../../workspace/file-preview"', '    },')

Fix-All 'packages\api\remotes\package.json' `
  @('    "@deepseek-ai/dsh-message-feedback": "workspace:^"', '    "@deepseek-ai/dsh-file-preview": "workspace:^",') `
  @('    "@deepseek-ai/dsh-message-feedback": "workspace:^",', '    "@deepseek-ai/dsh-file-preview": "workspace:^",')

Fix-Rep 'packages\bundle\web-app\package.json' `
  @('    "@deepseek-ai/dsh-client-ui-message-feedback": "workspace:^"', '    "@deepseek-ai/dsh-client-ui-file-preview": "workspace:^",') `
  @('    "@deepseek-ai/dsh-client-ui-message-feedback": "workspace:^",', '    "@deepseek-ai/dsh-client-ui-file-preview": "workspace:^",')

Fix-Rep 'packages\bundle\web-app\package.json' `
  @('    "@deepseek-ai/dsh-message-feedback": "workspace:^"', '    "@deepseek-ai/dsh-file-preview": "workspace:^",') `
  @('    "@deepseek-ai/dsh-message-feedback": "workspace:^",', '    "@deepseek-ai/dsh-file-preview": "workspace:^",')

Write-Output ''
Write-Output 'Done. Re-run: cd E:\Projects\deepseek-harness; pnpm build:lib:host'
