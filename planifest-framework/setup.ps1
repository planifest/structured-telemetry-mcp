<#
.SYNOPSIS
    Planifest Setup - Configures skills for your agentic coding tool.

.DESCRIPTION
    Copies Planifest skills into the directory structure each coding tool expects.
    Each tool's specific config lives in setup/<tool>.ps1.
    This script handles shared logic only.

.EXAMPLE
    .\planifest-framework\setup.ps1 claude-code
    .\planifest-framework\setup.ps1 claude-code --context-mode-mcp
    .\planifest-framework\setup.ps1 all
#>

# Skill subcommands — delegate to skill-sync.ps1 and exit immediately (TD-006, REQ-024)
$_skillSubcmds = @('add-skill','remove-skill','preserve-skill','unpreserve-skill')
if ($args.Count -ge 1 -and $args[0] -in $_skillSubcmds) {
    $syncOp     = $args[0] -replace '-skill$',''   # add-skill→add, preserve-skill→preserve
    $syncScript = Join-Path $PSScriptRoot 'scripts\skill-sync.ps1'
    if (-not (Test-Path $syncScript)) {
        Write-Host "Error: skill-sync.ps1 not found. Re-run setup.ps1 first."
        exit 1
    }
    $restArgs = if ($args.Count -gt 1) { $args[1..($args.Count - 1)] } else { @() }
    & $syncScript -Operation $syncOp @restArgs
    exit $LASTEXITCODE
}

# Manual arg parsing — supports --flag style for cross-platform consistency
$Tool = $null
$ContextModeMcp = $false
$StructuredTelemetryMcp = $false
$BackendUrl = 'http://localhost:3741'
$StrictOrchestrator = $false
$IncludeFullSkillLibrary = $false
$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        '--context-mode-mcp'          { $ContextModeMcp = $true; $i++ }
        '--structured-telemetry-mcp'  { $StructuredTelemetryMcp = $true; $i++ }
        '--strict-orchestrator'       { $StrictOrchestrator = $true; $i++ }
        '--include-full-skill-library' { $IncludeFullSkillLibrary = $true; $i++ }
        '--backend-url' {
            $i++
            if ($i -ge $args.Count) { Write-Host "Error: --backend-url requires a value"; exit 1 }
            $BackendUrl = $args[$i]; $i++
        }
        default {
            if ($args[$i] -like '-*') { Write-Host "Unknown flag: $($args[$i])"; exit 1 }
            else { $Tool = $args[$i]; $i++ }
        }
    }
}

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SkillsSrc = Join-Path $ScriptDir 'skills'
$WorkflowsSrc = Join-Path $ScriptDir 'workflows'
$SetupDir = Join-Path $ScriptDir 'setup'

$ValidTools = @('claude-code', 'cursor', 'codex', 'antigravity', 'copilot', 'windsurf', 'cline', 'roo-code', 'opencode')

# --- Shared functions ---

function Copy-PlanifestSkills {
    param($TargetDir)

    Get-ChildItem -Path $SkillsSrc -Directory | ForEach-Object {
        $skillName = $_.Name
        $srcDir = $_.FullName
        $destDir = Join-Path $TargetDir $skillName
        
        $srcSkillMd = Join-Path $srcDir "SKILL.md"
        if (Test-Path $srcSkillMd) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            Copy-Item -Path $srcSkillMd -Destination $destDir -Force

            # Rewrite relative paths to match bundled directory structure
            $skillMdPath = Join-Path $destDir "SKILL.md"
            $skillContent = Get-Content -Path $skillMdPath -Raw
            $skillContent = $skillContent -replace '\.\./templates/', './assets/templates/'
            $skillContent = $skillContent -replace '\.\./standards/reference/', './references/reference/'
            $skillContent = $skillContent -replace '\.\./standards/', './references/'
            $skillContent = $skillContent -replace '\.\./schemas/', './assets/schemas/'
            Set-Content -Path $skillMdPath -Value $skillContent -NoNewline -Encoding UTF8

            Write-Host "  + $skillName/SKILL.md"
            
            foreach ($optDir in @('scripts', 'assets', 'references')) {
                $srcOptDir = Join-Path $srcDir $optDir
                if (Test-Path $srcOptDir) {
                    Copy-Item -Path $srcOptDir -Destination $destDir -Recurse -Force
                }
            }

            # Parse bundle_templates and bundle_standards from SKILL.md frontmatter
            $rawContent = Get-Content -Path $srcSkillMd -Raw
            $bundleTemplates = @()
            $bundleStandards = @()
            if ($rawContent -match '(?m)^bundle_templates:\s*\[([^\]]*)\]') {
                $bundleTemplates = $Matches[1].Trim() -split '\s*,\s*' | Where-Object { $_ }
            }
            if ($rawContent -match '(?m)^bundle_standards:\s*\[([^\]]*)\]') {
                $bundleStandards = $Matches[1].Trim() -split '\s*,\s*' | Where-Object { $_ }
            }

            # Bundle only declared templates (or all if no manifest found)
            $templatesSrc = Join-Path $ScriptDir "templates"
            if (Test-Path $templatesSrc) {
                $destTemplates = Join-Path $destDir "assets\templates"
                New-Item -ItemType Directory -Path $destTemplates -Force | Out-Null
                if ($bundleTemplates.Count -gt 0) {
                    foreach ($tpl in $bundleTemplates) {
                        $tplPath = Join-Path $templatesSrc $tpl
                        if (Test-Path $tplPath) {
                            Copy-Item -Path $tplPath -Destination $destTemplates -Force
                        }
                    }
                    Write-Host "    templates: selective ($($bundleTemplates.Count) files)"
                }
                else {
                    Copy-Item -Path "$templatesSrc\*" -Destination $destTemplates -Recurse -Force
                    Write-Host "    templates: all (no manifest)"
                }
            }

            # Always bundle schemas (small, universally needed)
            $schemasSrc = Join-Path $ScriptDir "schemas"
            if (Test-Path $schemasSrc) {
                $destSchemas = Join-Path $destDir "assets\schemas"
                New-Item -ItemType Directory -Path $destSchemas -Force | Out-Null
                Copy-Item -Path "$schemasSrc\*" -Destination $destSchemas -Recurse -Force
            }

            # Bundle only declared standards (or all top-level if no manifest found)
            $standardsSrc = Join-Path $ScriptDir "standards"
            if (Test-Path $standardsSrc) {
                $destRefs = Join-Path $destDir "references"
                New-Item -ItemType Directory -Path $destRefs -Force | Out-Null
                if ($bundleStandards.Count -gt 0) {
                    foreach ($std in $bundleStandards) {
                        $stdPath = Join-Path $standardsSrc $std
                        if (Test-Path $stdPath) {
                            Copy-Item -Path $stdPath -Destination $destRefs -Force
                        }
                    }
                    Write-Host "    standards: selective ($($bundleStandards.Count) files)"
                }
                else {
                    # No manifest - copy all top-level standards (skip reference/ subdirectory)
                    Get-ChildItem -Path $standardsSrc -File | ForEach-Object {
                        Copy-Item -Path $_.FullName -Destination $destRefs -Force
                    }
                    Write-Host "    standards: all top-level (no manifest)"
                }
            }
        }
    }
}

