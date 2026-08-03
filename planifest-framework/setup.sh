#!/usr/bin/env bash
set -euo pipefail

# Planifest Setup - Configures skills for your agentic coding tool.
#
# Usage:  ./planifest-framework/setup.sh <tool>
#
# Tools:  claude-code | cursor | codex | antigravity | copilot | windsurf | cline | all
#
# Each tool's specific config lives in setup/<tool>.sh
# This script handles shared logic only.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
WORKFLOWS_SRC="$SCRIPT_DIR/workflows"
SETUP_DIR="$SCRIPT_DIR/setup"

VALID_TOOLS="claude-code cursor codex antigravity copilot windsurf cline roo-code opencode"
CONTEXT_MODE_MCP=false
STRUCTURED_TELEMETRY_MCP=false
BACKEND_URL="http://localhost:3741"
INCLUDE_FULL_SKILL_LIBRARY=false
STRICT_ORCHESTRATOR=false

# --- Shared functions ---

copy_skills() {
  local target_dir="$1"

  for skill_dir in "$SKILLS_SRC"/*; do
    if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
      local skill_name
      skill_name="$(basename "$skill_dir")"
      local dest_dir="$target_dir/$skill_name"
      
      mkdir -p "$dest_dir"
      cp "$skill_dir/SKILL.md" "$dest_dir/SKILL.md"

      # Rewrite relative paths to match bundled directory structure
      sed -i.bak \
        -e 's|\.\./templates/|./assets/templates/|g' \
        -e 's|\.\./standards/|./references/|g' \
        -e 's|\.\./standards/reference/|./references/reference/|g' \
        -e 's|\.\./schemas/|./assets/schemas/|g' \
        "$dest_dir/SKILL.md" && rm -f "$dest_dir/SKILL.md.bak"

      echo "  + $skill_name/SKILL.md"
      
      for opt_dir in scripts assets references; do
        if [ -d "$skill_dir/$opt_dir" ]; then
          cp -r "$skill_dir/$opt_dir" "$dest_dir/"
        fi
      done
      
      # Selective bundling: read bundle_templates and bundle_standards from SKILL.md frontmatter
      local skill_md="$skill_dir/SKILL.md"
      
      # Parse frontmatter: awk handles identical start/end --- delimiters correctly
      local frontmatter
      frontmatter=$(awk '/^---$/{c++; if(c==2) exit; next} c==1{print}' "$skill_md")

      # Parse bundle_templates from frontmatter
      local bundle_templates
      bundle_templates=$(echo "$frontmatter" | grep '^bundle_templates:' | sed 's/bundle_templates: *\[//;s/\]//;s/,/ /g;s/^ *//;s/ *$//' || true)

      # Parse bundle_standards from frontmatter
      local bundle_standards
      bundle_standards=$(echo "$frontmatter" | grep '^bundle_standards:' | sed 's/bundle_standards: *\[//;s/\]//;s/,/ /g;s/^ *//;s/ *$//' || true)
      
      # Bundle only declared templates (or all if no manifest found)
      if [ -d "$SCRIPT_DIR/templates" ]; then
        mkdir -p "$dest_dir/assets/templates"
        if [ -n "$bundle_templates" ]; then
          for tpl in $bundle_templates; do
            local tpl_path="$SCRIPT_DIR/templates/$tpl"
            if [ -f "$tpl_path" ]; then
              cp "$tpl_path" "$dest_dir/assets/templates/"
            fi
          done
          echo "    templates: selective ($(echo $bundle_templates | wc -w | tr -d ' ') files)"
        else
          cp -r "$SCRIPT_DIR/templates"/* "$dest_dir/assets/templates/"
          echo "    templates: all (no manifest)"
        fi
      fi
      
      # Always bundle schemas (small, universally needed)
      if [ -d "$SCRIPT_DIR/schemas" ]; then
        mkdir -p "$dest_dir/assets/schemas"
        cp -r "$SCRIPT_DIR/schemas"/* "$dest_dir/assets/schemas/"
      fi
      
      # Bundle only declared standards (or all if no manifest found)
      if [ -d "$SCRIPT_DIR/standards" ]; then
        mkdir -p "$dest_dir/references"
        if [ -n "$bundle_standards" ]; then
          for std in $bundle_standards; do
            local std_path="$SCRIPT_DIR/standards/$std"
            if [ -f "$std_path" ]; then
              cp "$std_path" "$dest_dir/references/"
            fi
          done
          echo "    standards: selective ($(echo $bundle_standards | wc -w | tr -d ' ') files)"
        else
          # No manifest - copy all top-level standards (skip reference/ subdirectory)
          find "$SCRIPT_DIR/standards" -maxdepth 1 -type f -exec cp {} "$dest_dir/references/" \;
          echo "    standards: all top-level (no manifest)"
        fi
      fi
    fi
  done
}

copy_external_skills() {
  # Copies all skills from planifest-framework/external-skills/ into the tool's
  # skill directory. Only run when --include-full-skill-library is passed (ADR-001).
  # Each skill directory must contain SKILL.md and attribution.txt (ADR-002).
  local target_dir="$1"
  local external_dir="$SCRIPT_DIR/external-skills"

  if [ ! -d "$external_dir" ]; then
    echo "  [external-skills] directory not found — skipping"
    return 0
  fi

  local count=0
  for skill_dir in "$external_dir"/*/; do
    [ -d "$skill_dir" ] || continue
    local skill_name
    skill_name="$(basename "$skill_dir")"

    if [ ! -f "$skill_dir/SKILL.md" ]; then
      echo "  [external-skills] $skill_name — SKILL.md missing, skipping"
      continue
    fi
    if [ ! -f "$skill_dir/attribution.txt" ]; then
      echo "  [external-skills] $skill_name — attribution.txt missing, skipping"
      continue
    fi

    local dest_dir="$target_dir/$skill_name"
    mkdir -p "$dest_dir"
    cp "$skill_dir/SKILL.md" "$dest_dir/SKILL.md"
    cp "$skill_dir/attribution.txt" "$dest_dir/attribution.txt"
    echo "  + [external] $skill_name/SKILL.md"
    ((count++)) || true
  done

  if [ "$count" -eq 0 ]; then
    echo "  [external-skills] no valid skills found (each needs SKILL.md + attribution.txt)"
  else
    echo "  [external-skills] $count skill(s) installed"
  fi
}

write_boot_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"
  if [ ! -f "$path" ]; then
    echo "$content" > "$path"
    echo "  + $(basename "$path") (created)"
  else
    echo "  - $(basename "$path") (already exists, skipped)"
  fi
}

