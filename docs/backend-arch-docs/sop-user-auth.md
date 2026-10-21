# SOP: Using the User Auth API (`/auth`)

## Purpose

Create user accounts and verify username/password credentials through Backbone.

**Scope limit:** login only *verifies* credentials and returns the user object. It does
**not** issue a token, cookie, or session. Your client/backend must remember who is
logged in. Do not treat a Backbone response as proof of identity on later requests
without your own session mechanism.

## Prerequisites

| Item | Value |
| --- | --- |
| Base URL | `<BACKBONE_URL>` (local default `http://localhost:5000`) |
| Auth header | **None.** `/auth/*` is public; do not send the API key. |
| Content type | `Content-Type: application/json` |
| CORS | Browsers may call `/auth/*` directly from any origin. |

Always use HTTPS in production; passwords travel in the request body.

## Endpoints

### `POST /auth/signup`

```json
{ "username": "jane_doe", "full_name": "Jane Doe", "password": "secure-password-123" }
```

Input rules (validate client-side first to give fast feedback):

- `username`: 3–30 characters, letters/digits/underscore only. Unique, case-insensitive;
  stored in lower case.
- `full_name`: at least two words (first and last), max 120 characters.
- `password`: at least 8 characters.

| Status | Meaning | Body |
| --- | --- | --- |
| 201 | Account created | `{"user": {"id", "user_id", "username", "full_name", "created_at"}}` |
| 400 | Validation failed | `{"error": "<reason>"}` |
| 409 | Username already taken | `{"error": "Username is already taken."}` |

### `POST /auth/login`

```json
{ "username": "jane_doe", "password": "secure-password-123" }
```

Username matching is case-insensitive.

| Status | Meaning | Body |
| --- | --- | --- |
| 200 | Credentials valid | `{"user": {...same shape as signup...}}` |
| 400 | `username` or `password` missing / not a string | `{"error": "..."}` |
| 401 | Wrong username or password (indistinguishable by design) | `{"error": "Invalid username or password."}` |

### User object

```json
{
  "id": 1,
  "user_id": "80bdb4ea-70c3-478a-99c9-7e0d1a1719f0",
  "username": "jane_doe",
  "full_name": "Jane Doe",
  "created_at": "2026-09-19T12:00:00"
}
```

Passwords and hashes are never returned.

## Procedure

1. **Sign up:** validate input, `POST /auth/signup`. On `201`, treat the user as logged in
   and store the returned `user` object. On `409`, prompt for another username. On `400`,
   display `error`.
2. **Log in:** `POST /auth/login`. On `200`, store the `user` object. On `401`, show a
   generic "Invalid username or password" and let the user retry.
3. **Identify the user in your app** by `user.user_id` (UUID). Do not use or expose the
   integer `id`. Use `user_id` as the key for per-user data, e.g. as the `id` in
   [`db_query_dynamic`](sop-db-query-dynamic.md).
4. **Session handling is yours:** keep the user in your own session/cookie/secure storage.
   Backbone has no logout endpoint, because there is nothing server-side to end.
5. **Never store the password** after submitting it.

## Example

```bash
curl -X POST "$URL/auth/signup" -H "Content-Type: application/json" \
  -d '{"username":"jane_doe","full_name":"Jane Doe","password":"secure-password-123"}'

curl -X POST "$URL/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"Jane_Doe","password":"secure-password-123"}'
```

## Client gotchas

- There is no rate limiting. Throttle login attempts in your own client/backend.
- There are no password-reset, change-password, or delete-account endpoints.
- Malformed JSON gives `400`, not `500`.

## Verification checklist

- [ ] Signup returns `201` with a `user_id` and no password/hash fields.
- [ ] Signing up the same username again (even in different case) returns `409`.
- [ ] Login works regardless of username casing; a wrong password returns `401`.
- [ ] Your app keys user data on `user_id`, not `id`.
- [ ] No API key is sent to `/auth/*`, and no password is logged or persisted.
