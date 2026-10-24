# install.ps1 - register the medini-agent MCP bridge into DSH profiles.
# Idempotent: skips insertion when an `id: mcp-medini` row already exists.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
#         powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -DshHome D:\dsh\home
param(
    [string]$DshHome = "D:\dsh\home",
    [string]$ServerPy = "D:\MediniAgent\mcp\server.py",
    [string]$VenvPython = "C:\Users\Kogami\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ServerPy))     { throw "server.py not found: $ServerPy" }
if (-not (Test-Path $VenvPython))   { throw "venv python not found: $VenvPython" }

$patchBlock = @"

# -- medini-agent MCP bridge (managed by dsh-plugin/install.ps1; do not hand-edit) --
- insert:
    - id: mcp-medini
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: medini
        transport: stdio
        command: '$($VenvPython -replace '\\','\\')'
        args: ['$($ServerPy -replace '\\','\\')']
        env:
          PYTHONIOENCODING: utf-8
          MEDINI_MCP_LOG: INFO
        toolCallTimeoutMs: 300000
        failOnStartupError: false
        reconnect:
          enabled: true
"@

$targets = @(
    (Join-Path $DshHome "profiles\web\cordis.patch.yml"),
    (Join-Path $DshHome "profiles\tui\cordis.patch.yml")
)

foreach ($patch in $targets) {
    if (-not (Test-Path $patch)) {
        Write-Warning "skip (missing): $patch"
        continue
    }
    $content = Get-Content $patch -Raw -Encoding UTF8
    if ($content -match "id:\s*mcp-medini") {
        Write-Host "[skip] already installed in $patch"
        continue
    }
    Add-Content -Path $patch -Value $patchBlock -Encoding UTF8
    Write-Host "[ok]   appended mcp-medini row -> $patch"
}

Write-Host ""
Write-Host "Done. Restart DSH (tui/web) to activate; then run verify.ps1."
