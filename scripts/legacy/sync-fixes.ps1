# sync-fixes.ps1
$ErrorActionPreference = 'Stop'
$src = 'E:\DSHProjects\P_plugin\dsh-client-ui-file-preview\src\client'
$dst = 'E:\Projects\deepseek-harness\packages\client\ui-file-preview\src\client'
Copy-Item -Force (Join-Path $src 'FilePreviewWindow.tsx') (Join-Path $dst 'FilePreviewWindow.tsx')
Copy-Item -Force (Join-Path $src 'FilePreviewWindow.module.css') (Join-Path $dst 'FilePreviewWindow.module.css')
Write-Output 'synced 2 files'
