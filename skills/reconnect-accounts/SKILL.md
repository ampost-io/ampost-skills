---
name: reconnect-accounts
description: Find social accounts in Ampost that cannot publish or will stop soon (expired or expiring tokens, missing permissions, revoked access, no Pinterest board) from accounts_list health, and fix them, by reconnecting through an Ampost-hosted link (accounts_connect and accounts_connect_status) or by the fix each issue names, then retry posts that failed because of them. Use when a post failed with an account or token error, an account shows as disconnected or expired, or the user asks to check or fix their connected accounts.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent, with account access, and a browser where the user can sign in to the social platform.
metadata:
  author: ampost
  version: "0.1.0"
---

# Reconnect broken accounts

Check every connected account's health, reconnect the ones that need it, and publish again the posts
they failed.

## Before you start

- You need the Ampost MCP tools (`accounts_list`, `accounts_connect`, `accounts_connect_status`,
  `posts_list`, `posts_retry`). Some clients prefix them, e.g.
  `mcp__plugin_ampost_ampost__accounts_list`; match on the end of the name. If they are missing,
  point the user to https://ampost.io/docs/mcp/install?ref=github. `INSUFFICIENT_SCOPE` means the
  sign-in or key lacks `accounts:write`.
- **Never ask the user for a password, access token or authorization code.** The user signs in to the
  platform on Ampost's page in their browser; consent cannot happen in chat.
- An Ampost error is `{ "error": { "code", "message", "details" } }`. Show `message` as it is.

## Steps

1. **Check health.** Call `accounts_list` with `status: "all"`. For each account read `status` and
   `health`: `canPost`, `needsReconnect` and `issues[]` (`code`, `severity`, `message`).
2. **Sort the accounts** and show the user a table: platform, username, problem
   (`issues[].message`), fix.
   - `needsReconnect: true` (`TOKEN_EXPIRED`, `MISSING_SCOPE:<scope>`, `REFRESH_TOKEN_EXPIRING`,
     `TOKEN_EXPIRING`, ...): reconnect.
   - `status: "revoked"`: disconnected on purpose or by the platform. Ask before reconnecting.
   - `BOARD_NOT_SELECTED` (Pinterest): no reconnect. List boards with `accounts_list_boards`, ask
     which one, and save it with `accounts_set_board`.
   - `ACCOUNT_LIMIT_REACHED`: no reconnect helps. The plan's account limit is reached: disconnect
     another account or upgrade.
   - `PLATFORM_COMING_SOON`: no reconnect helps until the platform opens for the user.
   - Healthy accounts: say they are fine.
3. **Reconnect one account at a time.** Call `accounts_connect` with the account's id as `accountId`
   (the platform is then optional) and a new UUID as `idempotencyKey`. The account keeps its id, so
   scheduled posts keep pointing at it.
   - If the result has `connectUrl`, show it and ask the user to open it and authorize. If your
     client opened the page itself, the result has no `connectUrl`: ask the user to finish on that page.
   - Ask the user to sign in to the same account as before. Another account fails with
     `ACCOUNT_MISMATCH` and changes nothing.
4. **Wait for the result.** Call `accounts_connect_status` with the request's id every 2-5 seconds until
   the status is `connected`, `failed` or `expired`. On `failed` or `expired`, show `error.message` as
   it is. `SUPERSEDED` means a newer request replaced this one; follow the newer one. `USER_CANCELLED`
   means the user declined; ask if they want to try again. For a lost or closed page, call
   `accounts_connect` again.
5. **Check again.** `accounts_get` with the account's id: `health.canPost` should be true now.
6. **Publish what failed.** `posts_list` with `status: "failed"` and then `status: "partial"` lists
   posts some accounts did not publish. For each post with a `platformPosts` entry of the reconnected
   account in `failed`, offer `posts_retry` with that `accountIds` entry and a new `idempotencyKey`.
   Retry only after the user agrees, since it publishes. Report each account's new status.

## Example

Reconnect one account. `accounts_connect` arguments:

```json
{ "accountId": "9d8c7b6a-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "idempotencyKey": "8f14e45f-ceea-467f-a0e6-3b1c2d9a7e10" }
```

## Edge cases

- **Free plan, account used by another workspace**: `SOCIAL_ACCOUNT_IN_USE`. A paid plan can connect it.
- **Instagram and Threads** have no revoke endpoint. After a disconnect the user removes Ampost in the
  platform's own settings (`providerAccessSettings` in the `accounts_disconnect` result).
- **A new account** (not a reconnect): `accounts_connect` with `platform` and, to make sure the user
  signs in to the right one, `expectedUsername`.
