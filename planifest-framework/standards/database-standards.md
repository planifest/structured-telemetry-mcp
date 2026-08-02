# Planifest Database Standards

---

## 1. Schema Design

- **Soft deletes:** Use a `deleted_at` column instead of hard deletes, unless the data contract explicitly requires hard deletes.
- **Indexing:** Document index rationale.

---

## 2. Migrations

**Destructive operations** (drop column, drop table, rename) require:
1. A migration proposal at `src/{component-id}/docs/migrations/proposed-{desc}.md`
2. Human approval
3. A data backup plan

---

## 3. Data Contracts

- Every data-owning component has a data contract at `src/{component-id}/docs/data-contract.md`
- The data contract defines: tables, columns, types, constraints, relationships, invariants
- The data contract is the source of truth - the ORM schema must match it exactly
- Changes to the data contract require a migration proposal

---

## 4. Query Patterns

- All queries must have a timeout configured
- Raw SQL is acceptable for complex queries - document the rationale
