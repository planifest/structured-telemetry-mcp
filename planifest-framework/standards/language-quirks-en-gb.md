---
title: "Language Quirks - en-GB"
locale: "en-GB"
version: "1.0.0"
---
# Language Quirks: en-GB

The framework default is **British English**. This file documents deliberate exceptions — cases where a different convention is used, and why. Agents and humans consult this file before writing or correcting framework content.

---

## Category 1 — Code is never corrected

The following are identifiers, not prose. Spelling correction tools must skip them entirely:

- Fenced code blocks (` ``` `-delimited)
- Inline code spans (backtick-wrapped: `` `value` ``)
- File paths and URLs
- Variable names, function names, class names
- API endpoint strings and HTTP header names
- Configuration keys and YAML/JSON values
- Command-line arguments and flags

---

## Category 2 — American spelling exceptions (always, even in prose)

These terms use American spelling in all contexts because they are the established industry standard in technical documentation.

| Use | Not | Reason |
|-----|-----|--------|
| `artifact` / `artifacts` | `artefact` / `artefacts` | Industry-standard technical term |
| `initialize` / `initialization` | `initialise` / `initialisation` | Dominant in tooling, function names, docs |
| `serialize` / `deserialize` | `serialise` / `deserialise` | Codec and data format convention |
| `disk` | `disc` | Storage convention (SSD, disk I/O) |
| `program` | `programme` | Software context only; `programme` reserved for schedules/events |

---

## Category 3 — American spelling in code and named technical concepts only

In prose, use British spelling. In code (Category 1) or when referring to a named technical concept, the American form may appear.

| American form | British form (use in prose) | Named concept example |
|---|---|---|
| `color` | `colour` | CSS `color` property, Tailwind `text-{color}` |
| `center` | `centre` | CSS `text-center`, `align-center` |
| `fiber` | `fibre` | Node.js `Fiber`, React Fiber |

---

## Category 4 — British noun/verb distinction preserved

| Form | Usage | Example |
|------|-------|---------|
| `licence` | Noun | "distributed under an MIT licence" |
| `license` | Verb | "licensed under MIT" |

In code identifiers (e.g. `package.json` `"license"` field, `LICENSE` file), Category 1 applies — the identifier is not corrected.

---

## Category 5 — Capitalisation in prose

Always uppercase in running prose, regardless of surrounding text:

`ID`, `URL`, `API`, `CLI`, `SDK`, `MCP`, `PR`, `CI`, `CD`, `IaC`, `ORM`

In code (variable names, config keys), follow the casing convention of the language/framework — Category 1 applies.

---

## Category 6 — Countability

`data` and `metadata` are uncountable in this framework.

- ✓ "the data is stored"
- ✗ "the data are stored"
- ✓ "the metadata is missing"
- ✗ "the metadata are missing"

---

## Category 7 — Prohibited punctuation

**Em dashes (`—`) must not be used** in any framework prose, headings, or documentation unless the syntax of the output format strictly requires one. They carry no meaning that a colon, comma, or full stop cannot convey more cleanly, and are strongly associated with AI-generated text.

- ✓ "Build Assessment: results and findings"
- ✗ "Build Assessment — results and findings"
- ✓ "Three tiers: local, docker, ci-only"
- ✗ "Three tiers — local, docker, ci-only"

In code (Category 1) em dashes are not corrected if they appear as literal string content.
