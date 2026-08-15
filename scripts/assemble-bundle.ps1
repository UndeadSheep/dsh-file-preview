# assemble-bundle.ps1 — build the distributable bundle from a monorepo build.
#
# Reads the prebuilt lib/ artifacts from the monorepo checkout and lays them
# out as the two publishable packages, renaming the baked package names from
# @deepseek-ai/* to @undeadsheep/* in every .js/.d.ts file.
#
# Run this after rebuilding the two packages in the monorepo:
#   pnpm --filter @deepseek-ai/dsh-file-preview build
#   pnpm --filter @deepseek-ai/dsh-client-ui-file-preview build
$ErrorActionPreference = 'Stop'

# Fork checkout root; override with `$env:DSH_FORK` for portability.
$repo = if ($env:DSH_FORK) { $env:DSH_FORK } else { 'E:\Projects\deepseek-harness' }
# This script lives in scripts/, the bundle packages in ../bundle/.
$root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundleRoot = Join-Path $root '..\bundle'

$hostLib   = Join-Path $repo 'packages\workspace\file-preview\lib'
$clientLib = Join-Path $repo 'packages\client\ui-file-preview\lib'

$bundle = Join-Path $bundleRoot 'dsh-file-preview'
$client = Join-Path $bundleRoot 'dsh-client-ui-file-preview'

# ── layout ───────────────────────────────────────────────────────────────────
Remove-Item -Recurse -Force (Join-Path $bundle 'lib') -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $client 'lib') -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $bundle 'lib\types') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $client 'lib\types\client') | Out-Null

# ── package A: host bundle ───────────────────────────────────────────────────
Copy-Item -Force (Join-Path $hostLib 'index.js')                    (Join-Path $bundle 'lib\index.js')
Copy-Item -Force (Join-Path $hostLib 'typert.host.js')              (Join-Path $bundle 'lib\typert.host.js')
Copy-Item -Force (Join-Path $hostLib 'typert.host.d.ts')            (Join-Path $bundle 'lib\typert.host.d.ts')
Copy-Item -Force (Join-Path $hostLib 'typert.remote-client.js')     (Join-Path $bundle 'lib\typert.remote-client.js')
Copy-Item -Force (Join-Path $hostLib 'typert.remote-client.d.ts')   (Join-Path $bundle 'lib\typert.remote-client.d.ts')
Copy-Item -Force (Join-Path $hostLib 'types\index.js')              (Join-Path $bundle 'lib\types\index.js')
Copy-Item -Force (Join-Path $hostLib 'types\types.js')              (Join-Path $bundle 'lib\types\types.js')
Copy-Item -Force (Join-Path $hostLib 'types\index.d.ts')            (Join-Path $bundle 'lib\types\index.d.ts')
Copy-Item -Force (Join-Path $hostLib 'types\types.d.ts')            (Join-Path $bundle 'lib\types\types.d.ts')

# ── package B: client ────────────────────────────────────────────────────────
Copy-Item -Force (Join-Path $clientLib 'index.js')                  (Join-Path $client 'lib\index.js')
Copy-Item -Force (Join-Path $clientLib 'invariant.js')              (Join-Path $client 'lib\invariant.js')
Copy-Item -Force (Join-Path $clientLib 'client.js')                 (Join-Path $client 'lib\client.js')
Copy-Item -Force (Join-Path $clientLib 'types\index.js')            (Join-Path $client 'lib\types\index.js')
Copy-Item -Force (Join-Path $clientLib 'types\index.d.ts')          (Join-Path $client 'lib\types\index.d.ts')
Copy-Item -Force (Join-Path $clientLib 'types\invariant.js')        (Join-Path $client 'lib\types\invariant.js')
Copy-Item -Force (Join-Path $clientLib 'types\invariant.d.ts')      (Join-Path $client 'lib\types\invariant.d.ts')
Copy-Item -Force (Join-Path $clientLib 'types\client\*.js')         (Join-Path $client 'lib\types\client')
Copy-Item -Force (Join-Path $clientLib 'types\client\*.d.ts')       (Join-Path $client 'lib\types\client')

# ── rename baked package names (client name first: no prefix overlap, but be safe) ──
$renames = [ordered]@{
  '@deepseek-ai/dsh-client-ui-file-preview' = '@undeadsheep/dsh-client-ui-file-preview'
  '@deepseek-ai/dsh-file-preview'           = '@undeadsheep/dsh-file-preview'
}

$targets = Get-ChildItem -Recurse -File -Include *.js, *.d.ts $bundle, $client
foreach ($file in $targets) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $changed = $false
  foreach ($pair in $renames.GetEnumerator()) {
    if ($text.Contains($pair.Key)) {
      $text = $text.Replace($pair.Key, $pair.Value)
      $changed = $true
    }
  }
  if ($changed) { [System.IO.File]::WriteAllText($file.FullName, $text) }
}

Write-Output 'assembled + renamed.'
Write-Output ("bundle: {0}" -f $bundle)
Write-Output ("client: {0}" -f $client)
