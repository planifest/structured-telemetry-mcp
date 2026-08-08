---
title: "Requirement: req-012 - Local-only file hygiene"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-012 - Local-only file hygiene

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-012
**Priority:** should-have

## User Story

As a maintainer, I want files matching `*.local-only.*` ignored by git and untracked, so that local helper scripts cannot be committed by an `add -A`.

## Current state

Two files at the repository root carry the `.local-only.` naming convention but are **tracked in git**, contradicting what their names assert:

- `update-planifest-framework.local-only.sh`
- `update-planifest-framework.local-only.md`

Verified at P0: `git check-ignore` matches neither (exit 1), and `git ls-files --error-unmatch` resolves both. The naming convention is currently unenforced, so `git add -A` stages edits to them.

## Functional Requirements

- Add the pattern `*.local-only.*` to `.gitignore`.
- Untrack the two files above with `git rm --cached`, leaving both present on disk. Neither file is deleted from the working tree — they are working helper scripts.
- The `.gitignore` edit and the untracking may land in the same commit. What is required is that this requirement's changes do not share a commit with `src/` product code, so the hygiene change stays revertible on its own.
- Note in the commit message that the files remain on disk, since a bare deletion in the diff reads as removal to anyone else on the repo.

## Acceptance Criteria

- [ ] `.gitignore` contains `*.local-only.*`, `git check-ignore -v` matches both existing files against that pattern, and a newly created file matching it is ignored by `git status`
- [ ] `git ls-files` lists neither file, while both remain present on disk with unmodified content, and `git add -A` from a clean tree stages neither
- [ ] The change shares no commit with any `src/` change

## Dependencies

- None. Fully independent of req-001 through req-011 — it touches no source file and can be implemented in any order, including first.

## Notes

Scope check: the pattern `*.local-only.*` requires a dot on both sides, so it matches `foo.local-only.sh` but not a file merely named `local-only.txt` or a directory called `local-only/`. That is the intended narrowness — the convention in use here is an infix, and a broader pattern risks ignoring files nobody meant to hide.
