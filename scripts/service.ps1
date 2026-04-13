#Requires -Version 5.1
<#
.SYNOPSIS
    Manage the structured-telemetry-mcp Windows service.
.DESCRIPTION
    Installs, uninstalls, starts, stops, or checks the status of the
    structured-telemetry-mcp daemon as a Windows service via NSSM.

    Requires NSSM (https://nssm.cc) on PATH, or chocolatey to install it.
    Requires administrator privileges for install/uninstall.

.PARAMETER Action
    install | uninstall | start | stop | restart | status

.PARAMETER DbPath
    Path for the telemetry DuckDB file.
    Defaults to $HOME\.planifest\telemetry.db

.PARAMETER Port
    Port for the HTTP/SSE daemon. Defaults to 3741.

.EXAMPLE
    .\scripts\service.ps1 install
    .\scripts\service.ps1 status
    .\scripts\service.ps1 restart
    .\scripts\service.ps1 uninstall
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status')]
    [string]$Action,

    [string]$DbPath = (Join-Path $HOME '.planifest\telemetry.db'),

    [int]$Port = 3741
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ServiceName = 'structured-telemetry-mcp'
$RepoRoot    = Split-Path $PSScriptRoot -Parent
$Bundle      = Join-Path $RepoRoot 'server-http.bundle.mjs'
$LogDir      = Join-Path $RepoRoot 'logs'

function Write-Step([string]$msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "  ERR $msg" -ForegroundColor Red; exit 1 }

function Require-Admin {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = [System.Security.Principal.WindowsPrincipal]$id
    if (-not $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Err "This action requires administrator privileges. Re-run as admin."
    }
}

function Get-Nssm {
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    if ($nssm) { return $nssm.Source }

    Write-Warn "NSSM not found on PATH."
    $choco = Get-Command choco -ErrorAction SilentlyContinue
    if ($choco) {
        Write-Step "Installing NSSM via Chocolatey..."
        choco install nssm -y --no-progress | Out-Null
        $nssm = Get-Command nssm -ErrorAction SilentlyContinue
        if ($nssm) { return $nssm.Source }
    }

    Write-Err "NSSM is required. Install it from https://nssm.cc or via: choco install nssm"
}

function Get-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { Write-Err "node not found on PATH." }
    return $node.Source
}

# ── Actions ────────────────────────────────────────────────────────────────────

function Install-Service {
    Require-Admin

    if (-not (Test-Path $Bundle)) {
        Write-Err "server-http.bundle.mjs not found at $Bundle. Run deploy.ps1 first."
    }

    $nssm = Get-Nssm
    $node = Get-Node

    # Ensure directories exist
    New-Item -Path $LogDir -ItemType Directory -Force | Out-Null
    New-Item -Path (Split-Path $DbPath -Parent) -ItemType Directory -Force | Out-Null

    Write-Step "Installing Windows service '$ServiceName'..."

    & $nssm install $ServiceName $node $Bundle
    & $nssm set $ServiceName AppDirectory $RepoRoot
    & $nssm set $ServiceName AppEnvironmentExtra `
        "PLANIFEST_TELEMETRY_DB=$DbPath" `
        "PLANIFEST_MCP_PORT=$Port"
    & $nssm set $ServiceName AppStdout (Join-Path $LogDir 'service.log')
    & $nssm set $ServiceName AppStderr (Join-Path $LogDir 'service-error.log')
    & $nssm set $ServiceName AppRotateFiles 1
    & $nssm set $ServiceName AppRotateSeconds 86400
    & $nssm set $ServiceName AppRotateBytes 10485760   # 10 MB
    & $nssm set $ServiceName Start SERVICE_AUTO_START
    & $nssm set $ServiceName ObjectName LocalSystem
    & $nssm set $ServiceName Description "Planifest structured telemetry MCP daemon (HTTP/SSE on port $Port)"

    Write-OK "Service installed."
    Write-Step "Starting service..."
    & $nssm start $ServiceName
    Write-OK "Service started. SSE endpoint: http://localhost:$Port/sse"
    Write-Host ""
    Write-Host "  Health: curl http://localhost:$Port/health" -ForegroundColor DarkGray
    Write-Host "  Logs:   $LogDir" -ForegroundColor DarkGray
    Write-Host "  Manage: services.msc  or  .\scripts\service.ps1 <start|stop|restart|status>" -ForegroundColor DarkGray
    Write-Host ""
}

function Uninstall-Service {
    Require-Admin
    $nssm = Get-Nssm

    Write-Step "Stopping and removing service '$ServiceName'..."
    & $nssm stop $ServiceName confirm 2>$null
    & $nssm remove $ServiceName confirm
    Write-OK "Service removed."
}

function Start-McpService {
    $nssm = Get-Nssm
    Write-Step "Starting '$ServiceName'..."
    & $nssm start $ServiceName
    Write-OK "Started."
}

function Stop-McpService {
    $nssm = Get-Nssm
    Write-Step "Stopping '$ServiceName'..."
    & $nssm stop $ServiceName
    Write-OK "Stopped."
}

function Restart-McpService {
    $nssm = Get-Nssm
    Write-Step "Restarting '$ServiceName'..."
    & $nssm restart $ServiceName
    Write-OK "Restarted."
}

function Get-ServiceStatus {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Warn "Service '$ServiceName' is not installed."
        return
    }

    $color = switch ($svc.Status) {
        'Running' { 'Green' }
        'Stopped' { 'Red'   }
        default   { 'Yellow'}
    }
    Write-Host "  Service:  $ServiceName" -ForegroundColor White
    Write-Host "  Status:   $($svc.Status)" -ForegroundColor $color
    Write-Host "  StartType: $($svc.StartType)" -ForegroundColor DarkGray

    # Live health check
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 2
        Write-Host "  Daemon:   reachable — v$($resp.version), sessions: $($resp.sessions)" -ForegroundColor Green
    } catch {
        Write-Host "  Daemon:   not responding on port $Port" -ForegroundColor Red
    }

    Write-Host "  Logs:     $LogDir" -ForegroundColor DarkGray
}

# ── Dispatch ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "structured-telemetry-mcp: service $Action" -ForegroundColor White
Write-Host ("=" * 40)

switch ($Action) {
    'install'   { Install-Service }
    'uninstall' { Uninstall-Service }
    'start'     { Start-McpService }
    'stop'      { Stop-McpService }
    'restart'   { Restart-McpService }
    'status'    { Get-ServiceStatus }
}
