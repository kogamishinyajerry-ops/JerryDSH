# uninstall.ps1 - remove the mcp-medini MCP bridge rows from DSH profiles.
# Removes the whole managed block (comment header through `enabled: true`).
param(
    [string]$DshHome = "D:\dsh\home"
)

$ErrorActionPreference = "Stop"

$targets = @(
    (Join-Path $DshHome "profiles\web\cordis.patch.yml"),
    (Join-Path $DshHome "profiles\tui\cordis.patch.yml")
)

foreach ($patch in $targets) {
    if (-not (Test-Path $patch)) { Write-Warning "skip (missing): $patch"; continue }

    $lines = Get-Content $patch -Encoding UTF8
    $out = New-Object System.Collections.Generic.List[string]
    $inBlock = $false

    foreach ($line in $lines) {
        if ($line -match "^# -- medini-agent MCP bridge") { $inBlock = $true; continue }
        if ($inBlock) {
            # block ends at the next top-level entry that is not part of it
            if ($line -match "^- " -and $line -notmatch "^- insert:") { $inBlock = $false; $out.Add($line) }
            # or at EOF
            continue
        }
        $out.Add($line)
    }

    Set-Content -Path $patch -Value ($out -join "`r`n") -Encoding UTF8
    Write-Host "[ok]   removed mcp-medini block -> $patch"
}

Write-Host "Done. Restart DSH to apply."
