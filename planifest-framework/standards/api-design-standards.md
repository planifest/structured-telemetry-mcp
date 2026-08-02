# Planifest API Design Standards

---

## 1. REST Conventions

| Concern | Standard |
|---------|----------|
| **Status codes** | Use standard HTTP status codes. |
| **Versioning** | URL path prefix: `/api/v1/`. Never break a published version. |
| **Pagination** | Cursor-based preferred. Offset-based acceptable. Always include `total`, `next`, `previous`. |
| **Filtering** | Query parameters: `?status=active&created_after=2024-01-01` |
| **Sorting** | Query parameter: `?sort=created_at:desc` |

---

## 2. Request/Response Format

- All IDs use the format defined in the component's data contract
- Null fields are omitted from responses (do not send `"field": null`)
- Envelope responses for collections: `{ "data": [...], "pagination": {...} }`

---

## 3. Error Responses

All errors use a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}
```

- `code` is a machine-readable constant (UPPER_SNAKE_CASE)
- `message` is human-readable, never exposes internal details
- `details` is optional, used for field-level validation errors

---

## 4. Authentication and Authorization

- All endpoints require authentication unless explicitly marked as public in the OpenAPI spec
- Use the auth strategy declared in the confirmed design (JWT, session, OAuth2, API key)
- Authorization checks happen at the handler level, not in middleware alone
- Rate limiting is required for all public-facing endpoints

---

## 5. OpenAPI Specification

- Every API must have a corresponding OpenAPI 3.1 spec at `plan/{feature-id}/openapi-spec.yaml`
- The spec is the source of truth - implementation must match it exactly
- Every endpoint, parameter, request body, and response must be documented

---

## 6. Breaking Changes

Breaking changes require:
1. An ADR documenting the change and its impact
2. Human approval
3. A new API version (`v1` → `v2`)
4. A migration period where both versions are available

