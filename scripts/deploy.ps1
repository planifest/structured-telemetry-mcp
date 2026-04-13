#Requires -Version 5.1
<#
.SYNOPSIS
    Install structured-telemetry-mcp globally from local source.
.DESCRIPTION
    Runs npm install -g . from the repo root so the structured-telemetry-mcp
    binary is available system-wide. Run build.ps1 first.
.EXAMPLE
    .\scripts\deploy.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent

function Write-Step([string]$msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Err([string]$msg)  { Write-Host "  ERR $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "structured-telemetry-mcp: deploy (global install)" -ForegroundColor White
Write-Host ("=" * 40)

# Check build artifacts exist
foreach ($artifact in @('server.bundle.mjs', 'cli.bundle.mjs')) {
    if (-not (Test-Path (Join-Path $RepoRoot $artifact))) {
        Write-Err "$artifact not found. Run build.ps1 first."
        exit 1
    }
}
Write-Step "Build artifacts verified"

Write-Step "Running npm install -g ..."
Push-Location $RepoRoot
try {
    npm install -g .
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install -g . failed (exit $LASTEXITCODE)"
        exit 1
    }
} finally {
    Pop-Location
}

# Verify binary is on PATH
$bin = Get-Command structured-telemetry-mcp -ErrorAction SilentlyContinue
if (-not $bin) {
    Write-Err "'structured-telemetry-mcp' not found in PATH after install."
    Write-Err "Check that npm's global bin directory is in your PATH:"
    Write-Err "  npm config get prefix"
    exit 1
}

Write-OK "structured-telemetry-mcp installed at $($bin.Source)"
Write-Host ""
Write-Host "Next step: run setup-tools.ps1 to register with your agent tool." -ForegroundColor DarkGray
Write-Host ""
