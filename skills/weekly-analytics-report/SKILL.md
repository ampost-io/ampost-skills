---
name: weekly-analytics-report
description: Write a weekly social media analytics report from Ampost data. Compares the last 7 days with the 7 days before (views, reach, likes, comments, shares, saves, followers per account and in total from analytics_overview and analytics_followers), lists the top posts from analytics_posts, and says which accounts have no data and why. Use when the user asks how their social media did this week, for a weekly or monthly report, their best posts, follower growth or engagement numbers.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent, with analytics read access.
metadata:
  author: ampost
  version: "0.1.0"
---

# Weekly analytics report

A short report on the last 7 days against the 7 days before, from the numbers Ampost stores. Report
only numbers the tools return; never estimate a missing one.

## Before you start

- You need the Ampost MCP tools (`analytics_overview`, `analytics_followers`, `analytics_posts`).
  Some clients prefix them, e.g. `mcp__plugin_ampost_ampost__analytics_overview`; match on the end
  of the name. If they are missing, point the user to https://ampost.io/docs/mcp/install?ref=github.
  `INSUFFICIENT_SCOPE` means the sign-in or key lacks `analytics:read`.
- What has analytics: Facebook Pages, Instagram, Threads, TikTok, Bluesky, YouTube and Pinterest
  accounts (YouTube and Pinterest only for posts published through Ampost), X accounts that opted in
  (`accounts_set_analytics`), and Telegram followers. Discord has none. 403 `ANALYTICS_NOT_ENABLED`
  means none of the matching accounts has analytics; `details.accounts` says why per account.
- Numbers are as fresh as `syncedAt`: Ampost reads them in the background, and Meta can lag a day or
  two. Say so when the latest days look low.

## Steps

1. **Pick the dates.** Days are UTC dates (`YYYY-MM-DD`), both ends included. This week: `to` = today,
   `from` = today minus 6 days. Last week: the 7 days before that. Use other ranges if the user asks
   (a month, a campaign). Narrow to one `platform`, `platformSetId` or `accountId` if asked.
2. **Totals.** Call `analytics_overview` for this week and again for last week. Per account and in
   `totals`: `posts`, the `metrics` sums (views, reach, likes, comments, shares, saves) and followers
   with their change. The sums are each post's lifetime totals for posts published in the range;
   `posts` also counts posts made outside Ampost.
   Keep `unavailableAccounts` with their reasons.
3. **Followers.** Call `analytics_followers` for this week for the daily follower counts per account.
   A missing day means Ampost has no snapshot for it; do not fill it in.
4. **Top posts.** Call `analytics_posts` (newest first; page with `limit` and `offset` back to the start
   of the week, using each post's `publishedAt`). Rank this week's posts by views, or by
   engagement = likes + comments + shares + saves where views are null. Take the top 3-5. Skip entries
   whose `analyticsStatus` says there are no metrics.
5. **Write the report**:
   - a one-line summary: the main change against last week;
   - a table per account: posts, views, reach, engagement, followers and their change, with the
     difference from last week in % (write "n/a" when last week was 0 or null);
   - the top posts with platform, first line of text, views, engagement and `publishedUrl`;
   - accounts without data and why (`unavailableAccounts`), and accounts whose `syncState` is
     `reconnect_required` (offer the `reconnect-accounts` skill);
   - one to three observations backed by the numbers (for example the platform or format that did
     best). No advice the data does not support.
6. Offer to save the report as a Markdown file if the agent can write files.

## Example

This week's totals for one platform set. `analytics_overview` arguments:

```json
{ "from": "2026-11-16", "to": "2026-11-22", "platformSetId": "3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b" }
```

## Edge cases

- **Null metrics**: platforms do not report every metric (`null`). Show "n/a" and leave it out of
  sums, rather than counting it as 0.
- **No posts this week**: report the follower change and say there were no posts.
- **X**: analytics read X units from the plan. Turning them on is `accounts_set_analytics`; ask
  before you do.
