---
name: schedule-week
description: Plan and schedule a week of social media content with Ampost. Drafts several posts from the user's themes or notes, sets up or uses the platform set's weekly posting queue (queue_get, queue_update, queue_slots), checks each post with posts_validate, then fills the queue with posts_create useQueue. Use when the user asks to schedule a week (or several days) of posts, fill their content calendar or queue, or batch-plan social content.
license: MIT
compatibility: Needs the Ampost MCP server (https://api.ampost.io/mcp) connected in the agent. Scheduling and queues need a paid Ampost plan.
metadata:
  author: ampost
  version: "0.1.0"
---

# Schedule a week of content into the queue

Each Ampost platform set has one weekly queue: slots (weekday and HH:MM) in an IANA time zone.
`posts_create` with `useQueue: true` puts a post into the set's next free slot. This skill drafts the
week's posts and queues them.

## Before you start

- You need the Ampost MCP tools (`platform_sets_list`, `queue_get`, `queue_update`, `queue_slots`,
  `platforms_list`, `posts_validate`, `posts_create`). Some clients prefix them, e.g.
  `mcp__plugin_ampost_ampost__queue_get`; match on the end of the name. If they are missing, point
  the user to https://ampost.io/docs/mcp/install?ref=github.
- Take every limit from `platforms_list`, never from memory.
- An Ampost error is `{ "error": { "code", "message", "details" } }`. Show `message` as it is.
  `UPGRADE_REQUIRED` means the plan has no scheduling or queues; say so and offer drafts instead.

## Steps

1. **Collect the plan.** Themes, notes or links for the week, how many posts, which platforms, and
   the tone. Ask only for what is missing.
2. **Pick the platform set.** Call `platform_sets_list`. With one set, use it. With several, ask which.
   A queued post goes to one set (`useQueue` needs exactly one target).
3. **Check the queue.** Call `queue_get` with the set's `platformSetId`.
   - No `slots`: propose slots that fit the plan (for example weekdays at 09:00) in the user's time
     zone, confirm them, and save them with `queue_update` (`timezone`, `slots`). `slots` replaces the
     whole list, so include the existing slots you keep.
   - Then call `queue_slots` with `filter: "free"` and `count` set to the number of posts, and show
     the user the dates the posts will take. Add slots if there are too few in the week.
4. **Check what is already planned.** `posts_list` with `status: "scheduled"` and the set's
   `platformSetId` shows posts already queued, so you do not repeat a topic.
5. **Read the rules.** Call `platforms_list` and note, per platform, `availability` (leave out
   `coming_soon`), `text.maxLength`, `media.required`, `link.supported` and required options in the
   `options` JSON Schema.
6. **Draft the posts** in the order they should go out. One post per slot, with per-platform text in
   `options.<platform>.text` where `text` is too long. Show them as a numbered list with the slot
   time each will take, and let the user edit or reorder them.
7. **Validate each post** with `posts_validate` and `useQueue: true`. Fix and validate again until every
   post is `valid`. Each check shows the next free slot as it is now, so all of them show the same
   slot until the posts are created.
8. **Create them in order.** Call `posts_create` with `useQueue: true` and a new UUID as
   `idempotencyKey` for each post, one after another, so each takes the next free slot. Reuse a key
   only to retry a call that timed out.
9. **Report** a table: date and time (`scheduledFor`, shown in the queue's time zone), platforms and the
   first line of each post. Rescheduling or deleting a queued post (`posts_update`, `posts_delete`)
   frees its slot.

## Example

One queued post for a set. `posts_validate` arguments:

```json
{
  "targets": [{ "platformSetId": "3f2b8c1e-7a4d-4e5f-9b6a-1c2d3e4f5a6b", "platforms": ["threads", "bluesky", "facebook"] }],
  "text": "Monday tip: batch your content on one day and let the queue publish it all week.",
  "useQueue": true
}
```

## Edge cases

- **Exact times instead of the queue**: set `scheduledFor` (ISO 8601 with the user's offset, in the
  future) and leave out `useQueue`. Several targets are allowed then.
- **Several platform sets**: each set has its own queue; queue the posts per set.
- **A post must go out at a fixed time** (a launch): give it `scheduledFor`. It does not take a slot.