copy_capability_skills() {
  # Copies permanent capability skills from planifest-overrides/capability-skills/
  # to the tool's skills directory (REQ-008, parity with setup.ps1 Copy-CapabilitySkills).
  local target_dir="$1"
  local cap_skills_dir="$PROJECT_ROOT/planifest-overrides/capability-skills"

  if [ ! -d "$cap_skills_dir" ]; then
    return
  fi

  local found=false
  for skill_dir in "$cap_skills_dir"/*/; do
    [ -d "$skill_dir" ] || continue
    local skill_name
    skill_name="$(basename "$skill_dir")"
    local skill_md="$skill_dir/SKILL.md"

    if [ ! -f "$skill_md" ]; then
      echo "  ! Warning: capability skill '$skill_name' missing SKILL.md — skipping"
      continue
    fi

    local dest_dir="$target_dir/$skill_name"
    mkdir -p "$dest_dir"
    cp "$skill_md" "$dest_dir/SKILL.md"
    echo "  + capability-skill: $skill_name"
    found=true
  done

  if [ "$found" = true ]; then
    echo "  Syncing capability skills from planifest-overrides/capability-skills/"
  fi
}

append_override_instructions() {
  # Appends project-specific instructions from planifest-overrides/instructions/
  # into the boot file between sentinel markers (idempotent). (REQ-006, REQ-007,
  # parity with setup.ps1 Append-OverrideInstructions).
  local boot_file="$PROJECT_ROOT/$1"
  local instr_dir="$PROJECT_ROOT/planifest-overrides/instructions"
  local start_marker="<!-- planifest-overrides:instructions:start -->"
  local end_marker="<!-- planifest-overrides:instructions:end -->"

  if [ ! -d "$instr_dir" ]; then
    return
  fi

  # Collect .md files (sorted)
  local files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(find "$instr_dir" -maxdepth 1 -name "*.md" 2>/dev/null | sort)

  if [ "${#files[@]}" -eq 0 ]; then
    return
  fi

  # Idempotent: strip existing override block before re-appending
  if [ -f "$boot_file" ] && command -v node >/dev/null 2>&1; then
    PLANIFEST_BOOT="$boot_file" node -e '
      const fs = require("fs");
      const b = process.env.PLANIFEST_BOOT;
      if (!fs.existsSync(b)) process.exit(0);
      let c = fs.readFileSync(b, "utf8");
      const s = "<!-- planifest-overrides:instructions:start -->";
      const e = "<!-- planifest-overrides:instructions:end -->";
      const re = new RegExp("\\n?" + s.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&") +
        "[\\s\\S]*?" + e.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&") + "\\n?", "g");
      fs.writeFileSync(b, c.replace(re, ""), "utf8");
    '
  fi

  # Append fresh block
  {
    echo ""
    echo "$start_marker"
    for f in "${files[@]}"; do
      echo ""
      cat "$f"
    done
    echo ""
    echo "$end_marker"
  } >> "$boot_file"

  echo "  Appending override instructions from planifest-overrides/instructions/"
}


copy_workflow() {
  local workflow_file="$1"
  local target_dir="$2"
  local name
  name="$(basename "$workflow_file" .md)"
  local dest_file="$target_dir/${name}.md"

  mkdir -p "$target_dir"
  cp "$workflow_file" "$dest_file"
  echo "  + workflows/${name}.md"
}

context_mode_hook_command() {
  # Builds the PreToolUse command string for a context-mode .mjs hook
  # (REQ-004, 0000017 ADR-002). No Unix-shell dependency: `node <script>` is
  # plain-invocation syntax understood by cmd.exe, PowerShell, and POSIX
  # shells alike — no bash entry point, no jq. The `||` fallback surfaces a
  # clear runtime message and still fails open (exit 0, no deny JSON) when
  # the Node.js runtime itself is missing.
  local hooks_dir="$1"
  local script_name="$2"
  local script_path="$hooks_dir/$script_name"
  printf 'node "%s" || echo "[Planifest] context-mode enforcement (%s) did not run: Node.js runtime not found. Tool call proceeded unblocked." 1>&2' \
    "$script_path" "$script_name"
}

merge_hook_settings() {
  # Merge PreToolUse hook entries into .claude/settings.json (REQ-004, 0000017 req-004)
  # Uses additive merge: existing content is preserved; Grep/Bash/WebFetch entries
  # are removed then re-added to ensure idempotency on re-run.
  # Requires jq or node (to edit settings.json) — the hooks themselves are .mjs.
  local settings_file="$1"
  local hooks_dir="$2"  # relative path used in the command value (e.g. .claude/hooks/context-mode)

  local grep_cmd bash_cmd fetch_cmd
  grep_cmd=$(context_mode_hook_command "$hooks_dir" "block-grep.mjs")
  bash_cmd=$(context_mode_hook_command "$hooks_dir" "block-bash.mjs")
  fetch_cmd=$(context_mode_hook_command "$hooks_dir" "block-webfetch.mjs")

  if command -v jq >/dev/null 2>&1; then
    local new_hooks
    new_hooks=$(jq -n \
      --arg grep_cmd  "$grep_cmd" \
      --arg bash_cmd  "$bash_cmd" \
      --arg fetch_cmd "$fetch_cmd" \
      '[
        {"matcher":"Grep",     "hooks":[{"type":"command","command":$grep_cmd}]},
        {"matcher":"Bash",     "hooks":[{"type":"command","command":$bash_cmd}]},
        {"matcher":"WebFetch", "hooks":[{"type":"command","command":$fetch_cmd}]}
      ]')
    if [ -f "$settings_file" ]; then
      local merged
      merged=$(jq \
        --argjson new_hooks "$new_hooks" \
        '
          .hooks //= {} |
          .hooks.PreToolUse //= [] |
          .hooks.PreToolUse |= (
            map(select(.matcher | IN("Grep","Bash","WebFetch") | not))
            + $new_hooks
          )
        ' "$settings_file")
      printf '%s\n' "$merged" > "$settings_file"
      echo "  ~ .claude/settings.json (context-mode hook entries merged)"
    else
      mkdir -p "$(dirname "$settings_file")"
      jq -n --argjson new_hooks "$new_hooks" \
        '{"hooks":{"PreToolUse":$new_hooks}}' > "$settings_file"
      echo "  + .claude/settings.json (created with context-mode hook entries)"
    fi
  elif command -v node >/dev/null 2>&1; then
    PLANIFEST_GREP_CMD="$grep_cmd" PLANIFEST_BASH_CMD="$bash_cmd" PLANIFEST_FETCH_CMD="$fetch_cmd" \
    PLANIFEST_SETTINGS="$settings_file" node -e '
      const fs = require("fs"), path = require("path");
      const sf = process.env.PLANIFEST_SETTINGS;
      const newHooks = [
        {matcher:"Grep",     hooks:[{type:"command",command:process.env.PLANIFEST_GREP_CMD}]},
        {matcher:"Bash",     hooks:[{type:"command",command:process.env.PLANIFEST_BASH_CMD}]},
        {matcher:"WebFetch", hooks:[{type:"command",command:process.env.PLANIFEST_FETCH_CMD}]}
      ];
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^\uFEFF/,""));
      s.hooks = s.hooks || {};
      s.hooks.PreToolUse = (s.hooks.PreToolUse || [])
        .filter(h => !["Grep","Bash","WebFetch"].includes(h.matcher))
        .concat(newHooks);
      fs.mkdirSync(path.dirname(sf),{recursive:true});
      fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
    '
    if [ -f "$settings_file" ]; then
      echo "  ~ .claude/settings.json (context-mode hook entries merged)"
    else
      echo "  + .claude/settings.json (created with context-mode hook entries)"
    fi
  else
    echo "  ! Warning: neither jq nor node found — skipping settings.json hook wiring"
    echo "  ! Manually add PreToolUse hooks for Grep/Bash/WebFetch to .claude/settings.json"
  fi
}

install_context_mode_hooks() {
  # Copy enforcement hook scripts to the target project and wire settings.json
  # (REQ-004; ported to .mjs in 0000017 req-004 — no bash entry point, no jq).
  local hooks_src_rel="$1"   # relative to SCRIPT_DIR  e.g. hooks/context-mode
  local hooks_dir_rel="$2"   # relative to PROJECT_ROOT e.g. .claude/hooks/context-mode
  local settings_rel="$3"    # relative to PROJECT_ROOT e.g. .claude/settings.json

  local src="$SCRIPT_DIR/$hooks_src_rel"
  local dest="$PROJECT_ROOT/$hooks_dir_rel"
  local settings="$PROJECT_ROOT/$settings_rel"

  if [ ! -d "$src" ]; then
    echo "  ! Warning: hook scripts not found at $src — skipping hook installation"
    return
  fi

  echo ""
  echo "  Installing context-mode enforcement hooks"

  # Setup-time Node.js runtime check (0000017 req-004): these hooks are .mjs —
  # Node is required to run them at all. Warn clearly but still install and
  # wire the hooks; the wired command itself fails open with a runtime
  # message if Node turns out to be missing when Claude Code invokes it.
  if ! command -v node >/dev/null 2>&1; then
    echo "  ! Warning: Node.js runtime not found on this machine."
    echo "  ! context-mode enforcement hooks (block-grep/block-bash/block-webfetch) require Node.js."
    echo "  ! Hooks will be installed and wired, but will not enforce anything until Node.js is installed."
  fi

  # Create target directory
  mkdir -p "$dest"

  # Copy each script
  for script in "$src"/*.mjs; do
    [ -f "$script" ] || continue
    local script_name
    script_name="$(basename "$script")"
    cp "$script" "$dest/$script_name"
    echo "  + $hooks_dir_rel/$script_name"
  done

  # Merge PreToolUse wiring into settings.json
  merge_hook_settings "$settings" "$hooks_dir_rel"
}

install_tier1_hooks() {
  # Copy Tier 1 adapter + shared enforcement/telemetry scripts (REQ-009, REQ-013).
  # The adapter uses dirname(ADAPTER_DIR) as HOOKS_DIR, so scripts must be siblings
  # of the adapters/ directory under TOOL_HOOKS_INSTALL_DIR.
  local adapter_src_rel="$1"       # e.g. hooks/adapters/cursor.mjs
  local adapter_dest_rel="$2"      # e.g. .cursor/hooks/adapters/cursor.mjs
  local hooks_install_dir_rel="$3" # e.g. .cursor/hooks

  local adapter_src="$SCRIPT_DIR/$adapter_src_rel"
  local adapter_dest="$PROJECT_ROOT/$adapter_dest_rel"
  local hooks_install_dir="$PROJECT_ROOT/$hooks_install_dir_rel"

  if [ ! -f "$adapter_src" ]; then
    echo "  ! Warning: adapter not found at $adapter_src — skipping Tier 1 hook install"
    return
  fi

  echo ""
  echo "  Installing Planifest Tier 1 adapter hooks (REQ-009)"

  # Copy adapter
  mkdir -p "$(dirname "$adapter_dest")"
  cp "$adapter_src" "$adapter_dest"
  echo "  + $adapter_dest_rel"

  # Copy enforcement scripts (gate-write, check-design)
  local enf_src="$SCRIPT_DIR/hooks/enforcement"
  local enf_dest="$hooks_install_dir/enforcement"
  if [ -d "$enf_src" ]; then
    mkdir -p "$enf_dest"
    for script in "$enf_src"/*.mjs; do
      [ -f "$script" ] || continue
      local script_name
      script_name="$(basename "$script")"
      cp "$script" "$enf_dest/$script_name"
      echo "  + $hooks_install_dir_rel/enforcement/$script_name"
    done
  fi

  # Copy telemetry scripts (emit-phase-start, emit-phase-end)
  local telem_src="$SCRIPT_DIR/hooks/telemetry"
  local telem_dest="$hooks_install_dir/telemetry"
  if [ -d "$telem_src" ]; then
    mkdir -p "$telem_dest"
    for script in "$telem_src"/emit-phase-*.mjs; do
      [ -f "$script" ] || continue
      local script_name
      script_name="$(basename "$script")"
      cp "$script" "$telem_dest/$script_name"
      echo "  + $hooks_install_dir_rel/telemetry/$script_name"
    done
  fi

  echo "  [Planifest] Tier 1 adapter hooks installed."
}

install_tier1_hook_registration() {
  # Write PreToolUse hook registration pointing to the Tier 1 adapter (REQ-009, REQ-027).
  # Writes in the same hooks JSON shape used by Claude Code so tooling stays consistent.
  local adapter_dest_rel="$1"  # e.g. .cursor/hooks/adapters/cursor.mjs
  local settings_rel="$2"      # e.g. .cursor/settings.json

  local settings="$PROJECT_ROOT/$settings_rel"
  local adapter_cmd="node $adapter_dest_rel gate-write"

  if command -v node >/dev/null 2>&1; then
    PLANIFEST_ADAPTER_CMD="$adapter_cmd" PLANIFEST_SETTINGS="$settings" node -e '
      const fs = require("fs"), path = require("path");
      const adapterCmd = process.env.PLANIFEST_ADAPTER_CMD;
      const sf         = process.env.PLANIFEST_SETTINGS;
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^﻿/,""));
      s.hooks = s.hooks || {};
      // PreToolUse: adapter for Write and Edit (idempotent — remove then re-add)
      s.hooks.PreToolUse = (s.hooks.PreToolUse || [])
        .filter(h => !["Write","Edit"].includes(h.matcher) ||
                     !(h.hooks||[]).some(e => (e.command||"").includes("gate-write")));
      s.hooks.PreToolUse.push(
        {matcher:"Write", hooks:[{type:"command",command:adapterCmd}]},
        {matcher:"Edit",  hooks:[{type:"command",command:adapterCmd}]}
      );
      fs.mkdirSync(path.dirname(sf),{recursive:true});
      fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
    '
    echo "  ~ $settings_rel (Tier 1 adapter hook registration written)"
  else
    echo "  ! Warning: node not found — skipping $settings_rel Tier 1 hook registration"
    echo "  ! Manually register: node $adapter_dest_rel gate-write for Write/Edit PreToolUse"
  fi
}

install_before_submit_hook_registration() {
  # Wire beforeSubmitPrompt → check-design for tools that expose that event (REQ-018).
  # Currently used by Cursor only. Merges into the same settings.json as PreToolUse hooks.
  local adapter_dest_rel="$1"  # e.g. .cursor/hooks/adapters/cursor.mjs
  local settings_rel="$2"      # e.g. .cursor/settings.json

  local settings="$PROJECT_ROOT/$settings_rel"
  local adapter_cmd="node $adapter_dest_rel check-design"

  if command -v node >/dev/null 2>&1; then
    PLANIFEST_ADAPTER_CMD="$adapter_cmd" PLANIFEST_SETTINGS="$settings" node -e '
      const fs = require("fs"), path = require("path");
      const adapterCmd = process.env.PLANIFEST_ADAPTER_CMD;
      const sf         = process.env.PLANIFEST_SETTINGS;
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^﻿/,""));
      s.hooks = s.hooks || {};
      // beforeSubmitPrompt: check-design for scope injection (idempotent — remove then re-add)
      s.hooks.beforeSubmitPrompt = (s.hooks.beforeSubmitPrompt || [])
        .filter(h => !(h.hooks||[]).some(e => (e.command||"").includes("check-design")));
      s.hooks.beforeSubmitPrompt.push(
        {matcher:"*", hooks:[{type:"command",command:adapterCmd}]}
      );
      fs.mkdirSync(path.dirname(sf),{recursive:true});
      fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
    '
    echo "  ~ $settings_rel (beforeSubmitPrompt check-design hook registered)"
  else
    echo "  ! Warning: node not found — skipping beforeSubmitPrompt check-design registration"
    echo "  ! Manually register: node $adapter_dest_rel check-design for beforeSubmitPrompt"
  fi
}

install_enforcement_hooks() {
  # Copy enforcement hooks and wire PreToolUse/UserPromptSubmit (REQ-002, REQ-006, REQ-008).
  # Includes auto-trigger-orchestrator.mjs (REQ-002), gate-write.mjs, check-design.mjs.
  # Always installed, regardless of MCP flags.
  local hooks_src_rel="$1"   # e.g. hooks/enforcement
  local hooks_dir_rel="$2"   # e.g. .claude/hooks/enforcement
  local settings_rel="$3"    # e.g. .claude/settings.json

  local src="$SCRIPT_DIR/$hooks_src_rel"
  local dest="$PROJECT_ROOT/$hooks_dir_rel"
  local settings="$PROJECT_ROOT/$settings_rel"

  if [ ! -d "$src" ]; then
    echo "  ! Warning: enforcement hook scripts not found at $src — skipping"
    return
  fi

  echo ""
  echo "  Installing Planifest enforcement hooks"

  mkdir -p "$dest"
  for script in "$src"/*.mjs; do
    [ -f "$script" ] || continue
    local script_name
    script_name="$(basename "$script")"
    cp "$script" "$dest/$script_name"
    echo "  + $hooks_dir_rel/$script_name"
  done

  # Wire into settings.json (requires node; jq fallback not needed — node is always available)
  local gate_cmd="$hooks_dir_rel/gate-write.mjs"
  local ratchet_cmd="$hooks_dir_rel/ratchet-check.mjs"
  local trigger_cmd="$hooks_dir_rel/auto-trigger-orchestrator.mjs"
  local presence_cmd="$hooks_dir_rel/check-orchestrator-presence.mjs"
  local design_cmd="$hooks_dir_rel/check-design.mjs"

  if command -v node >/dev/null 2>&1; then
    PLANIFEST_GATE="$gate_cmd" PLANIFEST_RATCHET="$ratchet_cmd" PLANIFEST_TRIGGER="$trigger_cmd" PLANIFEST_PRESENCE="$presence_cmd" PLANIFEST_DESIGN="$design_cmd" PLANIFEST_SETTINGS="$settings" node -e '
      const fs = require("fs"), path = require("path");
      const gate     = process.env.PLANIFEST_GATE;
      const ratchet  = process.env.PLANIFEST_RATCHET;
      const trigger  = process.env.PLANIFEST_TRIGGER;
      const presence = process.env.PLANIFEST_PRESENCE;
      const design   = process.env.PLANIFEST_DESIGN;
      const sf       = process.env.PLANIFEST_SETTINGS;
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^\uFEFF/,""));
      s.hooks = s.hooks || {};
      // PreToolUse: gate-write + ratchet-check for Write and Edit (idempotent: remove then re-add)
      s.hooks.PreToolUse = (s.hooks.PreToolUse || [])
        .filter(h => !["Write","Edit"].includes(h.matcher) ||
                     !(h.hooks||[]).some(e => (e.command||"").includes("gate-write") ||
                                              (e.command||"").includes("ratchet-check")));
      s.hooks.PreToolUse.push(
        {matcher:"Write", hooks:[{type:"command",command:gate}]},
        {matcher:"Edit",  hooks:[{type:"command",command:gate}]},
        {matcher:"Write", hooks:[{type:"command",command:ratchet}]},
        {matcher:"Edit",  hooks:[{type:"command",command:ratchet}]}
      );
      // UserPromptSubmit: auto-trigger first, then presence check, then check-design (REQ-002, REQ-008, idempotent)
      s.hooks.UserPromptSubmit = (s.hooks.UserPromptSubmit || [])
        .filter(h => !(h.hooks||[]).some(e =>
          (e.command||"").includes("auto-trigger-orchestrator") ||
          (e.command||"").includes("check-orchestrator-presence") ||
          (e.command||"").includes("check-design")));
      s.hooks.UserPromptSubmit.push(
        {matcher:".*", hooks:[{type:"command",command:trigger}]},
        {matcher:".*", hooks:[{type:"command",command:presence}]},
        {matcher:".*", hooks:[{type:"command",command:design}]}
      );
      fs.mkdirSync(path.dirname(sf),{recursive:true});
      fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
    '
    echo "  ~ $settings_rel (enforcement hooks wired)"
  else
    echo "  ! Warning: node not found — skipping settings.json enforcement hook wiring"
    echo "  ! Manually add gate-write (Write/Edit PreToolUse), auto-trigger-orchestrator, check-orchestrator-presence and check-design (UserPromptSubmit) to $settings_rel"
  fi
}

merge_telemetry_hook_settings() {
  # Merge PostToolUse context-pressure hook entry into .claude/settings.json
  # Idempotent: removes existing context-pressure entry before re-adding.
  local settings_file="$1"
  local hooks_dir="$2"   # relative path used in the command value
  local backend_url="$3"

  local hook_cmd="PLANIFEST_TELEMETRY_URL=$backend_url node $hooks_dir/context-pressure.mjs"

  if command -v jq >/dev/null 2>&1; then
    local new_hook
    new_hook=$(jq -n \
      --arg cmd "$hook_cmd" \
      '[{"matcher":".*","hooks":[{"type":"command","command":$cmd,"async":true,"timeout":5000}]}]')
    if [ -f "$settings_file" ]; then
      local merged
      merged=$(jq \
        --argjson new_hook "$new_hook" \
        '
          .hooks //= {} |
          .hooks.PostToolUse //= [] |
          .hooks.PostToolUse |= (
            map(select(
              (.hooks // []) | map(.command // "") | any(test("context-pressure")) | not
            ))
            + $new_hook
          )
        ' "$settings_file")
      printf '%s\n' "$merged" > "$settings_file"
      echo "  ~ .claude/settings.json (telemetry PostToolUse hook merged)"
    else
      mkdir -p "$(dirname "$settings_file")"
      jq -n --argjson new_hook "$new_hook" \
        '{"hooks":{"PostToolUse":$new_hook}}' > "$settings_file"
      echo "  + .claude/settings.json (created with telemetry PostToolUse hook)"
    fi
  elif command -v node >/dev/null 2>&1; then
    PLANIFEST_HOOK_CMD="$hook_cmd" PLANIFEST_SETTINGS="$settings_file" node -e '
      const fs = require("fs"), path = require("path");
      const cmd = process.env.PLANIFEST_HOOK_CMD;
      const sf  = process.env.PLANIFEST_SETTINGS;
      const newHook = [{matcher:".*",hooks:[{type:"command",command:cmd,async:true,timeout:5000}]}];
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^\uFEFF/,""));
      s.hooks = s.hooks || {};
      s.hooks.PostToolUse = (s.hooks.PostToolUse || [])
        .filter(h => !(h.hooks||[]).some(e => (e.command||"").includes("context-pressure")))
        .concat(newHook);
      fs.mkdirSync(path.dirname(sf),{recursive:true});
      fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
    '
    if [ -f "$settings_file" ]; then
      echo "  ~ .claude/settings.json (telemetry PostToolUse hook merged)"
    else
      echo "  + .claude/settings.json (created with telemetry PostToolUse hook)"
    fi
  else
    echo "  ! Warning: neither jq nor node found — skipping telemetry settings.json wiring"
  fi
}

install_telemetry_hooks() {
  # Copy context-pressure hook script and wire PostToolUse in settings.json (REQ-008, REQ-010)
  # Only called when --structured-telemetry-mcp is active (0000018 req-001).
  local hooks_src_rel="$1"   # relative to SCRIPT_DIR  e.g. hooks/telemetry
  local hooks_dir_rel="$2"   # relative to PROJECT_ROOT e.g. .claude/hooks/telemetry
  local settings_rel="$3"    # relative to PROJECT_ROOT e.g. .claude/settings.json
  local backend_url="$4"

  local src="$SCRIPT_DIR/$hooks_src_rel"
  local dest="$PROJECT_ROOT/$hooks_dir_rel"
  local settings="$PROJECT_ROOT/$settings_rel"

  if [ ! -d "$src" ]; then
    echo "  ! Warning: telemetry hook scripts not found at $src — skipping"
    return
  fi

  echo ""
  echo "  Installing structured telemetry hooks"

  mkdir -p "$dest"

  for script in "$src"/*.mjs; do
    [ -f "$script" ] || continue
    local script_name
    script_name="$(basename "$script")"
    cp "$script" "$dest/$script_name"
    echo "  + $hooks_dir_rel/$script_name"
  done

  merge_telemetry_hook_settings "$settings" "$hooks_dir_rel" "$backend_url"
}

merge_allowed_tools() {
  # Idempotently add "Agent" to allowedTools in .claude/settings.json (REQ-002).
  # Preserves existing allowedTools entries — additive merge only.
  # Requires node (always available for Claude Code targets).
  local settings_file="$1"

  if command -v node >/dev/null 2>&1; then
    PLANIFEST_SETTINGS="$settings_file" node -e '
      const fs = require("fs"), path = require("path");
      const sf = process.env.PLANIFEST_SETTINGS;
      let s = {};
      if (fs.existsSync(sf)) s = JSON.parse(fs.readFileSync(sf,"utf8").replace(/^﻿/,""));
      const existing = Array.isArray(s.allowedTools) ? s.allowedTools : [];
      if (!existing.includes("Agent")) {
        s.allowedTools = existing.concat(["Agent"]);
        fs.mkdirSync(path.dirname(sf),{recursive:true});
        fs.writeFileSync(sf, JSON.stringify(s,null,2)+"\n");
        console.log("  ~ .claude/settings.json (Agent added to allowedTools)");
      } else {
        console.log("  - .claude/settings.json (Agent already in allowedTools)");
      }
    '
  else
    echo "  ! Warning: node not found — skipping allowedTools update"
    echo "  ! Manually add \"Agent\" to allowedTools in .claude/settings.json"
  fi
}

activate_guardrails() {
  echo ""
  echo "  Activating Planifest Git Guardrails"

  # Point Git to the version-controlled hooks directory
  # Degrade gracefully when not inside a git repository (e.g. test workspaces).
  if git config core.hooksPath planifest-framework/hooks 2>/dev/null; then
    echo "  + git config core.hooksPath planifest-framework/hooks"
  else
    echo "  ! Warning: not in a git repository — skipping core.hooksPath config"
  fi

  # Ensure hook scripts are executable (critical for Unix systems)
  chmod +x "$SCRIPT_DIR/hooks/pre-commit"
  chmod +x "$SCRIPT_DIR/hooks/pre-push"
  [ -f "$SCRIPT_DIR/hooks/commit-msg" ] && chmod +x "$SCRIPT_DIR/hooks/commit-msg"
  echo "  + hooks/pre-commit (executable)"
  echo "  + hooks/pre-push (executable)"
  [ -f "$SCRIPT_DIR/hooks/commit-msg" ] && echo "  + hooks/commit-msg (executable)"

  # Deploy the CI/CD pipeline workflow
  local github_workflows="$PROJECT_ROOT/.github/workflows"
  local workflow_src="$SCRIPT_DIR/hooks/planifest.yml"
  if [ -f "$workflow_src" ]; then
    mkdir -p "$github_workflows"
    if [ ! -f "$github_workflows/planifest.yml" ]; then
      cp "$workflow_src" "$github_workflows/planifest.yml"
      echo "  + .github/workflows/planifest.yml (created)"
    else
      echo "  - .github/workflows/planifest.yml (already exists, skipped)"
    fi
  fi

  # Deploy .gitattributes to enforce LF endings on hook scripts
  # Without this, Git for Windows re-adds CRLF on checkout, breaking the bash shebang.
  local gitattributes_src="$SCRIPT_DIR/.gitattributes"
  local gitattributes_dest="$PROJECT_ROOT/.gitattributes"
  if [ -f "$gitattributes_src" ]; then
    if [ ! -f "$gitattributes_dest" ]; then
      cp "$gitattributes_src" "$gitattributes_dest"
      echo "  + .gitattributes (created - enforces LF on hook scripts)"
    else
      echo "  - .gitattributes (already exists, skipped)"
    fi
  fi

  echo "  ✅ Git guardrails activated."
}

initialize_repo() {
  echo ""
  echo "  Initializing Repository Structure"

  local gitignore_src="$SCRIPT_DIR/.gitignore"
  local gitignore_dest="$PROJECT_ROOT/.gitignore"
  
  if [ -f "$gitignore_src" ]; then
    if [ ! -f "$gitignore_dest" ]; then
      cp "$gitignore_src" "$gitignore_dest"
      echo "  + .gitignore (copied)"
    else
      echo "  - .gitignore (already exists at root, skipped)"
    fi
  else
    echo "  ! Warning: .gitignore not found in framework directory ($gitignore_src)"
  fi

  local src_dir="$PROJECT_ROOT/src"
  if [ ! -d "$src_dir" ]; then
    mkdir -p "$src_dir"
    echo "  + src/ (created)"
  fi
  
  if [ ! -f "$src_dir/README.md" ]; then
    cat << 'EOF' > "$src_dir/README.md"
# src/

Components live here. Each component is a subfolder with a `component.yml` manifest.

See [planifest/spec/feature-structure.md](../planifest/spec/feature-structure.md) for the canonical layout.
EOF
    echo "  + src/README.md (created)"
  fi

  local plan_dir="$PROJECT_ROOT/plan"
  if [ ! -d "$plan_dir" ]; then
    mkdir -p "$plan_dir"
    echo "  + plan/ (created)"
  fi

  if [ ! -f "$plan_dir/README.md" ]; then
    cat << 'EOF' > "$plan_dir/README.md"
# plan/

Feature specifications live here. Each feature gets a subfolder.

See [plan/feature-structure.md](feature-structure.md) for the canonical layout.
EOF
    echo "  + plan/README.md (created)"
  fi

  if [ ! -f "$plan_dir/feature-structure.md" ]; then
    cat << 'EOF' > "$plan_dir/feature-structure.md"
# Planifest Ã¢â‚¬â€ Repository Structure

> The canonical layout for a Planifest-managed repository. Three top-level folders, three concerns.

---

## The Three Folders

```
repo/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ planifest-framework/        Ã¢â€ Â The framework (skills, templates, schemas, standards)
Ã¢â€â€š                                 Drop this in. Don't modify it per-project.
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ plan/                       Ã¢â€ Â The specifications (organized by feature)
Ã¢â€â€š                                 Plans, briefs, specs, ADRs, risk, scope, glossary.
Ã¢â€â€š                                 Everything that describes WHAT to build and WHY.
Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ src/                        Ã¢â€ Â The code (organized by component)
                                  Implementation, tests, config, manifests.
                                  Everything that IS the built thing.
```

---

## `planifest-framework/` Ã¢â‚¬â€ The Framework

This folder is the Planifest framework itself. It is the same across every project. You do not modify it per-feature Ã¢â‚¬â€ you update it when the framework evolves.

```
planifest/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ skills/           Ã¢â€ Â Agent instructions (orchestrator + phase skills)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ templates/        Ã¢â€ Â File format templates for every artifact
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ schemas/          Ã¢â€ Â JSON Schema validation definitions
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ standards/        Ã¢â€ Â Code quality standards
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ spec/             Ã¢â€ Â This file Ã¢â‚¬â€ the canonical structure definition
```

---

## `plan/` Ã¢â‚¬â€ The Plan/Specifications

Organized by feature. Each feature gets a subfolder. This is where humans write briefs and agents write specs. No code lives here.

```
plan/
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ {feature-id}/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ feature-brief.md          Ã¢â€ Â Human input (start here)
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ design.md                 Ã¢â€ Â Validated plan (orchestrator output)
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pipeline-run.md              Ã¢â€ Â Audit trail (per run)
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pipeline-run-phase-2.md      Ã¢â€ Â Phase 2 audit (if phased)
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ design-requirements.md               Ã¢â€ Â Functional & non-functional requirements
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ design-spec-phase-2.md       Ã¢â€ Â Phase 2 spec (if phased)
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ openapi-spec.yaml            Ã¢â€ Â API contract
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ scope.md                     Ã¢â€ Â In / Out / Deferred
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ risk-register.md             Ã¢â€ Â Risk items with likelihood & impact
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ domain-glossary.md           Ã¢â€ Â Ubiquitous language
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ security-report.md           Ã¢â€ Â Security review findings
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ quirks.md                    Ã¢â€ Â Quirks and workarounds
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ recommendations.md           Ã¢â€ Â Improvement suggestions
    Ã¢â€â€š
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ adr/
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ADR-001-{title}.md       Ã¢â€ Â Architecture decision records
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ADR-002-{title}.md
        Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
```

### Path Rules Ã¢â‚¬â€ plan/

1. **Feature ID** follows the format `{0000000}-{kebab-case-name}` - a 7-digit zero-padded number prefix for chronological ordering, followed by a human-chosen kebab-case name.
2. **No nesting** Ã¢â‚¬â€ specs, ADRs, and supporting docs are flat within the feature folder. One level of subfolders only (adr/).
3. **No code** Ã¢â‚¬â€ nothing executable lives in `plan/`. If it runs, it belongs in `src/`.
4. **Phased features** append the phase number: `design-spec-phase-2.md`, `pipeline-run-phase-2.md`. The `design.md` is updated per phase, not duplicated.
5. **ADRs** are numbered sequentially. Never renumber. Superseded ADRs stay with `status: superseded`.

---

## `src/` Ã¢â‚¬â€ The Code

Organized by component. Each component is a subfolder at the top level of `src/`. The component manifest lives with the code, not with the plan.

```
src/
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ {component-id}/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ component.yml               Ã¢â€ Â Component manifest (from template)
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ package.json                  Ã¢â€ Â (or equivalent for the stack)
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src/                          Ã¢â€ Â Implementation (structure varies by stack)
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
    Ã¢â€â€š
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tests/                        Ã¢â€ Â Tests
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
    Ã¢â€â€š
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ docs/
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ data-contract.md          Ã¢â€ Â Schema ownership & invariants
        Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ migrations/
            Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ proposed-{desc}.md    Ã¢â€ Â Migration proposals
```

### Path Rules Ã¢â‚¬â€ src/

1. **Component ID** is kebab-case, matches the `id` in `component.yml`.
2. **component.yml is mandatory** Ã¢â‚¬â€ every component has one. Read it before any work; update it after every build.
3. **Component-specific docs** live with the component at `src/{component-id}/docs/`. These describe the component's data contract, migrations, and technical specifics.
4. **Feature-level docs** live in `plan/`. The component's `component.yml` references the feature via the `feature` field.
5. **Existing components** that predate Planifest are retrofitted by adding a `component.yml` at their root.

---

## How the Three Folders Connect

```
plan/current/design.md
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ lists component IDs Ã¢â€ â€™ src/{component-id}/component.yml
                                    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ references feature Ã¢â€ â€™ plan/

plan/current/design-requirements.md
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ functional requirements Ã¢â€ â€™ implemented in Ã¢â€ â€™ src/{component-id}/src/

plan/current/adr/ADR-001-*.md
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ decisions Ã¢â€ â€™ followed by Ã¢â€ â€™ src/{component-id}/src/

plan/current/openapi-spec.yaml
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ API contract Ã¢â€ â€™ implemented in Ã¢â€ â€™ src/{component-id}/src/
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
EOF
    echo "  + plan/feature-structure.md (created)"
  fi

  # Add tool ignore rules to keep context windows lean
  local ignore_content="
# Planifest - Token Reduction (keeps agent semantic search from bloating context)
plan/_archive/
node_modules/
dist/
build/
out/
.next/
"
  for ignore_file in ".cursorignore" ".claudeignore" ".windsurfignore" ".clineignore"; do
    if [ ! -f "$PROJECT_ROOT/$ignore_file" ]; then
      echo "$ignore_content" > "$PROJECT_ROOT/$ignore_file"
      echo "  + $ignore_file (created)"
    elif ! grep -q "Planifest - Token Reduction" "$PROJECT_ROOT/$ignore_file"; then
      echo "$ignore_content" >> "$PROJECT_ROOT/$ignore_file"
      echo "  + $ignore_file (appended Planifest ignore rules)"
    fi
  done

  # Deploy .cursorindexingignore - excludes large reference docs from semantic
  # search indexing but keeps them accessible via explicit @ mention
  local indexing_ignore_content="
# Planifest - Indexing Exclusions (files accessible via @ mention but excluded from search)
*-evaluation.md
*-guide.md
tool-setup-reference.md
getting-started.md
"
  local indexing_ignore_file="$PROJECT_ROOT/.cursorindexingignore"
  if [ ! -f "$indexing_ignore_file" ]; then
    echo "$indexing_ignore_content" > "$indexing_ignore_file"
    echo "  + .cursorindexingignore (created)"
  elif ! grep -q "Planifest - Indexing Exclusions" "$indexing_ignore_file"; then
    echo "$indexing_ignore_content" >> "$indexing_ignore_file"
    echo "  + .cursorindexingignore (appended Planifest rules)"
  fi
}

setup_tool() {
  local tool="$1"
  local tool_config="$SETUP_DIR/${tool}.sh"

  if [ ! -f "$tool_config" ]; then
    echo "Error: no config file at setup/${tool}.sh"
    exit 1
  fi

  # Load tool-specific config
  source "$tool_config"

  local skills_dir="$PROJECT_ROOT/$TOOL_SKILLS_DIR"

  echo ""
  echo "  Setting up $tool"
  echo "  Skills directory: $TOOL_SKILLS_DIR/"

  # Manifest cleanup — remove only previously installed directories on re-run
  local manifest="$skills_dir/.planifest-manifest"
  if [ -f "$manifest" ]; then
    echo "  Re-run detected — removing previously installed directories"
    while IFS= read -r dir_path; do
      if [ -n "$dir_path" ] && [ -d "$dir_path" ]; then
        rm -rf "$dir_path"
        echo "  - removed: $(basename "$dir_path")"
      fi
    done < "$manifest"
    rm -f "$manifest"
  fi

  # Copy skills (now automatically bundles supporting files)
  copy_skills "$skills_dir"

  # Copy external skills if --include-full-skill-library flag is set (REQ-004, ADR-001)
  if [ "$INCLUDE_FULL_SKILL_LIBRARY" = true ]; then
    copy_external_skills "$skills_dir"
  fi

  # Copy permanent capability skills from planifest-overrides/ (REQ-008)
  copy_capability_skills "$skills_dir"

  # Copy workflows (if tool defines a workflow dir)
  if [ -n "${TOOL_WORKFLOWS_DIR:-}" ] && [ -d "$WORKFLOWS_SRC" ]; then
    local workflows_dir="$PROJECT_ROOT/$TOOL_WORKFLOWS_DIR"
    for wf in "$WORKFLOWS_SRC"/*.md; do
      [ -f "$wf" ] && copy_workflow "$wf" "$workflows_dir"
    done
  fi

  # Create boot file (if tool defines one)
  if [ -n "${TOOL_BOOT_FILE:-}" ]; then
    if [ -z "${TOOL_BOOT_CONTENT:-}" ] && [ -n "${TOOL_BOOT_TEMPLATE:-}" ]; then
      TOOL_BOOT_CONTENT=$(cat "$SCRIPT_DIR/../$TOOL_BOOT_TEMPLATE")
    fi
    write_boot_file "$PROJECT_ROOT/$TOOL_BOOT_FILE" "$TOOL_BOOT_CONTENT"
  fi

  # Append project-specific override instructions to boot file (REQ-006, REQ-007)
  if [ -n "${TOOL_BOOT_FILE:-}" ]; then
    append_override_instructions "$TOOL_BOOT_FILE"
  fi

  # Install context-mode enforcement hooks if --context-mode-mcp flag is set (REQ-004)
  if [ "$CONTEXT_MODE_MCP" = true ] && [ -n "${TOOL_HOOKS_SRC:-}" ] && [ -n "${TOOL_HOOKS_DIR:-}" ] && [ -n "${TOOL_SETTINGS_FILE:-}" ]; then
    install_context_mode_hooks "$TOOL_HOOKS_SRC" "$TOOL_HOOKS_DIR" "$TOOL_SETTINGS_FILE"
  fi

  # Install Planifest enforcement hooks unconditionally (REQ-008)
  # Not gated on MCP flags — enforcement applies to all Planifest-enabled projects.
  # Skipped for Tier 1 tools — they use the adapter path instead (REQ-027).
  if [ -n "${TOOL_SETTINGS_FILE:-}" ] && ! [[ "${PLANIFEST_TIER:-}" =~ ^1 ]]; then
    install_enforcement_hooks "hooks/enforcement" ".claude/hooks/enforcement" "$TOOL_SETTINGS_FILE"
  fi

  # Add Agent to allowedTools so sub-agent dispatch works without per-use confirmation (REQ-002)
  if [ -n "${TOOL_SETTINGS_FILE:-}" ]; then
    merge_allowed_tools "$PROJECT_ROOT/$TOOL_SETTINGS_FILE"
  fi

  # Tier 1 / 1b: copy adapter + shared hook scripts (REQ-009, REQ-010, REQ-013)
  if [[ "${PLANIFEST_TIER:-}" =~ ^1 ]] && [ -n "${TOOL_HOOK_ADAPTER_SRC:-}" ]; then
    install_tier1_hooks "$TOOL_HOOK_ADAPTER_SRC" "$TOOL_HOOK_ADAPTER_DEST" "$TOOL_HOOKS_INSTALL_DIR"
  fi

  # Tier 1: wire adapter registration into tool settings (REQ-027)
  if [[ "${PLANIFEST_TIER:-}" =~ ^1 ]] && [ -n "${TOOL_HOOK_ADAPTER_DEST:-}" ] && [ -n "${TOOL_SETTINGS_FILE:-}" ]; then
    install_tier1_hook_registration "$TOOL_HOOK_ADAPTER_DEST" "$TOOL_SETTINGS_FILE"
  fi

  # Tier 1: wire beforeSubmitPrompt → check-design for tools that support it (REQ-018)
  if [[ "${PLANIFEST_TIER:-}" =~ ^1 ]] && [ "${TOOL_BEFORE_SUBMIT_HOOK:-}" = true ] && \
     [ -n "${TOOL_HOOK_ADAPTER_DEST:-}" ] && [ -n "${TOOL_SETTINGS_FILE:-}" ]; then
    install_before_submit_hook_registration "$TOOL_HOOK_ADAPTER_DEST" "$TOOL_SETTINGS_FILE"
  fi

  # Write telemetry opt-in sentinel so skills know emission is authorised (REQ-004)
  if [ "$STRUCTURED_TELEMETRY_MCP" = true ]; then
    local sentinel="$PROJECT_ROOT/.claude/telemetry-enabled"
    mkdir -p "$(dirname "$sentinel")"
    if [ ! -f "$sentinel" ]; then
      touch "$sentinel"
      echo "  + .claude/telemetry-enabled (telemetry opt-in sentinel)"
    else
      echo "  - .claude/telemetry-enabled (already exists)"
    fi
  fi

  # Install telemetry hooks whenever --structured-telemetry-mcp is active (0000018 req-001)
  # No longer requires --context-mode-mcp — that AND-condition silently left telemetry
  # hooks unwired for any project passing --structured-telemetry-mcp alone.
  if [ "$STRUCTURED_TELEMETRY_MCP" = true ] && \
     [ -n "${TOOL_TELEMETRY_HOOKS_SRC:-}" ] && [ -n "${TOOL_TELEMETRY_HOOKS_DIR:-}" ] && \
     [ -n "${TOOL_SETTINGS_FILE:-}" ]; then
    install_telemetry_hooks "$TOOL_TELEMETRY_HOOKS_SRC" "$TOOL_TELEMETRY_HOOKS_DIR" "$TOOL_SETTINGS_FILE" "$BACKEND_URL"
  fi

  # Tier 3 tools: no hook system — print deterministic enforcement warning (REQ-012)
  if [ "${PLANIFEST_TIER:-}" = "3" ]; then
    echo ""
    echo "  ⚠  [Planifest] $tool does not support deterministic enforcement hooks."
    echo "     Scope enforcement and telemetry emission are instruction-based only."
    echo "     Writes are NOT blocked at the tool level — agent instruction compliance"
    echo "     is the only enforcement mechanism for this tool."
  fi

  # Tier 1 / 1b: remind operator to register the adapter in the tool's hook settings
  if [[ "${PLANIFEST_TIER:-}" =~ ^1 ]] && [ -n "${TOOL_HOOK_ADAPTER_DEST:-}" ]; then
    echo ""
    echo "  ℹ  [Planifest] Tier ${PLANIFEST_TIER} — enforcement active via adapter."
    echo "     If the adapter is not yet registered in $tool's hook settings, wire it manually."
    echo "     Adapter path: $TOOL_HOOK_ADAPTER_DEST"
  fi

  # Tier 1b (Codex CLI): activate codex_hooks feature flag and register adapter (REQ-010)
  if [ "${PLANIFEST_TIER:-}" = "1b" ] && [ -n "${TOOL_HOOK_ADAPTER_DEST:-}" ]; then
    local codex_config="$PROJECT_ROOT/.codex/config.toml"
    mkdir -p "$(dirname "$codex_config")"
    if [ ! -f "$codex_config" ]; then
      cat > "$codex_config" << 'TOML'
[features]
codex_hooks = true

[hooks]
TOML
      echo "pre_tool_use = \"node $TOOL_HOOK_ADAPTER_DEST\"" >> "$codex_config"
      echo "  + .codex/config.toml (created with codex_hooks + pre_tool_use hook)"
    else
      # Idempotent: add codex_hooks if absent
      if ! grep -q "codex_hooks" "$codex_config"; then
        printf '\n[features]\ncodex_hooks = true\n' >> "$codex_config"
        echo "  ~ .codex/config.toml (codex_hooks = true appended)"
      else
        echo "  - .codex/config.toml (codex_hooks already present)"
      fi
      # Idempotent: add pre_tool_use hook if absent
      if ! grep -q "pre_tool_use" "$codex_config"; then
        printf '\n[hooks]\npre_tool_use = "node %s"\n' "$TOOL_HOOK_ADAPTER_DEST" >> "$codex_config"
        echo "  ~ .codex/config.toml (pre_tool_use hook registered)"
      else
        echo "  - .codex/config.toml (pre_tool_use already registered)"
      fi
    fi
    echo ""
    echo "  ⚠  [Planifest] Note: Codex CLI hooks are Bash-only."
    echo "     Write interception works in shell environments."
    echo "     Windows is not supported."
  fi

  # Write manifest listing all installed skill directories (enables safe re-run cleanup)
  local installed_dirs=()
  for dir in "$skills_dir"/*/; do
    [ -d "$dir" ] && installed_dirs+=("${dir%/}")
  done
  if [ ${#installed_dirs[@]} -gt 0 ]; then
    printf '%s\n' "${installed_dirs[@]}" > "$manifest"
    echo "  + .planifest-manifest (${#installed_dirs[@]} entries)"
  fi

  echo "  Done."
}

# Write planifest-overrides/setup-config/{tool}.md — the tracked, git-versioned source
# of truth for active setup flags/backendUrl (0000025 req-004, ADR-002 decision 1). This
# is additive: it does not replace write_setup_flags_marker, and it is called BEFORE it so
# the gitignored marker is always (re)written to match this file's values for the current
# run, satisfying ADR-002 decision 3's reconciliation rule. If the write fails (e.g.
# permissions), warns and returns non-zero so the caller falls back to existing
# marker-only behavior instead of aborting setup (req-004 acceptance criteria, sad path).
write_setup_config_override() {
  local tool="$1"

  local config_dir="$PROJECT_ROOT/planifest-overrides/setup-config"
  local config_file="$config_dir/${tool}.md"

  local flags=()
  [ "$CONTEXT_MODE_MCP" = true ] && flags+=("--context-mode-mcp")
  [ "$STRUCTURED_TELEMETRY_MCP" = true ] && flags+=("--structured-telemetry-mcp")
  [ "$INCLUDE_FULL_SKILL_LIBRARY" = true ] && flags+=("--include-full-skill-library")
  [ "$STRICT_ORCHESTRATOR" = true ] && flags+=("--strict-orchestrator")

  local flags_json="[]"
  if [ ${#flags[@]} -gt 0 ]; then
    flags_json=$(printf '"%s",' "${flags[@]}")
    flags_json="[${flags_json%,}]"
  fi

  local backend_url_json="null"
  [ "$STRUCTURED_TELEMETRY_MCP" = true ] && backend_url_json="\"$BACKEND_URL\""

  local written_at
  written_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  if ! mkdir -p "$config_dir" 2>/dev/null; then
    echo "  ! Warning: could not create planifest-overrides/setup-config/ — continuing with .planifest-setup-flags-only behavior" >&2
    return 1
  fi

  if ! cat > "$config_file" << CONFIG_EOF
# Setup config: $tool

> Tracked source of truth for active setup flags/backend-url for **$tool**
> (0000025 req-004, ADR-002). The gitignored \`.planifest-setup-flags\` marker in
> this tool's config directory is a local completion-status cache, reconciled to
> match this file on every \`setup.sh\`/\`setup.ps1\` run.

\`\`\`json
{
  "tool": "$tool",
  "flags": $flags_json,
  "backendUrl": $backend_url_json,
  "writtenAt": "$written_at"
}
\`\`\`
CONFIG_EOF
  then
    echo "  ! Warning: failed to write planifest-overrides/setup-config/${tool}.md — continuing with .planifest-setup-flags-only behavior" >&2
    return 1
  fi

  echo "  + planifest-overrides/setup-config/${tool}.md"
  return 0
}

# Write the flags-used marker recording what was applied at install time (REQ-008, ADR-002).
# Called only after a tool's setup completes successfully. set -euo pipefail means a failed
# setup_tool/opencode.sh call aborts the script before this function is ever reached, satisfying
# REQ-008's "a failed install does not write the marker" requirement without extra bookkeeping.
write_setup_flags_marker() {
  local tool="$1"
  local tool_dir="$2"

  mkdir -p "$PROJECT_ROOT/$tool_dir"
  local marker="$PROJECT_ROOT/$tool_dir/.planifest-setup-flags"

  local flags=()
  [ "$CONTEXT_MODE_MCP" = true ] && flags+=("--context-mode-mcp")
  [ "$STRUCTURED_TELEMETRY_MCP" = true ] && flags+=("--structured-telemetry-mcp")
  [ "$INCLUDE_FULL_SKILL_LIBRARY" = true ] && flags+=("--include-full-skill-library")
  [ "$STRICT_ORCHESTRATOR" = true ] && flags+=("--strict-orchestrator")

  local flags_json="[]"
  if [ ${#flags[@]} -gt 0 ]; then
    flags_json=$(printf '"%s",' "${flags[@]}")
    flags_json="[${flags_json%,}]"
  fi

  local backend_url_json="null"
  [ "$STRUCTURED_TELEMETRY_MCP" = true ] && backend_url_json="\"$BACKEND_URL\""

  local written_at
  written_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat > "$marker" << MARKER_EOF
{
  "tool": "$tool",
  "flags": $flags_json,
  "backendUrl": $backend_url_json,
  "writtenAt": "$written_at",
  "attemptStatus": "completed"
}
MARKER_EOF

  echo "  + $tool_dir/.planifest-setup-flags"
}

# --- Main ---

# Skill subcommands — delegate to skill-sync.sh and exit immediately (REQ-024)
_FIRST_ARG="${1:-}"
if [[ "$_FIRST_ARG" =~ ^(add-skill|remove-skill|preserve-skill|unpreserve-skill)$ ]]; then
  _SYNC_OP="${_FIRST_ARG%%-skill}"  # add-skill→add, preserve-skill→preserve, etc.
  SYNC_SCRIPT="$SCRIPT_DIR/scripts/skill-sync.sh"
  [ -f "$SYNC_SCRIPT" ] || { echo "Error: skill-sync.sh not found. Re-run setup.sh first."; exit 1; }
  chmod +x "$SYNC_SCRIPT"
  shift
  exec bash "$SYNC_SCRIPT" "$_SYNC_OP" "$@"
fi

TOOL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --context-mode-mcp) CONTEXT_MODE_MCP=true; shift ;;
    --structured-telemetry-mcp) STRUCTURED_TELEMETRY_MCP=true; shift ;;
    --include-full-skill-library) INCLUDE_FULL_SKILL_LIBRARY=true; shift ;;
    --strict-orchestrator) STRICT_ORCHESTRATOR=true; shift ;;
    --backend-url)
      if [[ -z "${2:-}" ]] || [[ "${2:-}" == -* ]]; then
        echo "Error: --backend-url requires a value"; exit 1
      fi
      BACKEND_URL="$2"; shift 2 ;;
    -*) echo "Unknown flag: $1"; exit 1 ;;
    *) TOOL="$1"; shift ;;
  esac
done

if [ -z "$TOOL" ]; then
  echo ""
  echo "Planifest Setup"
  echo ""
  echo "Usage: ./planifest-framework/setup.sh <tool> [--context-mode-mcp]"
  echo ""
  echo "Tools:"
  for t in $VALID_TOOLS; do
    echo "  $t"
  done
  echo "  all"
  echo ""
  echo "Flags:"
  echo "  --context-mode-mcp           Install context-mode enforcement hooks (Claude Code only)"
  echo "                               (only needed if context-mode MCP plugin is installed)"
  echo "                               See: https://github.com/mksglu/context-mode"
  echo "  --structured-telemetry-mcp   Install structured telemetry hooks"
  echo "                               Requires --context-mode-mcp to also be set."
  echo "                               Context-pressure hook installed when both flags are active."
  echo "  --backend-url <url>          Override telemetry backend URL (default: http://localhost:3741)"
  echo "  --include-full-skill-library Copy curated open-source skills from external-skills/"
  echo "                               to the tool's skill directory. Each skill carries an"
  echo "                               attribution.txt with license and copyright details."
  echo "                               Skills are MIT-licensed. Opt-in only (ADR-001)."
  echo "  --strict-orchestrator        Write plan/.orchestrator-strict to enable strict mode."
  echo "                               The check-orchestrator-presence hook will require the"
  echo "                               orchestrator to ack each new session before proceeding."
  echo ""
  echo "Run from the repository root."
  echo "Each tool's config: planifest-framework/setup/<tool>.sh"
  exit 0
fi

echo "Planifest Setup"
echo "Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â"

initialize_repo
activate_guardrails

# Write strict-mode sentinel if --strict-orchestrator flag was passed (REQ-008)
if [ "$STRICT_ORCHESTRATOR" = true ]; then
  mkdir -p "$PROJECT_ROOT/plan"
  touch "$PROJECT_ROOT/plan/.orchestrator-strict"
  echo "  + plan/.orchestrator-strict (strict orchestrator mode enabled)"
fi

run_tool_setup() {
  local t="$1"
  # opencode has its own bespoke setup script (Tier 2: Bun plugin)
  if [ "$t" = "opencode" ]; then
    bash "$SETUP_DIR/opencode.sh"
    write_setup_config_override "$t" || true
    write_setup_flags_marker "$t" ".opencode"
  else
    setup_tool "$t"
    write_setup_config_override "$t" || true
    # TOOL_SKILLS_DIR is set globally by the tool config sourced inside setup_tool
    # (e.g. ".claude/skills"); its parent is the tool's own config directory (REQ-008).
    write_setup_flags_marker "$t" "$(dirname "$TOOL_SKILLS_DIR")"
  fi
  # Re-sync external skills after tool setup (REQ-024/REQ-025)
  local sync_script="$SCRIPT_DIR/scripts/skill-sync.sh"
  if [ -f "$sync_script" ]; then
    chmod +x "$sync_script"
    bash "$sync_script" sync "$t" 2>/dev/null || true
  fi
}

if [ "$TOOL" = "all" ]; then
  for t in $VALID_TOOLS; do
    run_tool_setup "$t"
  done
elif echo "$VALID_TOOLS" | grep -qw "$TOOL"; then
  run_tool_setup "$TOOL"
else
  echo "Unknown tool: $TOOL"
  echo "Valid tools: $VALID_TOOLS, all"
  exit 1
fi

echo ""
echo "Setup complete."
echo "  Source of truth: planifest-framework/"
echo "  Re-run after updating framework files."

