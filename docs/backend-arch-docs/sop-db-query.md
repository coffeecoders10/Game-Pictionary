# SOP: Using the `db_query` API (static JSON documents, integer ids)

## Purpose

Store and retrieve one JSON document per row, in a named table, via HTTP. Use it when
your project needs "save/load a JSON blob by id" and the server assigns the id.

If you need to choose the id yourself (e.g. a user's `user_id`), use
[sop-db-query-dynamic.md](sop-db-query-dynamic.md) instead.

## Prerequisites

| Item | Value |
| --- | --- |
| Base URL | `<BACKBONE_URL>` (local default `http://localhost:5000`) |
| Auth header | `Authorization: Bearer <db_query_api_key>` on **every** request |
| Content type | `Content-Type: application/json` |
| Table name | One of the `{project_name}` values below. Your table must already exist on the server; ask the Backbone owner to add a new one. |

Valid `{project_name}` values: `project`, `inside_dictionary`, `talekar_trip`,
`five_three_two_cards`, `coffeecoders_website`, `pictionary`, `birthday_montage`,
`cc_recipes`, `media_list`.

The API key is a server secret. Keep it in your backend's environment variables. Never put
it in browser/mobile code or commit it. Browser clients should call your own backend,
which calls Backbone.

## Endpoints

| Operation | Request | Success response |
| --- | --- | --- |
| Create | `POST /db_query/{project_name}` with `{"name": "<str>", "description": "<str>"}` | `201 {"message": "Project created successfully", "project_id": <int>}` |
| Read | `GET /db_query/{project_name}/{id}` | `200 {"id": <int>, "pjson": <object>}` |
| Update | `PUT /db_query/{project_name}/{id}` with `{"pjson": <any JSON>}` | `200 {"message": "Project updated successfully", "project": {"id": <int>, "pjson": <object>}}` |
| Delete | `DELETE /db_query/{project_name}/{id}` | `200 {"message": "Project deleted successfully"}` |

There is no list or search endpoint. Store the `project_id` returned by create; you cannot
look it up later.

## Error responses

All errors are `{"error": "<message>"}`.

| Status | Cause | Action |
| --- | --- | --- |
| 400 | Unknown `project_name`, or create missing `name`/`description` | Fix the request; do not retry as-is |
| 401 | Missing or wrong API key | Check the key / header format |
| 404 | `id` does not exist | Treat as "not found" |
| 500 | Server error or malformed JSON body | Check the body is valid JSON; retry once, then report |

## Procedure

1. **Create** a row. Create only accepts `name` and `description`; it stores them as the
   initial document. Save the returned `project_id` in your own storage.
2. **Write your real document** with `PUT`, sending `{"pjson": <your document>}`.
   - `PUT` **replaces the whole document**. Always send the complete object, not a patch.
   - Always include the `pjson` key. Omitting it corrupts the stored value (it gets
     double-encoded and later reads return a string instead of an object).
3. **Read** with `GET`; the document is returned under `pjson`.
4. **Delete** with `DELETE` when no longer needed. Further `GET`s return 404.

### Read-modify-write pattern

```
doc = GET /db_query/{table}/{id}  -> response.pjson
doc.score = 42                     # change what you need
PUT /db_query/{table}/{id}  {"pjson": doc}
```

There is no locking; if two writers update the same row, the last `PUT` wins.

## Example

```bash
curl -X POST "$URL/db_query/project" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"demo","description":"first row"}'
# {"message":"Project created successfully","project_id":1}

curl -X PUT "$URL/db_query/project/1" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"pjson":{"name":"demo","description":"first row","score":42}}'

curl "$URL/db_query/project/1" -H "Authorization: Bearer $KEY"
# {"id":1,"pjson":{"name":"demo","description":"first row","score":42}}
```

## Verification checklist

- [ ] `POST` returns `201` with an integer `project_id`.
- [ ] `PUT` with a nested document, then `GET`, returns the same document as an object.
- [ ] `DELETE` then `GET` returns `404`.
- [ ] A request without the header returns `401`.
- [ ] The API key appears only in server-side config, not in client bundles or git.
