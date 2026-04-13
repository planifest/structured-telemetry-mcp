#Requires -Version 5.1
<#
.SYNOPSIS
    Register structured-telemetry-mcp with your agent tool.
.DESCRIPTION
    Writes MCP server registration for the selected agent tool.
    Existing JSON config files are merged — your other settings are preserved.
    JSON files are written BOM-free so all tools parse them correctly.

    Supported tools:
      claudecode  - merges ~/.claude/settings.json mcpServers
      cursor      - merges .cursor/mcp.json mcpServers
      manual      - prints the JSON block to add yourself

.PARAMETER Tool
    One of: claudecode, cursor, manual. If omitted, shows an interactive menu.

.PARAMETER DbPath
    Path for the telemetry DuckDB file.
    Defaults to $HOME\.planifest\telemetry.db

.PARAMETER ProjectDir
    Directory to write project-scoped configs (cursor). Defaults to cwd.

.EXAMPLE
    .\scripts\setup.ps1
    .\scripts\setup.ps1 -Tool claudecode
    .\scripts\setup.ps1 -Tool cursor -ProjectDir C:\projects\myapp
    .\scripts\setup.ps1 -Tool claudecode -DbPath D:\data\telemetry.db
#>
[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('claudecode', 'cursor', 'antigravity', 'manual')]
    [string]$Tool,

    [string]$DbPath = (Join-Path $HOME '.planifest\telemetry.db'),

    [string]$ProjectDir = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent

function Write-Step([string]$msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)  { Write-Host "  ERR $msg" -ForegroundColor Red }

function Ensure-Dir([string]$path) {
    if (-not (Test-Path $path)) {
        New-Item -Path $path -ItemType Directory -Force | Out-Null
    }
}

# Load JSON from a file, or return an empty PSCustomObject if file doesn't exist.
function Read-JsonFile([string]$path) {
    if (Test-Path $path) {
        # Strip BOM if present — PowerShell 5.1 Get-Content can emit BOM-prefixed strings
        $raw = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
        return $raw.TrimStart([char]0xFEFF) | ConvertFrom-Json
    }
    return [PSCustomObject]@{}
}