function Copy-ExternalSkills {
    param($TargetDir)

    $extSkillsDir = Join-Path $ScriptDir 'external-skills'
    if (-not (Test-Path $extSkillsDir)) {
        Write-Host "  ! Warning: external-skills/ not found — skipping"
        return
    }

    $count = 0
    Get-ChildItem -Path $extSkillsDir -Directory | ForEach-Object {
        $skillName = $_.Name
        $srcDir = $_.FullName

        $srcSkillMd = Join-Path $srcDir 'SKILL.md'
        if (-not (Test-Path $srcSkillMd)) {
            Write-Host "  ! [external] $skillName — missing SKILL.md, skipping"
            return
        }
        $srcAttrib = Join-Path $srcDir 'attribution.txt'
        if (-not (Test-Path $srcAttrib)) {
            Write-Host "  ! [external] $skillName — missing attribution.txt, skipping"
            return
        }

        $destDir = Join-Path $TargetDir $skillName
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Copy-Item -Path $srcSkillMd -Destination $destDir -Force
        Copy-Item -Path $srcAttrib -Destination $destDir -Force
        Write-Host "  + [external] $skillName/SKILL.md"
        $count++
    }

    if ($count -gt 0) {
        Write-Host "  [external-skills] $count skill(s) installed"
    } else {
        Write-Host "  [external-skills] no valid skills found (each needs SKILL.md + attribution.txt)"
    }
}

function Write-PlanifestBootFile {
    param($RelPath, $Content)

    $fullPath = Join-Path $ProjectRoot $RelPath
    $dir = Split-Path -Parent $fullPath
    New-Item -ItemType Directory -Path $dir -Force | Out-Null

    if (-not (Test-Path $fullPath)) {
        Set-Content -Path $fullPath -Value $Content -Encoding UTF8
        Write-Host "  + $RelPath (created)"
    }
    else {
        Write-Host "  - $RelPath (already exists, skipped)"
    }
}

function Copy-PlanifestWorkflow {
    param($WorkflowFile, $TargetDir)

    $name = [System.IO.Path]::GetFileNameWithoutExtension($WorkflowFile)
    $destFile = Join-Path $TargetDir "$name.md"

    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Copy-Item -Path $WorkflowFile -Destination $destFile -Force
    Write-Host "  + workflows/$name.md"
}

function Get-ContextModeHookCommand {
    # Builds the PreToolUse command string for a context-mode .mjs hook
    # (REQ-004, 0000017 ADR-002). No Unix-shell dependency: `node <script>` is
    # plain-invocation syntax understood by cmd.exe, PowerShell, and POSIX
    # shells alike — no bash entry point, no jq. The `||` fallback surfaces a
    # clear runtime message and still fails open (exit 0, no deny JSON) when
    # the Node.js runtime itself is missing. Mirrors setup.sh exactly.
    param(
        [string]$HooksDir,
        [string]$ScriptName
    )
    $scriptPath = "$HooksDir/$ScriptName"
    return "node `"$scriptPath`" || echo `"[Planifest] context-mode enforcement ($ScriptName) did not run: Node.js runtime not found. Tool call proceeded unblocked.`" 1>&2"
}

function Merge-HookSettings {
    # Merge PreToolUse hook entries into .claude/settings.json (REQ-004, 0000017 req-004)
    # Additive merge: existing content preserved; Grep/Bash/WebFetch entries
    # removed then re-added for idempotency on re-run.
    param(
        [string]$SettingsPath,
        [string]$HooksDir   # relative path used in command values
    )

    $grepCmd  = Get-ContextModeHookCommand -HooksDir $HooksDir -ScriptName 'block-grep.mjs'
    $bashCmd  = Get-ContextModeHookCommand -HooksDir $HooksDir -ScriptName 'block-bash.mjs'
    $fetchCmd = Get-ContextModeHookCommand -HooksDir $HooksDir -ScriptName 'block-webfetch.mjs'

    $newEntries = @(
        @{ matcher = "Grep";     hooks = @(@{ type = "command"; command = $grepCmd }) }
        @{ matcher = "Bash";     hooks = @(@{ type = "command"; command = $bashCmd }) }
        @{ matcher = "WebFetch"; hooks = @(@{ type = "command"; command = $fetchCmd }) }
    )

    if (Test-Path $SettingsPath) {
        # Additive merge using PowerShell JSON handling
        $existing = Get-Content -Raw -Path $SettingsPath | ConvertFrom-Json

        # Ensure hooks.PreToolUse exists
        if (-not $existing.hooks) {
            $existing | Add-Member -NotePropertyName 'hooks' -NotePropertyValue ([PSCustomObject]@{}) -Force
        }
        if (-not $existing.hooks.PreToolUse) {
            $existing.hooks | Add-Member -NotePropertyName 'PreToolUse' -NotePropertyValue @() -Force
        }

        # Remove existing Grep/Bash/WebFetch entries, then append new ones
        $toRemove = @('Grep', 'Bash', 'WebFetch')
        $filtered = @($existing.hooks.PreToolUse | Where-Object { $toRemove -notcontains $_.matcher })
        $existing.hooks.PreToolUse = $filtered + $newEntries

        $existing | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  ~ .claude/settings.json (context-mode hook entries merged)"
    }
    else {
        $dir = Split-Path -Parent $SettingsPath
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $settings = [PSCustomObject]@{
            hooks = [PSCustomObject]@{
                PreToolUse = $newEntries
            }
        }
        $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  + .claude/settings.json (created with context-mode hook entries)"
    }
}

function Install-ContextModeHooks {
    # Copy enforcement hook scripts and wire settings.json
    # (REQ-004; ported to .mjs in 0000017 req-004 — no bash entry point, no jq).
    param(
        [string]$HooksSrcRel,    # relative to ScriptDir  e.g. hooks/context-mode
        [string]$HooksDirRel,    # relative to ProjectRoot e.g. .claude/hooks/context-mode
        [string]$SettingsRel     # relative to ProjectRoot e.g. .claude/settings.json
    )

    $src      = Join-Path $ScriptDir $HooksSrcRel
    $dest     = Join-Path $ProjectRoot $HooksDirRel
    $settings = Join-Path $ProjectRoot $SettingsRel

    if (-not (Test-Path $src)) {
        Write-Host "  ! Warning: hook scripts not found at $src — skipping hook installation"
        return
    }

    Write-Host ""
    Write-Host "  Installing context-mode enforcement hooks"

    # Setup-time Node.js runtime check (0000017 req-004): these hooks are .mjs —
    # Node is required to run them at all. Warn clearly but still install and
    # wire the hooks; the wired command itself fails open with a runtime
    # message if Node turns out to be missing when Claude Code invokes it.
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "  ! Warning: Node.js runtime not found on this machine."
        Write-Host "  ! context-mode enforcement hooks (block-grep/block-bash/block-webfetch) require Node.js."
        Write-Host "  ! Hooks will be installed and wired, but will not enforce anything until Node.js is installed."
    }

    # Create target directory
    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    # Copy each script
    Get-ChildItem -Path $src -Filter '*.mjs' | ForEach-Object {
        $destFile = Join-Path $dest $_.Name
        Copy-Item -Path $_.FullName -Destination $destFile -Force
        Write-Host "  + $HooksDirRel/$($_.Name)"
    }

    # Merge settings.json wiring
    Merge-HookSettings -SettingsPath $settings -HooksDir $HooksDirRel
}

