#Requires -Version 5.1
<#
.SYNOPSIS
    Register structured-telemetry-mcp with your agent tool.
.DESCRIPTION
    Writes MCP server registration for the selected agent tool.
    Existing JSON config files are merged — your other settings are preserved.
    JSON files are written BOM-free so all tools parse them correctly.

    Supported tools:
      claudecode  - merges ~/.claude/settings.json mcpServers + Claude Desktop
      cursor      - merges .cursor/mcp.json mcpServers (project-scoped)
      windsurf    - merges ~/.codeium/windsurf/mcp_config.json mcpServers
      vscode      - merges ~/.vscode/mcp.json servers
      codex       - merges ~/.codex/config.toml [mcp_servers.structured-telemetry-mcp]
      opencode    - merges opencode\config.json mcp (in user AppData)
      antigravity - merges ~/.gemini/antigravity/mcp_config.json mcpServers
      jetbrains   - prints manual UI steps (no config file)
      manual      - prints the JSON block to add yourself

.PARAMETER Tool
    One of: claudecode, cursor, windsurf, vscode, codex, opencode, antigravity, jetbrains, manual.
    If omitted, shows an interactive menu.

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
    [ValidateSet('claudecode', 'cursor', 'windsurf', 'vscode', 'codex', 'opencode', 'antigravity', 'jetbrains', 'manual')]
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

function Read-JsonFile([string]$path) {
    if (Test-Path $path) {
        $raw = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
        return $raw.TrimStart([char]0xFEFF) | ConvertFrom-Json
    }
    return [PSCustomObject]@{}
}

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

function Get-BundlePath {
    $globalMod = (& npm root -g 2>$null).Trim()
    return Join-Path $globalMod 'structured-telemetry-mcp\server.bundle.mjs'
}

function New-McpEntry {
    param([int]$BackendPort = 3741)
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $bundle   = Get-BundlePath
    return [PSCustomObject]@{
        command = $nodePath
        args    = @($bundle, "http://localhost:$BackendPort")
    }
}

function New-VsCodeEntry {
    param([int]$BackendPort = 3741)
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $bundle   = Get-BundlePath
    return [PSCustomObject]@{
        type    = 'stdio'
        command = $nodePath
        args    = @($bundle, "http://localhost:$BackendPort")
    }
}

function Get-CommandArray {
    param([int]$BackendPort = 3741)
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $bundle   = Get-BundlePath
    return @($nodePath, $bundle, "http://localhost:$BackendPort")
}

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

    $desktopCfgPath = Join-Path $HOME 'AppData\Roaming\Claude\claude_desktop_config.json'
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

function Setup-Windsurf([string]$dbPath) {
    Write-Step "Windsurf - merging ~/.codeium/windsurf/mcp_config.json"

    $cfgPath = Join-Path $HOME '.codeium\windsurf\mcp_config.json'
    Ensure-Dir (Split-Path $cfgPath -Parent)

    $cfg = Read-JsonFile $cfgPath
    Ensure-Prop $cfg 'mcpServers' ([PSCustomObject]@{})
    $cfg.mcpServers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue (New-McpEntry) -Force

    Write-JsonFile $cfgPath $cfg
    Write-OK "~/.codeium/windsurf/mcp_config.json"
    Write-OK "DB path: $dbPath"
}

function Setup-VSCode([string]$dbPath) {
    Write-Step "VS Code - merging ~/.vscode/mcp.json"

    $cfgPath = Join-Path $HOME '.vscode\mcp.json'
    Ensure-Dir (Split-Path $cfgPath -Parent)

    $cfg = Read-JsonFile $cfgPath
    Ensure-Prop $cfg 'servers' ([PSCustomObject]@{})
    $cfg.servers | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue (New-VsCodeEntry) -Force

    Write-JsonFile $cfgPath $cfg
    Write-OK "~/.vscode/mcp.json"
    Write-OK "DB path: $dbPath"
}

function Setup-Codex([string]$dbPath) {
    Write-Step "Codex - merging ~/.codex/config.toml"

    $cfgPath  = Join-Path $HOME '.codex\config.toml'
    Ensure-Dir (Split-Path $cfgPath -Parent)

    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $bundle   = Get-BundlePath

    $section = @"

[mcp_servers.structured-telemetry-mcp]
command = "$($nodePath -replace '\\','\\')"
args = ["$($bundle -replace '\\','\\')","http://localhost:3741"]
"@

    $existing = ''
    if (Test-Path $cfgPath) {
        $existing = [System.IO.File]::ReadAllText($cfgPath, [System.Text.UTF8Encoding]::new($false))
    }

    $blockPattern = '(?ms)\[mcp_servers\.structured-telemetry-mcp\][^\[]*'
    if ($existing -match $blockPattern) {
        $updated = [System.Text.RegularExpressions.Regex]::Replace($existing, $blockPattern, $section.TrimStart())
    } else {
        $updated = $existing.TrimEnd() + "`n" + $section
    }

    [System.IO.File]::WriteAllText($cfgPath, $updated, [System.Text.UTF8Encoding]::new($false))
    Write-OK "~/.codex/config.toml"
    Write-OK "DB path: $dbPath"
}

