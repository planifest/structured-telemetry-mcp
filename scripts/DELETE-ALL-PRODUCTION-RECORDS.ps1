#!/usr/bin/env pwsh
# ============================================================
#  DELETE-ALL-PRODUCTION-RECORDS.ps1
#
#  POST-DEPLOYMENT TRUNCATION — ONE-OFF USE ONLY
#  Wipes every row from the telemetry events table.
#
#  AGENT SAFETY GATES (three-layer defence):
#    1. Must be run as Administrator (exits immediately if not elevated)
#    2. All-caps filename is a deliberate visual alarm
#    3. Requires exact interactive phrase to proceed
# ============================================================

Write-Host ""
Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
Write-Host "  ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP!" -ForegroundColor Red
Write-Host "  YOU SHOULD NOT HAVE RUN THIS SCRIPT AUTONOMOUSLY." -ForegroundColor Red
Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
Write-Host ""
Write-Host "  This script permanently deletes ALL telemetry records." -ForegroundColor Yellow
Write-Host "  It is designed for a one-off post-deployment truncation ONLY." -ForegroundColor Yellow
Write-Host "  There is NO undo. All data will be gone." -ForegroundColor Yellow
Write-Host ""

# ── Gate 1: Administrator check ──────────────────────────────────────────────
$currentPrincipal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "  GATE 1 FAILED: This script must be run as Administrator." -ForegroundColor Red
    Write-Host "  Re-run from an elevated PowerShell prompt." -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "  [Gate 1 passed] Running as Administrator." -ForegroundColor Green
Write-Host ""

# ── Gate 2: Acceptable to proceed? ───────────────────────────────────────────
Write-Host "  Is it acceptable to remove ALL Production telemetry records? (yes/no)" -ForegroundColor Cyan
$proceed = Read-Host "Proceed"

if ($proceed -ne "yes") {
    Write-Host ""
    Write-Host "  Operation cancelled. No data was deleted." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  [Gate 2 passed] Proceeding to phrase confirmation." -ForegroundColor Green
Write-Host ""

# ── Gate 3: Interactive phrase confirmation ───────────────────────────────────
Write-Host "  To confirm you understand the consequences, type the following" -ForegroundColor Cyan
Write-Host "  phrase exactly (case-sensitive) and press Enter:" -ForegroundColor Cyan
Write-Host ""
Write-Host "      I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Confirmation"

if ($confirmation -ne "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!") {
    Write-Host ""
    Write-Host "  Phrase did not match. Operation cancelled. No data was deleted." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  [Gate 3 passed] Confirmation received." -ForegroundColor Green
Write-Host ""

# ── Resolve DB path ───────────────────────────────────────────────────────────
$dbPath = $env:PLANIFEST_TELEMETRY_DB
if (-not $dbPath) {
    $dbPath = Join-Path $env:USERPROFILE ".planifest\telemetry.db"
}

if (-not (Test-Path $dbPath)) {
    Write-Host "  Database not found at: $dbPath" -ForegroundColor Red
    Write-Host "  Set PLANIFEST_TELEMETRY_DB or ensure the daemon has run at least once." -ForegroundColor Red
    exit 1
}

Write-Host "  Target database: $dbPath" -ForegroundColor Cyan
Write-Host ""

# ── Execute truncation ────────────────────────────────────────────────────────
$escapedDbPath = $dbPath -replace '\\', '\\\\'
$nodeScript = @"
import { DuckDBInstance } from '@duckdb/node-api';
const db = await DuckDBInstance.create('$escapedDbPath');
const conn = await db.connect();
const before = (await (await conn.runAndReadAll('SELECT COUNT(*) AS n FROM events')).getRows())[0][0];
await conn.run('DELETE FROM events');
const after = (await (await conn.runAndReadAll('SELECT COUNT(*) AS n FROM events')).getRows())[0][0];
conn.disconnectSync();
console.log('Deleted ' + before + ' record(s). Remaining: ' + after + '.');
"@

$RepoRoot = Split-Path $PSScriptRoot -Parent
$tmpScript = Join-Path $RepoRoot '._truncate_tmp.mjs'

# ── Stop daemon to release DuckDB file lock ───────────────────────────────────
$svcName = 'structured-telemetry-mcp'
$svcExists = Get-Service $svcName -ErrorAction SilentlyContinue
if ($svcExists) {
    Write-Host "  Stopping daemon service..." -ForegroundColor Cyan
    Stop-Service $svcName -Force
    Start-Sleep 2
}

try {
    Set-Content -Path $tmpScript -Value $nodeScript -Encoding UTF8
    $result = node $tmpScript 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Truncation failed: $result" -ForegroundColor Red
        exit 1
    }
    Write-Host "  $result" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Truncation complete." -ForegroundColor Green
} finally {
    if (Test-Path $tmpScript) { Remove-Item $tmpScript -Force }
    if ($svcExists) {
        Write-Host "  Restarting daemon service..." -ForegroundColor Cyan
        Start-Service $svcName
        Write-Host "  Daemon restarted." -ForegroundColor Green
    }
}