function Merge-TelemetryHookSettings {
    # Merge PostToolUse context-pressure hook entry into .claude/settings.json
    # Idempotent: removes existing context-pressure entry before re-adding.
    param(
        [string]$SettingsPath,
        [string]$HooksDir,
        [string]$BackendUrl
    )

    $hookCmd = "PLANIFEST_TELEMETRY_URL=$BackendUrl node $HooksDir/context-pressure.mjs"
    $newEntry = @(
        @{
            matcher = ".*"
            hooks = @(@{ type = "command"; command = $hookCmd; async = $true; timeout = 5000 })
        }
    )

    if (Test-Path $SettingsPath) {
        $existing = Get-Content -Raw -Path $SettingsPath | ConvertFrom-Json

        if (-not $existing.hooks) {
            $existing | Add-Member -NotePropertyName 'hooks' -NotePropertyValue ([PSCustomObject]@{}) -Force
        }
        if (-not $existing.hooks.PostToolUse) {
            $existing.hooks | Add-Member -NotePropertyName 'PostToolUse' -NotePropertyValue @() -Force
        }

        # Remove existing context-pressure entries then append new one
        $filtered = @($existing.hooks.PostToolUse | Where-Object {
            $hooks = $_.hooks
            -not ($hooks | Where-Object { $_.command -match 'context-pressure' })
        })
        $existing.hooks.PostToolUse = $filtered + $newEntry

        $existing | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  ~ .claude/settings.json (telemetry PostToolUse hook merged)"
    }
    else {
        $dir = Split-Path -Parent $SettingsPath
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $settings = [PSCustomObject]@{
            hooks = [PSCustomObject]@{ PostToolUse = $newEntry }
        }
        $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  + .claude/settings.json (created with telemetry PostToolUse hook)"
    }
}

function Install-TelemetryHooks {
    # Copy context-pressure hook and wire PostToolUse in settings.json (REQ-008, REQ-010)
    # Only called when --structured-telemetry-mcp is active (0000018 req-001).
    param(
        [string]$HooksSrcRel,    # relative to ScriptDir  e.g. hooks/telemetry
        [string]$HooksDirRel,    # relative to ProjectRoot e.g. .claude/hooks/telemetry
        [string]$SettingsRel,    # relative to ProjectRoot e.g. .claude/settings.json
        [string]$BackendUrl
    )

    $src      = Join-Path $ScriptDir $HooksSrcRel
    $dest     = Join-Path $ProjectRoot $HooksDirRel
    $settings = Join-Path $ProjectRoot $SettingsRel

    if (-not (Test-Path $src)) {
        Write-Host "  ! Warning: telemetry hook scripts not found at $src — skipping"
        return
    }

    Write-Host ""
    Write-Host "  Installing structured telemetry hooks"

    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    Get-ChildItem -Path $src -Filter '*.mjs' | ForEach-Object {
        $destFile = Join-Path $dest $_.Name
        Copy-Item -Path $_.FullName -Destination $destFile -Force
        Write-Host "  + $HooksDirRel/$($_.Name)"
    }

    Merge-TelemetryHookSettings -SettingsPath $settings -HooksDir $HooksDirRel -BackendUrl $BackendUrl
}

function Merge-EnforcementHookSettings {
    # Merge gate-write (PreToolUse), auto-trigger-orchestrator, check-orchestrator-presence,
    # and check-design (UserPromptSubmit) into settings.json. Idempotent.
    param(
        [string]$SettingsPath,
        [string]$HooksDir
    )

    $preToolEntry = @{
        matcher = 'Write|Edit'
        hooks   = @(@{ type = 'command'; command = "node $HooksDir/gate-write.mjs" })
    }
    $autoTriggerEntry = @{
        matcher = '.*'
        hooks   = @(@{ type = 'command'; command = "node $HooksDir/auto-trigger-orchestrator.mjs" })
    }
    $presenceEntry = @{
        matcher = '.*'
        hooks   = @(@{ type = 'command'; command = "node $HooksDir/check-orchestrator-presence.mjs" })
    }
    $userPromptEntry = @{
        matcher = '.*'
        hooks   = @(@{ type = 'command'; command = "node $HooksDir/check-design.mjs" })
    }

    if (Test-Path $SettingsPath) {
        $existing = Get-Content -Raw -Path $SettingsPath | ConvertFrom-Json

        if (-not $existing.hooks) {
            $existing | Add-Member -NotePropertyName 'hooks' -NotePropertyValue ([PSCustomObject]@{}) -Force
        }

        # Merge PreToolUse — remove stale gate-write entry, append fresh one
        if (-not $existing.hooks.PreToolUse) {
            $existing.hooks | Add-Member -NotePropertyName 'PreToolUse' -NotePropertyValue @() -Force
        }
        $filtered = @($existing.hooks.PreToolUse | Where-Object {
            -not ($_.hooks | Where-Object { $_.command -match 'gate-write' })
        })
        $existing.hooks.PreToolUse = $filtered + $preToolEntry

        # Merge UserPromptSubmit — remove stale entries, append fresh ones in order
        if (-not $existing.hooks.UserPromptSubmit) {
            $existing.hooks | Add-Member -NotePropertyName 'UserPromptSubmit' -NotePropertyValue @() -Force
        }
        $filtered = @($existing.hooks.UserPromptSubmit | Where-Object {
            -not ($_.hooks | Where-Object {
                $_.command -match 'auto-trigger-orchestrator' -or
                $_.command -match 'check-orchestrator-presence' -or
                $_.command -match 'check-design'
            })
        })
        $existing.hooks.UserPromptSubmit = $filtered + $autoTriggerEntry + $presenceEntry + $userPromptEntry

        $existing | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  ~ .claude/settings.json (enforcement hook entries merged)"
    }
    else {
        $dir = Split-Path -Parent $SettingsPath
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $settings = [PSCustomObject]@{
            hooks = [PSCustomObject]@{
                PreToolUse       = @($preToolEntry)
                UserPromptSubmit = @($autoTriggerEntry, $presenceEntry, $userPromptEntry)
            }
        }
        $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  + .claude/settings.json (created with enforcement hook entries)"
    }
}

