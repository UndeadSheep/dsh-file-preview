# sync-lint-fixes.ps1
$ErrorActionPreference = 'Stop'
$ws = 'E:\DSHProjects\P_plugin'
$repo = 'E:\Projects\deepseek-harness'
Copy-Item -Force (Join-Path $ws 'dsh-file-preview\src\index.ts') (Join-Path $repo 'packages\workspace\file-preview\src\index.ts')
Copy-Item -Force (Join-Path $ws 'dsh-client-ui-file-preview\src\client\render.ts') (Join-Path $repo 'packages\client\ui-file-preview\src\client\render.ts')
Copy-Item -Force (Join-Path $ws 'dsh-client-ui-file-preview\src\client\FilePreviewWindow.tsx') (Join-Path $repo 'packages\client\ui-file-preview\src\client\FilePreviewWindow.tsx')
Write-Output 'synced 3 files'
