#Requires -Version 5.1
<#
.SYNOPSIS
    Install structured-telemetry-mcp globally and register it as a Windows service.
.DESCRIPTION
    1. Verifies build artifacts exist (run build.ps1 first if not).
    2. Installs the CLI globally (npm install -g .).
    3. Installs or restarts the Windows service via NSSM.
    Requires administrator privileges.
.EXAMPLE
    .\scripts\deploy.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Require administrator privileges (needed for npm global install + service management)
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "  ERR This script requires administrator privileges." -ForegroundColor Red
    Write-Host "      Right-click PowerShell and choose 'Run as Administrator'." -ForegroundColor Yellow
    exit 1
}

$RepoRoot = Split-Path $PSScriptRoot -Parent

function Write-Step([string]$msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Err([string]$msg)  { Write-Host "  ERR $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "structured-telemetry-mcp: deploy (global install)" -ForegroundColor White
Write-Host ("=" * 40)

# Check build artifacts exist
foreach ($artifact in @('server.bundle.mjs', 'server-http.bundle.mjs', 'cli.bundle.mjs')) {
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

# ── Install or restart Windows service ────────────────────────────────────────

$ServiceScript = Join-Path $PSScriptRoot 'service.ps1'
$svc = Get-Service -Name 'structured-telemetry-mcp' -ErrorAction SilentlyContinue

if ($svc) {
    Write-Step "Service already installed - updating bundle path and restarting..."
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if (-not $nssm) { Write-Err "nssm not found. Install via: choco install nssm"; exit 1 }
    $bundle  = Join-Path $RepoRoot 'server-http.bundle.mjs'
    $logDir  = Join-Path $RepoRoot 'logs'
    if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null }
    & $nssm.Source set structured-telemetry-mcp Application    (Get-Command node).Source
    & $nssm.Source set structured-telemetry-mcp AppParameters  $bundle
    & $nssm.Source set structured-telemetry-mcp AppDirectory   $RepoRoot
    & $nssm.Source set structured-telemetry-mcp AppStdout      (Join-Path $logDir 'service.log')
    & $nssm.Source set structured-telemetry-mcp AppStderr      (Join-Path $logDir 'service-error.log')
    & $ServiceScript restart
    Write-OK "Service updated and restarted."
} else {
    Write-Step "Installing Windows service..."
    & $ServiceScript install
}

Write-Host ""
Write-Host 'Done.' -ForegroundColor Green
Write-Host '  Next: .\scripts\setup.ps1 -Tool <tool>' -ForegroundColor DarkGray
Write-Host ""
