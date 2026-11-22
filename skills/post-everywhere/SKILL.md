---
name: post-everywhere
description: Post one message (text, link, images or video) to all of the user's connected social accounts with Ampost, adapted to each platform's rules, checked with posts_validate, then published, scheduled or saved as a draft. Use when the user asks to post, cross-post, share or announce something on all their platforms or on several of Instagram, Facebook, Threads, X, YouTube, Pinterest, Bluesky, Telegram, Discord, LinkedIn or TikTok.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent, signed in with an Ampost account or an Ampost API key.
metadata:
  author: ampost
  version: "0.1.0"
---

# Post to all my platforms

Publish one post to every connected account (or the ones the user picks), with text that fits each
platform. Check the post with `posts_validate` before `posts_create`.

## Before you start

- You need the Ampost MCP tools (`platforms_list`, `accounts_list`, `posts_validate`, `posts_create`, ...).
  Some clients prefix them, e.g. `mcp__plugin_ampost_ampost__posts_create`; match on the end of
  the name. If no Ampost tools are available, stop and point the user to
  https://ampost.io/docs/mcp/install?ref=github to connect `https://api.ampost.io/mcp`.
- Never assume platform limits from memory. Every limit and option below comes from `platforms_list`.
- An Ampost error is `{ "error": { "code", "message", "details" } }`. Show `message` to the user as
  it is. `INSUFFICIENT_SCOPE` means the sign-in or key lacks the access in `details.requiredScope`;
  `UPGRADE_REQUIRED` means the user's plan lacks the feature. Neither is fixed by retrying.
- Publishing is visible to the public. Get the user's explicit go-ahead on the final preview before
  `posts_create`, unless they already said to post without asking.

## Steps

1. **Collect the post.** Text, an optional link, media (public https URLs or files on the user's
   device), and when: now, at a time, into the queue, or as a draft. Ask only for what is missing.
2. **Find the accounts.** Call `accounts_list` (status `active` is the default). Each platform set
   holds one account per platform. If the user has more than one set (`platform_sets_list`), ask which
   ones to post to; without a `platformSetId` a target means the default set. Leave out accounts whose
   `health.canPost` is false, tell the user why (`health.issues[].message`), and offer the
   `reconnect-accounts` skill.
3. **Read the rules.** Call `platforms_list` once. For each platform the post goes to, note:
   - `availability`: `coming_soon` platforms answer 403 `PLATFORM_COMING_SOON` for most accounts.
     Leave them out and say so.
   - `text.maxLength`, `link.supported`, `firstComment`, `thread`;
   - `media`: `required`, `types`, `maxItems`, `mixedTypes`, size and duration limits, and
     `placements` for the media shape;
   - `options`: the JSON Schema of `options.<platform>`, with the options a platform requires. Ask the user for required values; never pick
     them for the user. YouTube needs `options.youtube.madeForKids`. TikTok needs
     `options.tiktok.privacyLevel` (one of the account's `platformMetadata.privacyLevelOptions`)
     and `consent: true`, set only after the user agrees to TikTok's Music Usage Confirmation.
4. **Adapt the text.** Keep `text` for the platforms it fits. Where it is longer than `text.maxLength`,
   write a shorter version in `options.<platform>.text`. Rewrite it, do not cut it mid-sentence. Drop
   platforms where `media.required` is true and the post has no media, and tell the user.
5. **Media from the user's device.** Call `media_upload_create`, give the user `uploadPageUrl` (or
   PUT the file to `uploadUrl` if you have it), then poll `media_upload_status` every 3-5 seconds until
   `completed`. Put its `files` into `media` unchanged.
6. **Validate.** Call `posts_validate` with the same arguments `posts_create` will get. Show each
   error in `errors` and `targets[].errors` with its platform and message. Fix what you can (text
   length, media count, options) and validate again. Show `warnings` and `mediaConversion` (what
   Ampost will convert), but they do not block the post.
7. **Confirm.** Show a short preview per platform: account, text, media, and when it publishes
   (`scheduledFor` in the validation result).
8. **Create.** Call `posts_create` with a new UUID as `idempotencyKey`. If the call times out, retry
   with the same key so the post is not created twice. Use `publishNow: true` to publish now,
   `scheduledFor` (ISO 8601 with a time zone offset) for later, `useQueue: true` for the next free
   queue slot (one target only), or none of them for a draft.
9. **Report.** For each `platformPosts` entry give the platform, the status and `publishedUrl`.
   `processing` means the platform is still processing a video; check again with `posts_get` in a
   minute. For `failed`, show `error.message`. Ampost retries retryable failures on its own
   (`pending` with `nextAttemptAt`); after the user fixes the cause, `posts_retry` publishes the
   failed accounts again.

## Example

A text post with one image to the default set, published now. `posts_validate` arguments:

```json
{
  "targets": [{ "platforms": ["threads", "bluesky", "instagram", "facebook"] }],
  "text": "We just shipped dark mode. Try it today: https://example.com/changelog",
  "media": [{ "url": "https://example.com/dark-mode.png", "type": "image", "altText": "The app in dark mode" }],
  "options": {
    "bluesky": { "text": "Dark mode is here. Try it today: https://example.com/changelog" }
  },
  "publishNow": true
}
```

Then call `posts_create` with the same arguments plus `idempotencyKey`.

## Edge cases

- **Two accounts on one platform** (two Instagram brands): they are in different platform sets. Add
  one target per set; each target lists its own platforms.
- **Links**: `linkUrl` is ignored where `link.supported` is false. A URL in the text stays text.
- **Pinterest**: a Pin goes to the account's default board. Without one the post fails: list boards
  with `accounts_list_boards`, ask the user, and save the choice with `accounts_set_board`.
- **Alt text**: the result warns `ALT_TEXT_NOT_SENT` where the platform leaves it out.
- **First comment or thread**: only where `firstComment.supported` or `thread.supported` is true, not
  both on one platform. Set them per platform with `options.<platform>.firstComment` or `.thread`.
