# SOP: Using the `db_query_dynamic` API (free-form JSON, client-chosen string ids)

## Purpose

Store one free-form JSON document per **id you choose** (typically a user's `user_id`
UUID from [sop-user-auth.md](sop-user-auth.md)). Use it for "one document per user"
data, e.g. a user's media list.

Differences from [`db_query`](sop-db-query.md):

| | `db_query` | `db_query_dynamic` |
| --- | --- | --- |
| Prefix | `/db_query` | `/db_query_dynamic` |
| Row id | server-assigned integer | string you supply |
| Create body | `{name, description}` | `{id}` |
| Update body | `{"pjson": {...}}` | the JSON object itself, no wrapper |
| Document field in responses | `pjson` | `mjson` |

## Prerequisites

| Item | Value |
| --- | --- |
| Base URL | `<BACKBONE_URL>` (local default `http://localhost:5000`) |
| Auth header | `Authorization: Bearer <db_query_api_key>` (same key as `db_query`) |
| Content type | `Content-Type: application/json` |
| Table name | Currently only `user_media`. New tables must be added server-side by the Backbone owner. |

Keep the key in your backend's environment only. Because the key grants access to every
id, your backend must verify the logged-in user owns the id before proxying a request.
Never ship the key to browser/mobile code.

## Endpoints

| Operation | Request | Success response |
| --- | --- | --- |
| Create | `POST /db_query_dynamic/{project_name}` with `{"id": "<string>"}` | `201 {"message": "Project created successfully", "project_id": "<id>"}` |
| Read | `GET /db_query_dynamic/{project_name}/{id}` | `200 {"id": "<id>", "mjson": <object>}` |
| Update | `PUT /db_query_dynamic/{project_name}/{id}` with **any JSON object** as the body | `200 {"message": "Project updated successfully", "project": {"id": "<id>", "mjson": <object>}}` |
| Delete | `DELETE /db_query_dynamic/{project_name}/{id}` | `200 {"message": "Project deleted successfully"}` |

No list or search endpoint exists; you must know the id.

## Error responses

All errors are `{"error": "<message>"}`.

| Status | Cause | Action |
| --- | --- | --- |
| 400 | Unknown `project_name`; create missing `id`; `PUT` body is not a JSON object (array, string, number) | Fix the request |
| 401 | Missing or wrong API key | Check key / header |
| 404 | `id` does not exist | Create it first |
| 500 | Duplicate `id` on create, `GET` on a never-written row, malformed JSON body, or other server error | See procedure below |

## Procedure

1. **Create** the row with the id (e.g. the `user_id`). Do this once per user/table. A
   second create with the same id fails with `500`, so check by attempting `GET` first or
   keep a "created" flag.
2. **Immediately `PUT` an initial document** (e.g. `{}`) before any `GET`. A newly created
   row has no document yet, and `GET` on it returns `500`.
3. **Read** with `GET`; the document is under `mjson`.
4. **Update** with `PUT`, sending the full object as the body (no `{"mjson": ...}`
   wrapper). `PUT` **replaces the whole document**; there is no merge.
5. **Delete** with `DELETE` to remove the user's data.

### Get-or-create pattern

```
r = GET /db_query_dynamic/user_media/{user_id}
if r.status == 404:
    POST /db_query_dynamic/user_media        {"id": user_id}
    PUT  /db_query_dynamic/user_media/{user_id}   {}
    doc = {}
elif r.status == 200:
    doc = r.mjson
```

### Read-modify-write

```
doc = GET(...).mjson
doc["watchlist"].append({"title": "Dune"})
PUT /db_query_dynamic/user_media/{user_id}   doc
```

There is no locking; concurrent writers to the same id overwrite each other (last write
wins). Serialize writes per user in your backend if that matters.

## Example

```bash
UID=80bdb4ea-70c3-478a-99c9-7e0d1a1719f0

curl -X POST "$URL/db_query_dynamic/user_media" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d "{\"id\":\"$UID\"}"

curl -X PUT "$URL/db_query_dynamic/user_media/$UID" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"watchlist":[{"title":"Dune","status":"planned"}]}'

curl "$URL/db_query_dynamic/user_media/$UID" -H "Authorization: Bearer $KEY"
# {"id":"<uid>","mjson":{"watchlist":[{"title":"Dune","status":"planned"}]}}
```

## Verification checklist

- [ ] `POST` returns `201` and echoes the id.
- [ ] `GET` before the first `PUT` is NOT relied on (it returns `500`); your code always
      writes `{}` after create.
- [ ] `PUT` with an object, then `GET`, round-trips the same object under `mjson`.
- [ ] `PUT` with an array returns `400`.
- [ ] `DELETE` then `GET` returns `404`.
- [ ] Requests without the key return `401`.
- [ ] Your backend checks the caller owns the id before calling Backbone.