function Merge-AllowedTools {
    # Idempotently add "Agent" to allowedTools in .claude/settings.json (REQ-002).
    # Preserves existing allowedTools entries — additive merge only.
    param([string]$SettingsPath)

    $settings = @{}
    if (Test-Path $SettingsPath) {
        $raw = Get-Content -Raw -Path $SettingsPath -Encoding UTF8
        $settings = $raw | ConvertFrom-Json -AsHashtable -ErrorAction SilentlyContinue
        if (-not $settings) { $settings = @{} }
    }

    $existing = if ($settings.ContainsKey('allowedTools') -and $settings['allowedTools']) {
        @($settings['allowedTools'])
    } else { @() }

    if ($existing -notcontains 'Agent') {
        $settings['allowedTools'] = $existing + @('Agent')
        $dir = Split-Path -Parent $SettingsPath
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
        Write-Host "  ~ .claude/settings.json (Agent added to allowedTools)"
    } else {
        Write-Host "  - .claude/settings.json (Agent already in allowedTools)"
    }
}

function Install-EnforcementHooks {
    # Copy gate-write.mjs + check-design.mjs and wire settings.json. Always runs — no flag required.
    param(
        [string]$HooksSrcRel,
        [string]$HooksDirRel,
        [string]$SettingsRel
    )

    $src      = Join-Path $ScriptDir $HooksSrcRel
    $dest     = Join-Path $ProjectRoot $HooksDirRel
    $settings = Join-Path $ProjectRoot $SettingsRel

    if (-not (Test-Path $src)) {
        Write-Host "  ! Warning: enforcement hook scripts not found at $src — skipping"
        return
    }

    Write-Host ""
    Write-Host "  Installing Planifest enforcement hooks"

    New-Item -ItemType Directory -Path $dest -Force | Out-Null

    Get-ChildItem -Path $src -Filter '*.mjs' | ForEach-Object {
        $destFile = Join-Path $dest $_.Name
        Copy-Item -Path $_.FullName -Destination $destFile -Force
        Write-Host "  + $HooksDirRel/$($_.Name)"
    }

    Merge-EnforcementHookSettings -SettingsPath $settings -HooksDir $HooksDirRel
}

function Install-Tier1Hooks {
    # Copies the Tier 1 adapter + shared enforcement/telemetry scripts (REQ-009).
    param(
        [string]$AdapterSrcRel,   # e.g. hooks\adapters\cursor.mjs
        [string]$AdapterDestRel,  # e.g. .cursor\hooks\adapters\cursor.mjs
        [string]$HooksInstallDir  # e.g. .cursor\hooks
    )

    $adapterSrc  = Join-Path $ScriptDir $AdapterSrcRel
    $adapterDest = Join-Path $ProjectRoot $AdapterDestRel
    $hooksDir    = Join-Path $ProjectRoot $HooksInstallDir

    if (-not (Test-Path $adapterSrc)) {
        Write-Host "  ! Warning: Tier 1 adapter not found at $adapterSrc — skipping"
        return
    }

    Write-Host ""
    Write-Host "  Installing Planifest Tier 1 adapter hooks (REQ-009)"

    # Copy adapter
    $adapterDir = Split-Path -Parent $adapterDest
    New-Item -ItemType Directory -Path $adapterDir -Force | Out-Null
    Copy-Item -Path $adapterSrc -Destination $adapterDest -Force
    Write-Host "  + $AdapterDestRel"

    # Copy enforcement scripts (gate-write, check-design, auto-trigger-orchestrator)
    $enfSrc  = Join-Path $ScriptDir 'hooks\enforcement'
    $enfDest = Join-Path $hooksDir 'enforcement'
    if (Test-Path $enfSrc) {
        New-Item -ItemType Directory -Path $enfDest -Force | Out-Null
        Get-ChildItem -Path $enfSrc -Filter '*.mjs' | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination (Join-Path $enfDest $_.Name) -Force
            Write-Host "  + $HooksInstallDir\enforcement\$($_.Name)"
        }
    }

    # Copy telemetry scripts (emit-phase-start, emit-phase-end)
    $telemSrc  = Join-Path $ScriptDir 'hooks\telemetry'
    $telemDest = Join-Path $hooksDir 'telemetry'
    if (Test-Path $telemSrc) {
        New-Item -ItemType Directory -Path $telemDest -Force | Out-Null
        Get-ChildItem -Path $telemSrc -Filter 'emit-phase-*.mjs' | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination (Join-Path $telemDest $_.Name) -Force
            Write-Host "  + $HooksInstallDir\telemetry\$($_.Name)"
        }
    }

    Write-Host "  [Planifest] Tier 1 adapter hooks installed."
}

function Install-Tier1HookRegistration {
    # Writes PreToolUse hook registration pointing to the Tier 1 adapter (REQ-009).
    param(
        [string]$AdapterDestRel,  # e.g. .cursor\hooks\adapters\cursor.mjs
        [string]$SettingsRel      # e.g. .cursor\settings.json
    )

    $settings    = Join-Path $ProjectRoot $SettingsRel
    $adapterCmd  = "node $AdapterDestRel gate-write"

    $js = @"
const fs = require('fs'), path = require('path');
const adapterCmd = '$($adapterCmd.Replace('','\'))';
const sf = '$($settings.Replace('','\'))';
let s = {};
if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,'utf8').replace(/^﻿/,''));
s.hooks = s.hooks || {};
s.hooks.PreToolUse = (s.hooks.PreToolUse || [])
  .filter(h => !['Write','Edit'].includes(h.matcher) ||
               !(h.hooks||[]).some(e => (e.command||'').includes('gate-write')));
s.hooks.PreToolUse.push(
  {matcher:'Write', hooks:[{type:'command',command:adapterCmd}]},
  {matcher:'Edit',  hooks:[{type:'command',command:adapterCmd}]}
);
fs.mkdirSync(path.dirname(sf),{recursive:true});
fs.writeFileSync(sf, JSON.stringify(s,null,2)+'
');
"@
    node -e $js
    Write-Host "  ~ $SettingsRel (Tier 1 adapter hook registration written)"
}

function Install-BeforeSubmitHookRegistration {
    # Wires beforeSubmitPrompt → check-design for tools that expose that event (REQ-018).
    param(
        [string]$AdapterDestRel,  # e.g. .cursor\hooks\adapters\cursor.mjs
        [string]$SettingsRel      # e.g. .cursor\settings.json
    )

    $settings   = Join-Path $ProjectRoot $SettingsRel
    $adapterCmd = "node $AdapterDestRel check-design"

    $js = @"
const fs = require('fs'), path = require('path');
const adapterCmd = '$($adapterCmd.Replace('','\'))';
const sf = '$($settings.Replace('','\'))';
let s = {};
if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,'utf8').replace(/^﻿/,''));
s.hooks = s.hooks || {};
s.hooks.beforeSubmitPrompt = (s.hooks.beforeSubmitPrompt || [])
  .filter(h => !(h.hooks||[]).some(e => (e.command||'').includes('check-design')));
s.hooks.beforeSubmitPrompt.push(
  {matcher:'*', hooks:[{type:'command',command:adapterCmd}]}
);
fs.mkdirSync(path.dirname(sf),{recursive:true});
fs.writeFileSync(sf, JSON.stringify(s,null,2)+'
');
"@
    node -e $js
    Write-Host "  ~ $SettingsRel (beforeSubmitPrompt check-design hook registered)"
}

