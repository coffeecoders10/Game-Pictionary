# Backbone Client SOPs

Agent-ready Standard Operating Procedures for **using** the Backbone API from another
project. Each SOP is self-contained: give an agent one file and it has the endpoints,
auth, request/response shapes, error handling, and a step-by-step procedure for that
feature. They do not cover how to re-implement the backend.

| SOP | Feature | Route prefix | Auth |
| --- | --- | --- | --- |
| [sop-db-query.md](sop-db-query.md) | JSON documents in named tables, server-assigned integer ids | `/db_query` | `Authorization: Bearer <db_query_api_key>` |
| [sop-db-query-dynamic.md](sop-db-query-dynamic.md) | Free-form JSON documents keyed by a string id you choose | `/db_query_dynamic` | same `db_query_api_key` |
| [sop-user-auth.md](sop-user-auth.md) | Username/password signup and login | `/auth` | none (public) |

## Typical combination

1. `POST /auth/signup` or `/auth/login` → get `user.user_id`.
2. Use `user_id` as the `id` in `/db_query_dynamic/user_media` to store that user's data.

## What the agent needs from you

- The Backbone base URL.
- The `db_query_api_key` (for the two db SOPs), supplied via environment variable.
- For a new table, ask the Backbone owner to add it; clients cannot create tables.

## Shared rules

- Send `Content-Type: application/json` on every request with a body.
- API keys are server secrets: keep them in backend environment config, never in
  browser/mobile code or source control.
- Errors are JSON: `{"error": "<message>"}`.
