# verify.ps1 - end-to-end connectivity proof for the medini MCP bridge.
# Talks MCP stdio directly (no DSH involved): tools/list + a real medini_doctor
# call. This is the ground truth DSH relies on; if this passes, the bridge
# config in cordis.patch.yml is the only remaining moving part.
param(
    [string]$VenvPython = "C:\Users\Kogami\.workbuddy\binaries\python\envs\default\Scripts\python.exe",
    [string]$ServerPy = "D:\MediniAgent\mcp\server.py"
)

$ErrorActionPreference = "Stop"

$probe = Join-Path $PSScriptRoot "_verify_probe.py"
if (-not (Test-Path $probe)) { throw "probe missing: $probe" }

& $VenvPython $probe $ServerPy
exit $LASTEXITCODE