function Invoke-PlanifestGuardrails {
    Write-Host ""
    Write-Host "  Activating Planifest Git Guardrails"

    # Point Git to the version-controlled hooks directory
    git config core.hooksPath planifest-framework/hooks
    Write-Host "  + git config core.hooksPath planifest-framework/hooks"

    # Note: chmod is not available on Windows; hooks are made executable by setup.sh on Unix.
    # On Windows, Git for Windows respects the executable bit stored in the repo,
    # so no additional step is required here.

    # Deploy the CI/CD pipeline workflow
    $githubWorkflows = Join-Path $ProjectRoot '.github\workflows'
    $workflowSrc = Join-Path $ScriptDir 'hooks\planifest.yml'
    if (Test-Path $workflowSrc) {
        New-Item -ItemType Directory -Path $githubWorkflows -Force | Out-Null
        $dest = Join-Path $githubWorkflows 'planifest.yml'
        if (-not (Test-Path $dest)) {
            Copy-Item -Path $workflowSrc -Destination $dest -Force
            Write-Host "  + .github/workflows/planifest.yml (created)"
        }
        else {
            Write-Host "  - .github/workflows/planifest.yml (already exists, skipped)"
        }
    }

    # Deploy .gitattributes to enforce LF endings on hook scripts.
    # Without this, Git for Windows re-adds CRLF on checkout, breaking the bash shebang.
    $gitattributesSrc = Join-Path $ScriptDir '.gitattributes'
    $gitattributesDest = Join-Path $ProjectRoot '.gitattributes'
    if (Test-Path $gitattributesSrc) {
        if (-not (Test-Path $gitattributesDest)) {
            Copy-Item -Path $gitattributesSrc -Destination $gitattributesDest -Force
            Write-Host "  + .gitattributes (created - enforces LF on hook scripts)"
        }
        else {
            Write-Host "  - .gitattributes (already exists, skipped)"
        }
    }

    Write-Host "  `u{2705} Git guardrails activated."
}

