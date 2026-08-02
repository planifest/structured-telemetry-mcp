# Deletes exactly CLAUDE.md and AGENTS.md from the current directory, nothing else.
#
# Hardcoded allowlist per ADR-001 (0000020-setup-refresh-skill): never parameterised,
# never reads a file list from an argument, environment variable, or config file.
# This script exists so the deletion boundary is enforced in code, not only in the
# planifest-refresh-setup skill's prose instructions (0000020 P5 security finding:
# a prompt-only instruction has no deterministic backstop against agent error or
# prompt injection the way gate-write.mjs backs the write-scope guarantee).
#
# Takes no arguments. Exits 0 whether or not either file was present.

$ErrorActionPreference = 'Stop'

foreach ($f in @('CLAUDE.md', 'AGENTS.md')) {
    if (Test-Path $f) {
        Remove-Item $f -Force
        Write-Host "  - removed: $f"
    }
}
