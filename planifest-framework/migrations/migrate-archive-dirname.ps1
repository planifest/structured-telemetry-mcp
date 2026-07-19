# migrate-archive-dirname.ps1 — Rename plan/archive/ to plan/_archive/
# Idempotent: safe to run multiple times.
# Run from the repository root.

$ErrorActionPreference = 'Stop'

$Old = 'plan\archive'
$New = 'plan\_archive'

$oldExists = Test-Path $Old
$newExists = Test-Path $New

if ($oldExists -and $newExists) {
    Write-Host "WARNING: Both $Old\ and $New\ exist."
    Write-Host "Cannot rename automatically. Please resolve manually:"
    Write-Host "  1. Decide which directory is authoritative."
    Write-Host "  2. Move its contents to $New\ if needed."
    Write-Host "  3. Delete $Old\."
    exit 1
}

if ($newExists -and -not $oldExists) {
    Write-Host "$New\ already exists and $Old\ is absent — already correct. No changes needed."
    exit 0
}

if (-not $oldExists -and -not $newExists) {
    Write-Host "Neither $Old\ nor $New\ exists — nothing to migrate."
    exit 0
}

# Case: $Old exists, $New does not
Write-Host "Renaming $Old\ → $New\ ..."
Rename-Item -Path $Old -NewName '_archive'
Write-Host "Done. $New\ is now the archive directory."
