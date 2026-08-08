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
function Write-Warn([string]$msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }

# req-009: orphan-port detection. Returns the PID of the NSSM-managed
# 'structured-telemetry-mcp' Windows service, or $null if it isn't
# installed/running. Mirrors service-manager.mjs's getManagedPid() for
# launchd/systemd on macOS/Linux.
function Get-ManagedServicePid {
    $svc = Get-CimInstance Win32_Service -Filter "Name='structured-telemetry-mcp'" -ErrorAction SilentlyContinue
    if ($svc -and $svc.ProcessId -gt 0) { return [int]$svc.ProcessId }
    return $null
}

# req-009: is $Port free, or held only by the managed service? Returns
# $true if deploy may proceed. Never terminates a foreign process itself —
# only names it and the remedy, then returns $false.
function Test-OrphanPort {
    param([int]$Port)

    $conns = $null
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    } catch {
        # Get-NetTCPConnection unavailable (older systems) — fall back to netstat.
        try {
            $lines = & netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
            if (-not $lines) { return $true }
            $pids = @()
            foreach ($line in $lines) {
                $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne '' }
                $pids += [int]$parts[-1]
            }
            $conns = $pids | Select-Object -Unique | ForEach-Object { [PSCustomObject]@{ OwningProcess = $_ } }
        } catch {
            Write-Warn "Could not determine port occupancy (Get-NetTCPConnection and netstat both failed) — skipping orphan-port check."
            return $true
        }
    }

    if (-not $conns) { return $true }

    $managedPid = Get-ManagedServicePid
    foreach ($c in $conns) {
        if ($null -ne $managedPid -and $c.OwningProcess -eq $managedPid) { continue }
        Write-Err "Port $Port is held by an unmanaged process (PID $($c.OwningProcess))."
        Write-Err "This process is not the managed Windows service, so deploy cannot restart it safely."
        Write-Err "Stop it yourself, then re-run deploy:"
        Write-Err "  Stop-Process -Id $($c.OwningProcess) -Force"
        return $false
    }
    return $true
}

Write-Host ""
Write-Host "structured-telemetry-mcp: deploy (global install)" -ForegroundColor White
Write-Host ("=" * 40)

# req-009: check port occupancy before doing anything else.
$Port = if ($env:PLANIFEST_MCP_PORT) { [int]$env:PLANIFEST_MCP_PORT } else { 3741 }
Write-Step "Checking port occupancy..."
if (-not (Test-OrphanPort -Port $Port)) {
    exit 1
}
Write-OK "Port $Port check passed."

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
