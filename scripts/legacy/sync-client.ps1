# sync-client.ps1
$ErrorActionPreference = 'Stop'
$src = 'E:\DSHProjects\P_plugin\dsh-client-ui-file-preview'
$dst = 'E:\Projects\deepseek-harness\packages\client\ui-file-preview'
Copy-Item -Force (Join-Path $src 'src\client\index.ts') (Join-Path $dst 'src\client\index.ts')
Copy-Item -Force (Join-Path $src 'src\client\render.ts') (Join-Path $dst 'src\client\render.ts')
Copy-Item -Force (Join-Path $src 'src\client\FilePreviewWindow.tsx') (Join-Path $dst 'src\client\FilePreviewWindow.tsx')
Copy-Item -Force (Join-Path $src 'package.json') (Join-Path $dst 'package.json')
Copy-Item -Force (Join-Path $src 'tsconfig.json') (Join-Path $dst 'tsconfig.json')
Write-Output 'synced 5 files'
