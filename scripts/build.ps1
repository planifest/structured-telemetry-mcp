#Requires -Version 5.1
<#
.SYNOPSIS
    Build structured-telemetry-mcp from source.
.DESCRIPTION
    Runs npm install and npm run build, producing server.bundle.mjs,
    server-http.bundle.mjs and cli.bundle.mjs at the repo root.
.EXAMPLE
    .\scripts\build.ps1
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
Write-Host "structured-telemetry-mcp: build" -ForegroundColor White
Write-Host ("=" * 40)

# Prerequisites
foreach ($cmd in 'node', 'npm') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Err "$cmd not found. Install Node.js 18+ from https://nodejs.org"
        exit 1
    }
}
$nodeVer = (node --version).Trim()
Write-Step "Node.js $nodeVer"

Push-Location $RepoRoot
try {
    Write-Step "npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed (exit $LASTEXITCODE)"
        exit 1
    }
    Write-OK "Dependencies installed"

    Write-Step "npm run build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed (exit $LASTEXITCODE)"
        exit 1
    }
} finally {
    Pop-Location
}

# Verify artifacts
$artifacts = @('server.bundle.mjs', 'server-http.bundle.mjs', 'cli.bundle.mjs')
$missing = $artifacts | Where-Object { -not (Test-Path (Join-Path $RepoRoot $_)) }
if ($missing) {
    Write-Err "Missing expected build outputs: $($missing -join ', ')"
    exit 1
}

Write-OK "Build complete: $($artifacts -join ', ')"
Write-Host ""
Write-Host "Next step: run deploy.ps1 to install globally." -ForegroundColor DarkGray
Write-Host ""
