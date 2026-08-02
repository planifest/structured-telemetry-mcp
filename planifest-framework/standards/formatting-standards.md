# Formatting Standards

---

## 1. Date Format

Two formats are used across all Planifest artifacts. No others are permitted in document body text.

### Body text — DD MMM YYYY

All human-readable dates in document body text, changelogs, ADRs, plans, comments, and templates use **DD MMM YYYY**.

| Correct | Incorrect |
|---------|-----------|
| 02 May 2026 | 2026-05-02 |
| 14 Jan 2025 | 01/14/2025 |
| 07 Dec 2024 | 07/12/2024 |

### Filename prefixes — YYYY-MM-DD

File and directory names where chronological sort order must match filesystem sort order use **YYYY-MM-DD** as a prefix.

Examples: `2026-05-02-changelog.md`, `2025-01-14-security-report.md`

### Machine-readable fields — YYYY-MM-DD

Frontmatter `date:` fields and JSON date values use **YYYY-MM-DD**.

### Forbidden in body text

`MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`, ISO 8601 (`2026-05-02`), and any other format not listed above are forbidden in document body text.

---

## 2. Locale — British English

All Planifest prose, labels, comments, template text, and documentation use **British English** spellings.

> **Exceptions:** `artifact`, `initialize`, `serialize`, `disk`, and `program` use American spelling in all contexts. See `planifest-framework/standards/language-quirks-en-gb.md` for the full exception list.

### Code identifier exception

Code identifiers follow the conventions of the language or framework in use. American English in identifiers is acceptable — and sometimes required — where it is the ecosystem norm.

---

## 3. Response Verbosity

Planifest agents default to the **shortest response that fully communicates the outcome**.

### Rules

1. **Brevity is the default.** Partial sentences and single-line confirmations are correct when no explanation is needed.
2. **Explain when the why is non-obvious.** A constraint being applied, a decision that could surprise the human, or a requirement conflict all warrant explanation.
3. **Do not narrate.** Do not describe what you are about to do before doing it, or summarise what you just did after doing it.
4. **No affirmatory padding.** Do not open responses with "Certainly!", "Great question!", "Of course!", "As requested,", or similar.
5. **The human can always ask for more.** If they want detail, they will ask. Default to less.

### Examples

**Verbose (incorrect):**
> I have reviewed the feature brief and updated the business goal section to include the new gap you described. The change adds gap 6 to the numbered list and updates the closing summary paragraph to reflect all six gaps. The acceptance criteria have also been updated accordingly.

**Brief (correct):**
> Done. Gap 6 added — business goal, closing paragraph, and acceptance criteria updated.

### When explanation is appropriate

- Applying a constraint that the human did not explicitly request (cite the constraint)
- Deviating from the spec (cite the requirement and explain why)
- Blocking due to a hard limit (state what is blocked and why)
- Answering a direct question (answer it)
