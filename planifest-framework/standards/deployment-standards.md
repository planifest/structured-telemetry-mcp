# Planifest Deployment Standards

---

## 1. Deployment Strategy

Use the strategy declared in the operational model.

---

## 2. Environment Configuration

- Feature flags use a structured format: `FEATURE_{NAME}_ENABLED=true|false`

---

## 3. Rollback

- Every deployment must be reversible within 5 minutes
- Keep the previous version's artifacts available for at least 7 days
