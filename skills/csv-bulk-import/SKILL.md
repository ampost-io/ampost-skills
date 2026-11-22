---
name: csv-bulk-import
description: Bulk-create many social posts in Ampost from a CSV file or spreadsheet with posts_import_csv. Maps the user's columns to Ampost's (text, platforms, scheduledFor or useQueue, media, per-platform text), runs a dry run that checks every row, shows the rows with errors and fixes them, then imports with an idempotency key. Use when the user has a CSV, spreadsheet, content calendar export or list of posts to upload, schedule or import in bulk.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent, and the CSV as a file the agent can read or text the user pastes.
metadata:
  author: ampost
  version: "0.1.0"
---

# CSV bulk import

Create one post per CSV row. Always run a dry run first: it checks every row like `posts_create` and
creates nothing.

## Before you start

- You need the Ampost MCP tools (`posts_import_csv`, `platforms_list`, `platform_sets_list`). Some
  clients prefix them, e.g. `mcp__plugin_ampost_ampost__posts_import_csv`; match on the end of the
  name. If they are missing, point the user to https://ampost.io/docs/mcp/install?ref=github.
- Read the row limit per plan and the hourly import limit from the `posts_import_csv` tool
  description; do not assume them. A dry run and an import each use one token per row of the hourly
  limit. A file with more rows than are left fails with 429 `RATE_LIMITED` and creates nothing.
- An Ampost error is `{ "error": { "code", "message", "details" } }`. Show `message` as it is.

## Columns

Header row first, then one post per row (UTF-8):

| Column | Meaning |
| --- | --- |
| `text` | Post text |
| `platforms` | Space-separated platforms, e.g. `threads bluesky`; with an optional `platformSetId` (default: the default set) |
| `accountIds` | Instead of `platforms`: space-separated account ids |
| `scheduledFor` | ISO 8601 time with an offset, e.g. `2026-11-24T09:00:00+01:00` |
| `useQueue` | `true` for the next free queue slot. Neither column: a draft |
| `linkUrl`, `firstComment` | As in `posts_create` |
| `media` | Space-separated public https URLs; `.mp4`, `.m4v`, `.mov`, `.webm` are videos, the rest images |
| `altText` | One alt text per `media` URL, in order, separated by `\|` |
| `text_<platform>` | Text for one platform, e.g. `text_threads` |
| `tiktok_<option>` | TikTok options, e.g. `tiktok_privacyLevel`, `tiktok_consent` |

Unknown columns are skipped with a warning. A CSV exported from the Ampost dashboard imports as it is.

## Steps

1. **Get the file.** Read the CSV the user names, or build one from their spreadsheet or list. Keep the
   user's rows; do not add or reword posts unless asked.
2. **Map the columns.** Rename the user's headers to the columns above (for example `Date` to
   `scheduledFor`, `Caption` to `text`). Convert dates to ISO 8601 with the user's time zone offset;
   ask for the time zone if the file has none. Show the mapping before going on.
3. **Check the platforms.** `platforms_list` gives each platform's rules (`availability`,
   `text.maxLength`, `media.required`). Where `text` is too long for one platform, add a
   `text_<platform>` column with a shorter version. With several platform sets, `platform_sets_list`
   gives the ids for `platformSetId`.
4. **Dry run.** Call `posts_import_csv` with `csv` (the whole file as text) and `dryRun: true`. Show
   `summary` and every row with `status: "error"`: row number (the header is row 1), column and
   message. Show `warnings` (skipped columns).
5. **Fix and repeat.** Fix the rows with the user (shorten text, add missing media, correct dates) and
   run the dry run again until no row has errors, or the user decides to leave some rows out. Bad rows
   do not stop the others.
6. **Confirm.** Tell the user how many posts will be created, how many are scheduled, queued or drafts,
   and the first and last publish time.
7. **Import.** Call `posts_import_csv` with `dryRun: false` and a new UUID as `idempotencyKey`. If the
   call times out, retry with the same key and the same file: Ampost returns the first result and
   creates nothing twice.
8. **Report** `summary.created` and each row's `postId` and `scheduledFor`, and list the rows that
   failed with their errors.

## Example

A dry run of a two-row file. `posts_import_csv` arguments:

```json
{
  "csv": "text,platforms,scheduledFor,text_bluesky\n\"New blog post: how we test our API\",threads bluesky facebook,2026-11-24T09:00:00+01:00,\"How we test our API\"\n\"Weekend reading list\",threads facebook,,\n",
  "dryRun": true
}
```

The second row has no `scheduledFor` and no `useQueue`, so it becomes a draft.

## Edge cases

- **Large file**: split it into files under the plan's row limit and import them one after another.
- **TikTok rows** need `tiktok_privacyLevel` and `tiktok_consent` = `true` (after the user agrees to
  TikTok's Music Usage Confirmation) unless `tiktok_inboxDraft` is `true`, and their media must be
  files uploaded to Ampost (`media_upload_create`).
- **Queued rows** need a queue with slots in their platform set (`queue_get`).