# Write a PSCustomObject to a JSON file, BOM-free.
# Set-Content -Encoding UTF8 writes a BOM in PS5.1 which breaks JSON parsers.
function Write-JsonFile([string]$path, $obj) {
    $json = $obj | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Ensure-Prop {
    param([PSCustomObject]$obj, [string]$name, $defaultValue)
    if (-not $obj.PSObject.Properties[$name]) {
        $obj | Add-Member -NotePropertyName $name -NotePropertyValue $defaultValue
    }
}

# ── Resolve MCP server entry ───────────────────────────────────────────────────
# The server runs as a persistent HTTP/SSE daemon (npm start / node server.bundle.mjs).
# All agent tools connect via SSE URL — no per-session stdio spawning.

function New-McpEntry {
    param([int]$BackendPort = 3741)
    $nodePath  = (Get-Command node -ErrorAction Stop).Source
    $globalMod = (& npm root -g 2>$null).Trim()
    $bundle    = Join-Path $globalMod 'structured-telemetry-mcp\server.bundle.mjs'
    return [PSCustomObject]@{
        command = $nodePath
        args    = @($bundle, "http://localhost:$BackendPort")
    }
}

# ── Per-tool setup functions ───────────────────────────────────────────────────

function Setup-ClaudeCode([string]$dbPath) {
    Write-Step "Claude Code - merging ~/.claude/settings.json"

    $settingsPath = Join-Path (Join-Path $HOME '.claude') 'settings.json'
    Ensure-Dir (Split-Path $settingsPath -Parent)

    $settings = Read-JsonFile $settingsPath
    Ensure-Prop $settings 'mcpServers' ([PSCustomObject]@{})
    $settings.mcpServers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue (New-McpEntry) -Force

    Write-JsonFile $settingsPath $settings
    Write-OK "~/.claude/settings.json"

    # Claude Desktop — same stdio command+args format
    $desktopCfgPath = Join-Path (Join-Path $env:APPDATA 'Claude') 'claude_desktop_config.json'
    if (Test-Path (Split-Path $desktopCfgPath -Parent)) {
        Write-Step "Claude Desktop - merging claude_desktop_config.json"
        $desktop = Read-JsonFile $desktopCfgPath
        Ensure-Prop $desktop 'mcpServers' ([PSCustomObject]@{})
        $desktop.mcpServers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
            -NotePropertyValue (New-McpEntry) -Force
        Write-JsonFile $desktopCfgPath $desktop
        Write-OK "claude_desktop_config.json"
    } else {
        Write-Warn "Claude Desktop config dir not found - skipped"
    }

    Write-OK "DB path: $dbPath"
}

function Setup-Cursor([string]$dbPath, [string]$projectDir) {
    Write-Step "Cursor - merging .cursor/mcp.json"

    $cursorDir = Join-Path $projectDir '.cursor'
    $mcpPath   = Join-Path $cursorDir 'mcp.json'
    Ensure-Dir $cursorDir

    $mcp = Read-JsonFile $mcpPath
    Ensure-Prop $mcp 'mcpServers' ([PSCustomObject]@{})
    $mcp.mcpServers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue (New-McpEntry) -Force

    Write-JsonFile $mcpPath $mcp
    Write-OK "$mcpPath updated"
    Write-OK "DB path: $dbPath"
}

function Setup-Antigravity([string]$dbPath) {
    Write-Step "Antigravity - merging ~/.gemini/antigravity/mcp_config.json"

    $cfgPath = Join-Path (Join-Path (Join-Path $HOME '.gemini') 'antigravity') 'mcp_config.json'
    Ensure-Dir (Split-Path $cfgPath -Parent)

    $cfg = Read-JsonFile $cfgPath
    Ensure-Prop $cfg 'mcpServers' ([PSCustomObject]@{})
    $cfg.mcpServers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue (New-McpEntry) -Force

    Write-JsonFile $cfgPath $cfg
    Write-OK "~/.gemini/antigravity/mcp_config.json"
    Write-OK "DB path: $dbPath"
    Write-Warn "Note: Antigravity does not support hooks - MCP server only."
}

function Setup-Manual([string]$dbPath) {
    Write-Step "Manual configuration"
    $entry = [PSCustomObject]@{
        'structured-telemetry-mcp' = New-McpEntry
    }
    Write-Host ""
    Write-Host "Add the following to your tool's mcpServers config:" -ForegroundColor White
    Write-Host ($entry | ConvertTo-Json -Depth 10) -ForegroundColor DarkGray
    Write-Host ""
}

# ── Interactive menu ───────────────────────────────────────────────────────────

$allTools = @('claudecode', 'cursor', 'antigravity', 'manual')
$toolLabels = @{
    claudecode  = 'Claude Code  (~/.claude/settings.json + Claude Desktop)'
    cursor      = 'Cursor       (.cursor/mcp.json in project dir)'
    antigravity = 'Antigravity  (~/.gemini/antigravity/mcp_config.json)'
    manual      = 'Manual       (print JSON to add yourself)'
}

Write-Host ""
Write-Host "structured-telemetry-mcp: setup tools" -ForegroundColor White
Write-Host ("=" * 40)
Write-Host "DB path:     $DbPath" -ForegroundColor DarkGray
Write-Host "Project dir: $ProjectDir" -ForegroundColor DarkGray
Write-Host ""

if (-not $Tool) {
    Write-Host "Select your agent tool:" -ForegroundColor White
    for ($i = 0; $i -lt $allTools.Count; $i++) {
        Write-Host "  [$($i+1)] $($toolLabels[$allTools[$i]])"
    }
    Write-Host "  [Q] Quit"
    Write-Host ""
    $input = Read-Host "Enter number or Q"

    if ($input -match '^[Qq]') { exit 0 }
    $idx = [int]$input - 1
    if ($idx -lt 0 -or $idx -ge $allTools.Count) {
        Write-Err "Invalid selection."
        exit 1
    }
    $Tool = $allTools[$idx]
}

# Ensure DB directory exists
Ensure-Dir (Split-Path $DbPath -Parent)

switch ($Tool) {
    'claudecode'  { Setup-ClaudeCode $DbPath }
    'cursor'      { Setup-Cursor $DbPath $ProjectDir }
    'antigravity' { Setup-Antigravity $DbPath }
    'manual'      { Setup-Manual $DbPath }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green

# Verify server bundle is reachable at the registered path.
$globalMod  = (& npm root -g 2>$null).Trim()
$bundlePath = Join-Path $globalMod 'structured-telemetry-mcp\server.bundle.mjs'
if (Test-Path $bundlePath) {
    Write-Host "  server.bundle.mjs found at $bundlePath" -ForegroundColor Green
} else {
    Write-Host "  WARNING: server bundle not found at $bundlePath" -ForegroundColor Yellow
    Write-Host "  Run: .\scripts\deploy.ps1  (then re-run setup)" -ForegroundColor White
}
Write-Host ""