function Initialize-PlanifestRepo {
    Write-Host ""
    Write-Host "  Initializing Repository Structure"

    $gitignoreSrc = Join-Path $ScriptDir ".gitignore"
    $gitignoreDest = Join-Path $ProjectRoot ".gitignore"
    
    if (Test-Path $gitignoreSrc) {
        if (-not (Test-Path $gitignoreDest)) {
            Copy-Item -Path $gitignoreSrc -Destination $gitignoreDest
            Write-Host "  + .gitignore (copied)"
        }
        else {
            Write-Host "  - .gitignore (already exists at root, skipped)"
        }
    }
    else {
        Write-Host "  ! Warning: .gitignore not found in framework directory ($gitignoreSrc)"
    }

    $srcDir = Join-Path $ProjectRoot "src"
    if (-not (Test-Path $srcDir)) {
        New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
        Write-Host "  + src/ (created)"
    }
    
    $srcReadme = Join-Path $srcDir "README.md"
    if (-not (Test-Path $srcReadme)) {
        Set-Content -Path $srcReadme -Value @'
# src/

Components live here. Each component is a subfolder with a `component.yml` manifest.

See [planifest/spec/feature-structure.md](../planifest/spec/feature-structure.md) for the canonical layout.
'@ -Encoding UTF8
        Write-Host "  + src/README.md (created)"
    }

    $planDir = Join-Path $ProjectRoot "plan"
    if (-not (Test-Path $planDir)) {
        New-Item -ItemType Directory -Path $planDir -Force | Out-Null
        Write-Host "  + plan/ (created)"
    }
    
    $planReadme = Join-Path $planDir "README.md"
    if (-not (Test-Path $planReadme)) {
        Set-Content -Path $planReadme -Value @'
# plan/

Feature specifications live here. Each feature gets a subfolder.

See [plan/feature-structure.md](feature-structure.md) for the canonical layout.
'@ -Encoding UTF8
        Write-Host "  + plan/README.md (created)"
    }

    $planStructure = Join-Path $planDir "feature-structure.md"
    if (-not (Test-Path $planStructure)) {
        Set-Content -Path $planStructure -Value @'
# Planifest - Repository Structure

> The canonical layout for a Planifest-managed repository. Three top-level folders, three concerns.

---

## The Three Folders

```
repo/
+-- planifest-framework/        <- The framework (skills, templates, schemas, standards)
|                                  Drop this in. Don't modify it per-project.
|
+-- plan/                       <- The specifications (organized by feature)
|                                  Plans, briefs, specs, ADRs, risk, scope, glossary.
|                                  Everything that describes WHAT to build and WHY.
|
+-- src/                        <- The code (organized by component)
                                   Implementation, tests, config, manifests.
                                   Everything that IS the built thing.
```

---

## `planifest-framework/` - The Framework

This folder is the Planifest framework itself. It is the same across every project. You do not modify it per-feature - you update it when the framework evolves.

```
planifest/
+-- skills/           <- Agent instructions (orchestrator + phase skills)
+-- templates/        <- File format templates for every artifact
+-- schemas/          <- JSON Schema validation definitions
+-- standards/        <- Code quality standards
+-- spec/             <- This file - the canonical structure definition
```

---

## `plan/` - The Plan/Specifications

Organized by feature. Each feature gets a subfolder. This is where humans write briefs and agents write specs. No code lives here.

```
plan/
+-- {feature-id}/
    +-- feature-brief.md          <- Human input (start here)
    +-- design.md                 <- Validated plan (orchestrator output)
    +-- pipeline-run.md              <- Audit trail (per run)
    +-- pipeline-run-phase-2.md      <- Phase 2 audit (if phased)
    |
    +-- design-requirements.md               <- Functional & non-functional requirements
    +-- design-spec-phase-2.md       <- Phase 2 spec (if phased)
    +-- openapi-spec.yaml            <- API contract
    +-- scope.md                     <- In / Out / Deferred
    +-- risk-register.md             <- Risk items with likelihood & impact
    +-- domain-glossary.md           <- Ubiquitous language
    +-- security-report.md           <- Security review findings
    +-- quirks.md                    <- Quirks and workarounds
    +-- recommendations.md           <- Improvement suggestions
    |
    +-- adr/
        +-- ADR-001-{title}.md       <- Architecture decision records
        +-- ADR-002-{title}.md
        +-- ...
```

### Path Rules - plan/

1. **Feature ID** follows the format `{0000000}-{kebab-case-name}` - a 7-digit zero-padded number prefix for chronological ordering, followed by a human-chosen kebab-case name.
2. **No nesting** - specs, ADRs, and supporting docs are flat within the feature folder. One level of subfolders only (adr/).
3. **No code** - nothing executable lives in `plan/`. If it runs, it belongs in `src/`.
4. **Phased features** append the phase number: `design-spec-phase-2.md`, `pipeline-run-phase-2.md`. The `design.md` is updated per phase, not duplicated.
5. **ADRs** are numbered sequentially. Never renumber. Superseded ADRs stay with `status: superseded`.

---

## `src/` - The Code

Organized by component. Each component is a subfolder at the top level of `src/`. The component manifest lives with the code, not with the plan.

```
src/
+-- {component-id}/
    +-- component.yml               <- Component manifest (from template)
    +-- package.json                  <- (or equivalent for the stack)
    |
    +-- src/                          <- Implementation (structure varies by stack)
    |   +-- ...
    |
    +-- tests/                        <- Tests
    |   +-- ...
    |
    +-- docs/
        +-- data-contract.md          <- Schema ownership & invariants
        +-- migrations/
            +-- proposed-{desc}.md    <- Migration proposals
```

### Path Rules - src/

1. **Component ID** is kebab-case, matches the `id` in `component.yml`.
2. **component.yml is mandatory** - every component has one. Read it before any work; update it after every build.
3. **Component-specific docs** live with the component at `src/{component-id}/docs/`. These describe the component's data contract, migrations, and technical specifics.
4. **Feature-level docs** live in `plan/`. The component's `component.yml` references the feature via the `feature` field.
5. **Existing components** that predate Planifest are retrofitted by adding a `component.yml` at their root.

---

## How the Three Folders Connect

```
plan/current/design.md
    +-- lists component IDs -> src/{component-id}/component.yml
                                    +-- references feature -> plan/

plan/current/design-requirements.md
    +-- functional requirements -> implemented in -> src/{component-id}/src/

plan/current/adr/ADR-001-*.md
    +-- decisions -> followed by -> src/{component-id}/src/

plan/current/openapi-spec.yaml
    +-- API contract -> implemented in -> src/{component-id}/src/
```

The relationship is bidirectional:
- `design.md` lists all component IDs
- Each `component.yml` references its feature ID
- The plan describes WHAT; the code IS the WHAT

---

## Retrofit Ã¢â‚¬â€ Adding Planifest to an Existing Repo

If the repo already has code:

1. Drop `planifest/` into the repo root
2. Create `plan/` for the first feature
3. Move existing components under `src/` (or leave them if they're already there)
4. Add a `component.yml` to each existing component
5. The orchestrator's retrofit mode will read the codebase and infer the existing architecture

---

*Templates for each file are in [planifest/templates/](../templates/). Skills reference these paths.*
'@ -Encoding UTF8
        Write-Host "  + plan/feature-structure.md (created)"
    }

    # Add tool ignore rules to keep context windows lean
    $ignoreContent = @"

# Planifest - Token Reduction (keeps agent semantic search from bloating context)
plan/_archive/
node_modules/
dist/
build/
out/
.next/
"@

    foreach ($ignoreFile in @('.cursorignore', '.claudeignore', '.windsurfignore', '.clineignore')) {
        $ignorePath = Join-Path $ProjectRoot $ignoreFile
        if (-not (Test-Path $ignorePath)) {
            Set-Content -Path $ignorePath -Value $ignoreContent -Encoding UTF8
            Write-Host "  + $ignoreFile (created)"
        }
        else {
            $existing = Get-Content -Path $ignorePath -Raw
            if ($existing -notmatch "Planifest - Token Reduction") {
                Add-Content -Path $ignorePath -Value $ignoreContent -Encoding UTF8
                Write-Host "  + $ignoreFile (appended Planifest ignore rules)"
            }
        }
    }

    # Deploy .cursorindexingignore - excludes large reference docs from semantic
    # search indexing but keeps them accessible via explicit @ mention
    $indexingIgnoreContent = @"

# Planifest - Indexing Exclusions (files accessible via @ mention but excluded from search)
*-evaluation.md
*-guide.md
tool-setup-reference.md
getting-started.md
"@

    $indexingIgnorePath = Join-Path $ProjectRoot ".cursorindexingignore"
    if (-not (Test-Path $indexingIgnorePath)) {
        Set-Content -Path $indexingIgnorePath -Value $indexingIgnoreContent -Encoding UTF8
        Write-Host "  + .cursorindexingignore (created)"
    }
    else {
        $existing = Get-Content -Path $indexingIgnorePath -Raw
        if ($existing -notmatch "Planifest - Indexing Exclusions") {
            Add-Content -Path $indexingIgnorePath -Value $indexingIgnoreContent -Encoding UTF8
            Write-Host "  + .cursorindexingignore (appended Planifest rules)"
        }
    }
}

function Copy-CapabilitySkills {
    # Copies permanent capability skills from planifest-overrides/capability-skills/
    # into the tool's skill directory (ADR-006). The tool discovers them the same way
    # it discovers built-in skills — no separate registry file needed.
    param($TargetDir)

    $capSkillsDir = Join-Path $ProjectRoot 'planifest-overrides\capability-skills'
    if (-not (Test-Path $capSkillsDir)) { return }

    $found = @(Get-ChildItem -Path $capSkillsDir -Directory | Where-Object {
        Test-Path (Join-Path $_.FullName 'SKILL.md')
    })
    if ($found.Count -eq 0) { return }

    Write-Host ""
    Write-Host "  Syncing capability skills from planifest-overrides/capability-skills/"
    foreach ($dir in $found) {
        $destDir = Join-Path $TargetDir $dir.Name
        Copy-Item -Path $dir.FullName -Destination $destDir -Recurse -Force
        Write-Host "  + capability-skill: $($dir.Name)"
    }
}

function Append-OverrideInstructions {
    # Appends project-specific instructions from planifest-overrides/instructions/
    # to the tool's boot file. Idempotent — strips and replaces the override block
    # on every re-run so changes in planifest-overrides/ are always reflected.
    param($BootFilePath)

    $bootPath = Join-Path $ProjectRoot $BootFilePath
    if (-not (Test-Path $bootPath)) { return }

    $startMarker = '<!-- planifest-overrides:instructions:start -->'
    $endMarker   = '<!-- planifest-overrides:instructions:end -->'

    # Strip any existing override block from a previous run
    $current = Get-Content -Path $bootPath -Raw
    if ($current -match [regex]::Escape($startMarker)) {
        $pattern = "(?s)\r?\n$([regex]::Escape($startMarker)).*?$([regex]::Escape($endMarker))\r?\n?"
        $current = [regex]::Replace($current, $pattern, '')
        Set-Content -Path $bootPath -Value $current.TrimEnd() -Encoding UTF8 -NoNewline
    }

    $instrDir = Join-Path $ProjectRoot 'planifest-overrides\instructions'
    if (-not (Test-Path $instrDir)) { return }
    $files = @(Get-ChildItem -Path $instrDir -File -Filter '*.md' | Sort-Object Name)
    if ($files.Count -eq 0) { return }

    Write-Host ""
    Write-Host "  Appending override instructions from planifest-overrides/instructions/"

    $block = "`n`n$startMarker`n"
    foreach ($file in $files) {
        $block += "`n" + (Get-Content -Path $file.FullName -Raw).TrimEnd() + "`n"
        Write-Host "  + $($file.Name)"
    }
    $block += "`n$endMarker"

    Add-Content -Path $bootPath -Value $block -Encoding UTF8
    Write-Host "  ~ $BootFilePath updated with override instructions"
}

function Install-WindsurfHookConfig {
    # Writes .windsurf/hooks.json registering pre_write_code, pre_mcp_tool_use,
    # and pre_user_prompt (ADR-002, REQ-016). Planifest owns this file entirely.
    $windsurfDir = Join-Path $ProjectRoot '.windsurf'
    New-Item -ItemType Directory -Path $windsurfDir -Force | Out-Null

    $cmd = "node planifest-framework/hooks/adapters/windsurf.mjs"
    $config = @{
        hooks = @{
            pre_write_code = @(@{ command = $cmd; powershell = "node planifest-framework/hooks/adapters/windsurf.mjs" })
            pre_mcp_tool_use = @(@{ command = $cmd; powershell = "node planifest-framework/hooks/adapters/windsurf.mjs" })
            pre_user_prompt = @(@{ command = $cmd; powershell = "node planifest-framework/hooks/adapters/windsurf.mjs" })
        }
    }
    $configPath = Join-Path $windsurfDir 'hooks.json'
    $config | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "  + .windsurf/hooks.json (Windsurf hook registration)"
}

function Install-CopilotAdapter {
    # Writes .github/hooks/planifest.json registering both hook events (REQ-015).
    # The adapter is invoked in-place from planifest-framework/hooks/adapters/copilot.mjs.
    $hooksDir = Join-Path $ProjectRoot '.github\hooks'
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null

    $configPath = Join-Path $hooksDir 'planifest.json'
    $config = @{
        version = 1
        hooks = @{
            preToolUse = @(
                @{ type = "command"; command = "node planifest-framework/hooks/adapters/copilot.mjs" }
            )
            userPromptSubmitted = @(
                @{ type = "command"; command = "node planifest-framework/hooks/adapters/copilot.mjs" }
            )
        }
    }
    $config | ConvertTo-Json -Depth 6 | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "  + .github/hooks/planifest.json (Copilot hook registration)"
}

function Invoke-PlanifestSetup {
    param($ToolName)

    $toolConfigPath = Join-Path $SetupDir "$ToolName.ps1"
    if (-not (Test-Path $toolConfigPath)) {
        Write-Host "Error: no config file at setup/$ToolName.ps1"
        exit 1
    }

    # Load tool-specific config
    $toolConfig = & $toolConfigPath

    $skillsDir = Join-Path $ProjectRoot $toolConfig.SkillsDir

    Write-Host ""
    Write-Host "  Setting up $ToolName"
    Write-Host "  Skills directory: $($toolConfig.SkillsDir)/"

    # Manifest cleanup — remove only previously installed directories on re-run
    $manifest = Join-Path $skillsDir ".planifest-manifest"
    if (Test-Path $manifest) {
        Write-Host "  Re-run detected — removing previously installed directories"
        Get-Content -Path $manifest | Where-Object { $_ -ne '' } | ForEach-Object {
            if (Test-Path $_) {
                Remove-Item -Path $_ -Recurse -Force
                Write-Host "  - removed: $(Split-Path -Leaf $_)"
            }
        }
        Remove-Item -Path $manifest -Force
    }

    # Copy skills (now automatically bundles supporting files)
    Copy-PlanifestSkills -TargetDir $skillsDir

    # Copy external skills if --include-full-skill-library flag is set (REQ-001)
    if ($IncludeFullSkillLibrary) {
        Write-Host ""
        Write-Host "  Installing external skill library"
        Copy-ExternalSkills -TargetDir $skillsDir
    }

    # Copy permanent capability skills from planifest-overrides/ (ADR-006)
    Copy-CapabilitySkills -TargetDir $skillsDir

    # Copy workflows (if tool defines a workflow dir)
    if ($toolConfig.WorkflowsDir -and (Test-Path $WorkflowsSrc)) {
        $workflowsDir = Join-Path $ProjectRoot $toolConfig.WorkflowsDir
        Get-ChildItem -Path $WorkflowsSrc -Filter '*.md' | ForEach-Object {
            Copy-PlanifestWorkflow -WorkflowFile $_.FullName -TargetDir $workflowsDir
        }
    }

    # Create boot file (if tool defines one)
    if ($toolConfig.BootFile) {
        $bootContent = $toolConfig.BootContent
        if (-not $bootContent -and $toolConfig.BootTemplate) {
            $bootContentPath = Join-Path $ProjectRoot $toolConfig.BootTemplate
            $bootContent = Get-Content -Raw -Path $bootContentPath
        }
        Write-PlanifestBootFile -RelPath $toolConfig.BootFile -Content $bootContent
    }

    # Append project-specific instructions to boot file (idempotent on re-run)
    if ($toolConfig.BootFile) {
        Append-OverrideInstructions -BootFilePath $toolConfig.BootFile
    }

    # Install Planifest enforcement hooks unconditionally (gate-write, check-design)
    if ($toolConfig.EnforcementHooksSrc -and $toolConfig.EnforcementHooksDir -and $toolConfig.SettingsFile) {
        Install-EnforcementHooks `
            -HooksSrcRel $toolConfig.EnforcementHooksSrc `
            -HooksDirRel $toolConfig.EnforcementHooksDir `
            -SettingsRel $toolConfig.SettingsFile
    }

    # Add Agent to allowedTools so sub-agent dispatch works without per-use confirmation (REQ-002)
    if ($toolConfig.SettingsFile) {
        $settingsPath = Join-Path $ProjectRoot $toolConfig.SettingsFile
        Merge-AllowedTools -SettingsPath $settingsPath
    }

    # Install context-mode enforcement hooks if --context-mode-mcp flag is set (REQ-004)
    if ($ContextModeMcp -and $toolConfig.HooksSrc -and $toolConfig.HooksDir -and $toolConfig.SettingsFile) {
        Install-ContextModeHooks `
            -HooksSrcRel  $toolConfig.HooksSrc `
            -HooksDirRel  $toolConfig.HooksDir `
            -SettingsRel  $toolConfig.SettingsFile
    }

    # Write telemetry opt-in sentinel so skills know emission is authorised (REQ-004)
    if ($StructuredTelemetryMcp) {
        $sentinel = Join-Path $ProjectRoot '.claude\telemetry-enabled'
        $sentinelDir = Split-Path -Parent $sentinel
        if (-not (Test-Path $sentinelDir)) { New-Item -ItemType Directory -Path $sentinelDir -Force | Out-Null }
        if (-not (Test-Path $sentinel)) {
            New-Item -ItemType File -Path $sentinel -Force | Out-Null
            Write-Host "  + .claude/telemetry-enabled (telemetry opt-in sentinel)"
        } else {
            Write-Host "  - .claude/telemetry-enabled (already exists)"
        }
    }

    # Install telemetry hooks whenever --structured-telemetry-mcp is active (0000018 req-001)
    # No longer requires --context-mode-mcp — that AND-condition silently left telemetry
    # hooks unwired for any project passing --structured-telemetry-mcp alone.
    if ($StructuredTelemetryMcp -and
        $toolConfig.TelemetryHooksSrc -and $toolConfig.TelemetryHooksDir -and $toolConfig.SettingsFile) {
        Install-TelemetryHooks `
            -HooksSrcRel  $toolConfig.TelemetryHooksSrc `
            -HooksDirRel  $toolConfig.TelemetryHooksDir `
            -SettingsRel  $toolConfig.SettingsFile `
            -BackendUrl   $BackendUrl
    }

    # Install Copilot adapter when tool is copilot (REQ-015)
    if ($ToolName -eq 'copilot') {
        Write-Host ""
        Write-Host "  Installing Copilot hook registration"
        Install-CopilotAdapter
    }

    # Write Windsurf hook config when tool is windsurf (REQ-016)
    if ($ToolName -eq 'windsurf') {
        Write-Host ""
        Write-Host "  Writing Windsurf hook configuration"
        Install-WindsurfHookConfig
    }

    # Install Tier 1 adapter for tools with native hook support (REQ-009)
    if ($toolConfig.Tier -eq 1 -and $toolConfig.HookAdapterSrc) {
        Install-Tier1Hooks `
            -AdapterSrcRel  $toolConfig.HookAdapterSrc `
            -AdapterDestRel $toolConfig.HookAdapterDest `
            -HooksInstallDir $toolConfig.HooksInstallDir
        Install-Tier1HookRegistration `
            -AdapterDestRel $toolConfig.HookAdapterDest `
            -SettingsRel    $toolConfig.SettingsFile

        # Wire beforeSubmitPrompt → check-design for tools that support it (REQ-018)
        if ($toolConfig.BeforeSubmitHook -eq $true) {
            Install-BeforeSubmitHookRegistration `
                -AdapterDestRel $toolConfig.HookAdapterDest `
                -SettingsRel    $toolConfig.SettingsFile
        }
    }

    # Write manifest listing all installed skill directories (enables safe re-run cleanup)
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
    $installedDirs = @(Get-ChildItem -Path $skillsDir -Directory | ForEach-Object { $_.FullName })
    if ($installedDirs.Count -gt 0) {
        $installedDirs | Set-Content -Path $manifest -Encoding UTF8
        Write-Host "  + .planifest-manifest ($($installedDirs.Count) entries)"
    }

    # Write the flags-used marker recording what was applied at install time (REQ-008, ADR-002).
    # Guarded on SkillsDir being present: OpenCode's tool config does not return an object with
    # a SkillsDir property (pre-existing setup.ps1/opencode gap, out of scope for this feature per
    # scope.md), so this silently skips there rather than erroring under $ErrorActionPreference = 'Stop'.
    if ($toolConfig -and $toolConfig.SkillsDir) {
        $toolDir = Split-Path -Parent $toolConfig.SkillsDir
        Write-SetupFlagsMarker -ToolName $ToolName -ToolDir $toolDir
    }

    Write-Host "  Done."
}

# Write the flags-used marker recording what was applied at install time (REQ-008, ADR-002).
# Called only after a tool's setup completes successfully. $ErrorActionPreference = 'Stop' means
# a failed Invoke-PlanifestSetup call halts the script before this function is ever reached,
# satisfying REQ-008's "a failed install does not write the marker" requirement.
function Write-SetupFlagsMarker {
    param($ToolName, $ToolDir)

    $targetDir = Join-Path $ProjectRoot $ToolDir
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    $markerPath = Join-Path $targetDir '.planifest-setup-flags'

    $flags = @()
    if ($ContextModeMcp) { $flags += '--context-mode-mcp' }
    if ($StructuredTelemetryMcp) { $flags += '--structured-telemetry-mcp' }
    if ($IncludeFullSkillLibrary) { $flags += '--include-full-skill-library' }
    if ($StrictOrchestrator) { $flags += '--strict-orchestrator' }

    $marker = [ordered]@{
        tool          = $ToolName
        flags         = $flags
        backendUrl    = if ($StructuredTelemetryMcp) { $BackendUrl } else { $null }
        writtenAt     = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        attemptStatus = 'completed'
    }

    $marker | ConvertTo-Json -Depth 10 | Set-Content -Path $markerPath -Encoding UTF8
    Write-Host "  + $ToolDir\.planifest-setup-flags"
}

# --- Main ---

if (-not $Tool) {
    Write-Host ""
    Write-Host "Planifest Setup"
    Write-Host ""
    Write-Host "Usage: .\planifest-framework\setup.ps1 [tool] [--context-mode-mcp]"
    Write-Host ""
    Write-Host "Tools:"
    foreach ($t in $ValidTools) {
        Write-Host "  $t"
    }
    Write-Host "  all"
    Write-Host ""
    Write-Host "Flags:"
    Write-Host "  --context-mode-mcp           Install context-mode enforcement hooks (Claude Code only)"
    Write-Host "                               (only needed if context-mode MCP plugin is installed)"
    Write-Host "                               See: https://github.com/mksglu/context-mode"
    Write-Host "  --structured-telemetry-mcp   Install structured telemetry hooks"
    Write-Host "                               Requires --context-mode-mcp to also be set."
    Write-Host "                               Context-pressure hook installed when both flags are active."
    Write-Host "  --backend-url <url>          Override telemetry backend URL (default: http://localhost:3741)"
    Write-Host "  --strict-orchestrator        Write plan/.orchestrator-strict to enable strict mode."
    Write-Host "                               The check-orchestrator-presence hook will require the"
    Write-Host "                               orchestrator to ack each new session before proceeding."
    Write-Host "  --include-full-skill-library Copy the curated external skill library into the tool's"
    Write-Host "                               skill directory (200+ open-source skills). Opt-in only."
    Write-Host ""
    Write-Host "Run from the repository root."
    Write-Host "Each tool's config: planifest-framework\setup\[tool].ps1"
    exit 0
}

Write-Host "Planifest Setup"
Write-Host ("=" * 40)

Initialize-PlanifestRepo
Invoke-PlanifestGuardrails

# Write strict-mode sentinel if --strict-orchestrator flag was passed (REQ-008)
if ($StrictOrchestrator) {
    $planDir = Join-Path $ProjectRoot 'plan'
    New-Item -ItemType Directory -Path $planDir -Force | Out-Null
    $strictPath = Join-Path $planDir '.orchestrator-strict'
    New-Item -ItemType File -Path $strictPath -Force | Out-Null
    Write-Host "  + plan/.orchestrator-strict (strict orchestrator mode enabled)"
}

$ToolLower = $Tool.ToLower()

$_syncScript = Join-Path $ScriptDir 'scripts\skill-sync.ps1'

function Invoke-SkillSync {
    param($ToolName)
    if (-not (Test-Path $_syncScript)) { return }
    try {
        & $_syncScript sync $ToolName -ErrorAction SilentlyContinue 2>$null
    } catch { }
}

if ($ToolLower -eq 'all') {
    foreach ($t in $ValidTools) {
        Invoke-PlanifestSetup -ToolName $t
        Invoke-SkillSync -ToolName $t
    }
}
elseif ($ValidTools -contains $ToolLower) {
    Invoke-PlanifestSetup -ToolName $ToolLower
    Invoke-SkillSync -ToolName $ToolLower
}
else {
    Write-Host "Unknown tool: $Tool"
    Write-Host "Valid tools: $($ValidTools -join ', '), all"
    exit 1
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "  Source of truth: planifest-framework/"
Write-Host "  Re-run after updating framework files."

