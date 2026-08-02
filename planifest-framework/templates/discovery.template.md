---
title: "Discovery - {{feature-id}}"
summary: "Raw P0 discovery-pass findings — what the orchestrator knew before coaching began."
---
# Discovery - {{feature-id}}

> Created at the start of P0, before the first coaching question, in every adoption mode.
> Raw findings only — decisions belong in `design.md`, the Q&A audit trail in `build-log.md`.
> Unreadable signal: say so; coaching proceeds.

## Header (all modes)

| Field | Value |
|-------|-------|
| Adoption mode detected | `{{mode}}` |
| Detection signal | `{{signal that produced the mode}}` |
| Git pre-flight | `{{branch, main-up-to-date confirmation state}}` |
| Skills inbox | `{{scan result or "empty"}}` |

## Mode Findings

<!-- Populate the subsection for the confirmed adoption mode; delete the others.
     External Anchor keeps its own subsection PLUS whichever underlying mode's
     subsection applies to what else is present in the repo. -->

### Greenfield

- Repo instructions (`planifest-overrides/instructions/`): {{contents summary or "None"}}
- Version baseline: `0.1.0`

### Standard Iterative

- Current version (`docs/about.md`): `{{version}}`
- Prior features (`plan/_archive/`): {{feature IDs, dates, one-liners}}
- Constraining ADRs (unless superseded): {{list}}
- Component / data-ownership map (`docs/`): {{summary}}

### Retrofit

- Suggested version and source markers: {{version — package.json / go.mod / git tags / README}}
- Entry points / stack: {{findings}}
- Candidate components: {{findings}}
- Data ownership: {{findings}}
- API contracts: {{findings}}
- Existing patterns (auth, logging, error handling, testing): {{findings}}
- Tech debt surfaced: {{findings}}

### External Anchor

- `external-versioning.md` constraints: {{full constraints}}
- Underlying mode content: {{Standard-Iterative / Retrofit / Greenfield findings per what else is present}}
