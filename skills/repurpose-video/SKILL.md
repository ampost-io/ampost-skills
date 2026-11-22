---
name: repurpose-video
description: Repurpose one short vertical video for TikTok, Instagram Reels and YouTube Shorts (and optionally Facebook Reels, Threads, Bluesky, X or Pinterest) with Ampost. Checks the video against each platform's video rules from platforms_list, writes a caption, title and hashtags per platform, asks for the options each platform requires (YouTube madeForKids, TikTok privacy level and consent), validates, then publishes or schedules. Use when the user has a video, clip or reel and wants it on TikTok, Reels and Shorts or other short-video platforms.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent, and the video as a public https URL or a file the user can upload.
metadata:
  author: ampost
  version: "0.1.0"
---

# Repurpose a video for TikTok, Reels and Shorts

Post one video to several short-video platforms, each with its own caption and settings.

## Before you start

- You need the Ampost MCP tools (`platforms_list`, `accounts_list`, `media_upload_create`,
  `media_upload_status`, `posts_validate`, `posts_create`, `posts_get`). Some clients prefix them,
  e.g. `mcp__plugin_ampost_ampost__posts_create`; match on the end of the name. If they are missing,
  point the user to https://ampost.io/docs/mcp/install?ref=github.
- Take every limit from `platforms_list`, never from memory.
- An Ampost error is `{ "error": { "code", "message", "details" } }`. Show `message` as it is.
- Publishing is public. Get the user's go-ahead on the final preview before `posts_create`.

## How each platform takes the video

- **Instagram Reels**: a single video goes to `options.instagram.placement` `reel` (the default for
  one video). `shareToFeed` (default true) also shows it in the feed grid; `coverUrl` or `thumbOffset`
  sets the cover.
- **YouTube Shorts**: Ampost has no Shorts setting. YouTube picks the format from the file: a vertical
  or square video up to 3 minutes becomes a Short, a horizontal one a regular video.
  `options.youtube.title` is the title, the text is the description, and
  `options.youtube.madeForKids` (true or false) is required: ask the user.
- **TikTok**: often `availability: coming_soon` in `platforms_list`; then posting answers 403
  `PLATFORM_COMING_SOON`. Leave it out and tell the user. Where it is open, `options.tiktok.privacyLevel`
  is required and must be one of the TikTok account's `platformMetadata.privacyLevelOptions`, chosen
  by the user. Show "By posting, you agree to TikTok's Music Usage Confirmation" and set
  `consent: true` only after the user agrees. Comments, Duet and Stitch stay off unless the user turns
  them on (`disableComment`, `disableDuet`, `disableStitch` set to false).
- **Facebook**: `options.facebook.placement` `reel` for a Facebook Reel.

## Steps

1. **Get the video.** A public https URL goes straight into `media` as `{ "url", "type": "video" }`.
   A file on the user's device: call `media_upload_create`, give the user `uploadPageUrl` (or PUT the
   file to `uploadUrl`), poll `media_upload_status` every 3-5 seconds until `completed`, and use its
   `files` unchanged. They carry `durationSeconds`, `width` and `height`.
2. **Pick the accounts.** `accounts_list`; keep the accounts on the chosen platforms whose
   `health.canPost` is true.
3. **Check the video against the rules.** Call `platforms_list`. For each platform compare the video
   with `media.types` (YouTube and the others must take `video`), `media.maxVideoSizeBytes`,
   `media.maxVideoDurationSeconds` and the video entries in `media.conversion` (aspect ratio, minimum
   and maximum duration). Ampost converts format, size and frame rate itself, but it does not trim or
   loop a video: one outside a duration limit is refused. Tell the user which platforms the video does
   not fit.
4. **Fit the frame.** For a video that is not 9:16, ask how to fit it where a platform needs 9:16:
   `mediaFit` `pad` (bars, the default), `crop` (fill from the centre) or `none` (as uploaded).
5. **Write per-platform text**: a caption with hashtags for TikTok and Instagram in
   `options.<platform>.text`, and a title plus description for YouTube. Stay within each
   `text.maxLength`.
6. **Validate** with `posts_validate`. Show the errors per platform and fix them. Show
   `targets[].mediaConversion`, so the user sees what Ampost will change on each platform.
7. **Confirm and create.** Show the preview, then call `posts_create` with a new UUID as
   `idempotencyKey`, and `publishNow: true`, `scheduledFor` or neither (a draft).
8. **Follow up.** Video posts stay `processing` while the platform processes them. Check with
   `posts_get` after a minute or two and report each `publishedUrl`.

## Example

One vertical video as a Reel and a Short. `posts_validate` arguments:

```json
{
  "targets": [{ "platforms": ["instagram", "youtube"] }],
  "text": "Three keyboard shortcuts that save me an hour a week #productivity #shortcuts",
  "media": [{ "url": "https://example.com/clips/shortcuts.mp4", "type": "video" }],
  "mediaFit": "pad",
  "options": {
    "instagram": { "placement": "reel", "shareToFeed": true },
    "youtube": { "title": "3 keyboard shortcuts that save an hour a week", "madeForKids": false, "privacyStatus": "public" }
  },
  "publishNow": true
}
```

## Edge cases

- **Long horizontal video**: cut a vertical clip first (outside Ampost), or post it to YouTube as a
  regular video.
- **YouTube quota**: uploads share one Google quota; when it runs out the account waits with
  `RATE_LIMITED` until midnight Pacific Time. Ampost retries on its own.
- **TikTok inbox draft**: `options.tiktok.inboxDraft: true` sends the video to the creator's TikTok
  inbox to finish in the app, with no privacy or consent needed. A video draft has no caption.