function Setup-OpenCode([string]$dbPath) {
    Write-Step "OpenCode - merging opencode\config.json"

    $roaming = [Environment]::GetFolderPath('ApplicationData')
    $cfgPath = Join-Path $roaming 'opencode\config.json'
    Ensure-Dir (Split-Path $cfgPath -Parent)

    $cfg = Read-JsonFile $cfgPath
    Ensure-Prop $cfg 'mcp' ([PSCustomObject]@{})
    $cfg.mcp | Add-Member -NotePropertyName 'structured-telemetry-mcp' `
        -NotePropertyValue ([PSCustomObject]@{
            type    = 'local'
            command = Get-CommandArray
        }) -Force

    Write-JsonFile $cfgPath $cfg
    Write-OK "$cfgPath"
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

function Setup-JetBrains([string]$dbPath) {
    $bundle   = Get-BundlePath
    $nodePath = (Get-Command node -ErrorAction Stop).Source

    Write-Host ""
    Write-Host "JetBrains - manual steps required:" -ForegroundColor White
    Write-Host "  1. Open Settings > Tools > AI Assistant > Model Context Protocol (MCP)" -ForegroundColor DarkGray
    Write-Host "  2. Click '+' to add a new server" -ForegroundColor DarkGray
    Write-Host "  3. Set Name:    structured-telemetry-mcp" -ForegroundColor DarkGray
    Write-Host "  4. Set Command: $nodePath" -ForegroundColor DarkGray
    Write-Host "  5. Set Args:    $bundle http://localhost:3741" -ForegroundColor DarkGray
    Write-Host "  6. Click OK and restart the IDE" -ForegroundColor DarkGray
    Write-Host ""
    Write-OK "DB path: $dbPath"
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

$allTools = @('claudecode', 'cursor', 'windsurf', 'vscode', 'codex', 'opencode', 'antigravity', 'jetbrains', 'manual')
$toolLabels = @{
    claudecode  = 'Claude Code  (~/.claude/settings.json + Claude Desktop)'
    cursor      = 'Cursor       (.cursor/mcp.json in project dir)'
    windsurf    = 'Windsurf     (~/.codeium/windsurf/mcp_config.json)'
    vscode      = 'VS Code      (~/.vscode/mcp.json)'
    codex       = 'Codex        (~/.codex/config.toml)'
    opencode    = 'OpenCode     (AppData\Roaming\opencode\config.json)'
    antigravity = 'Antigravity  (~/.gemini/antigravity/mcp_config.json)'
    jetbrains   = 'JetBrains    (print UI steps)'
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
    $sel = Read-Host "Enter number or Q"

    if ($sel -match '^[Qq]') { exit 0 }
    $idx = [int]$sel - 1
    if ($idx -lt 0 -or $idx -ge $allTools.Count) {
        Write-Err "Invalid selection."
        exit 1
    }
    $Tool = $allTools[$idx]
}

Ensure-Dir (Split-Path $DbPath -Parent)

switch ($Tool) {
    'claudecode'  { Setup-ClaudeCode $DbPath }
    'cursor'      { Setup-Cursor $DbPath $ProjectDir }
    'windsurf'    { Setup-Windsurf $DbPath }
    'vscode'      { Setup-VSCode $DbPath }
    'codex'       { Setup-Codex $DbPath }
    'opencode'    { Setup-OpenCode $DbPath }
    'antigravity' { Setup-Antigravity $DbPath }
    'jetbrains'   { Setup-JetBrains $DbPath }
    'manual'      { Setup-Manual $DbPath }
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green

$bundlePath = Get-BundlePath
if (Test-Path $bundlePath) {
    Write-Host "  server.bundle.mjs found at $bundlePath" -ForegroundColor Green
} else {
    Write-Host "  WARNING: server bundle not found at $bundlePath" -ForegroundColor Yellow
    Write-Host "  Run: .\scripts\deploy.ps1  (then re-run setup)" -ForegroundColor White
}
Write-Host ""
