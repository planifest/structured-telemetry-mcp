# Setup config: claude-code

> Tracked source of truth for active setup flags/backend-url for **claude-code**
> (0000025 req-004, ADR-002). The gitignored `.planifest-setup-flags` marker in
> this tool's config directory is a local completion-status cache, reconciled to
> match this file on every `setup.sh`/`setup.ps1` run.

```json
{
  "tool": "claude-code",
  "flags": ["--context-mode-mcp","--structured-telemetry-mcp"],
  "backendUrl": "http://localhost:3741",
  "writtenAt": "2026-08-03T21:02:48Z"
}
```
