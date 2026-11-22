# Ampost skills

Post, schedule, repurpose and report on social media from your AI agent.
[Ampost](https://ampost.io?ref=github) publishes to Instagram, Facebook, Threads, X, YouTube,
Pinterest, Bluesky, Telegram and Discord (LinkedIn and TikTok are coming soon) through one API and
one MCP server.

This repo is a **Claude Code plugin marketplace**. Its plugin `ampost` adds the hosted Ampost MCP
server and seven skills. The skills are plain [Agent Skills](https://agentskills.io), so they work in
Codex, Cursor, VS Code, Gemini CLI, OpenCode, Windsurf and other agents too.

## Install in Claude Code

```bash
claude plugin marketplace add ampost-io/ampost-skills && claude plugin install ampost@ampost-skills
```

Or inside a session: `/plugin marketplace add ampost-io/ampost-skills`, then
`/plugin install ampost@ampost-skills`.

Then sign in: start a new session, run `/mcp`, pick `plugin:ampost:ampost` and sign in with your
Ampost account in the browser. Choose what Claude may do (all, read only, or custom) and click Allow.
You need an [Ampost account](https://ampost.io/register?ref=github); the Free plan works, and
scheduling and queues need a paid plan ([pricing](https://ampost.io/pricing?ref=github)).

Check it: ask Claude to "list my Ampost platforms". It calls `platforms_list` and answers with each
platform's rules.

### With an API key instead of signing in

For CI, headless runs (`claude -p`) or a shared machine, use an
[API key](https://ampost.io/app/settings/api-keys?ref=github):

1. In `/mcp`, select `plugin:ampost:ampost` and disable it. The skills stay installed.
2. Add the server with your key:

   ```bash
   claude mcp add --transport http --scope user ampost https://api.ampost.io/mcp --header "Authorization: Bearer amp_live_YOUR_KEY"
   ```

The skills call the tools by name, so they work with either server. The plugin's server sends no
key: a key in a plugin config would be shared with everyone who installs it, and a static
`Authorization` header turns off the OAuth sign-in.

## Skills

In Claude Code, a skill runs on its own when your request matches it, or as a command, such as
`/ampost:post-everywhere`.

| Skill | What it does | Try |
| --- | --- | --- |
| [`post-everywhere`](skills/post-everywhere/SKILL.md) | Posts one message to all your connected accounts. Reads each platform's rules, writes shorter text where needed, checks the post with `posts_validate`, then publishes, schedules or saves a draft | "Post this to all my platforms: ..." |
| [`blog-to-posts`](skills/blog-to-posts/SKILL.md) | Turns a blog post or URL into a post per platform, with threads on X, Bluesky and Threads | "Write social posts for https://example.com/blog/launch" |
| [`schedule-week`](skills/schedule-week/SKILL.md) | Drafts a week of posts, sets up the posting queue if needed, and fills it | "Schedule next week's posts about our new pricing" |
| [`repurpose-video`](skills/repurpose-video/SKILL.md) | Posts one vertical video to Instagram Reels, YouTube Shorts and TikTok, with a caption, title and settings per platform | "Post this clip as a Reel and a Short" |
| [`weekly-analytics-report`](skills/weekly-analytics-report/SKILL.md) | Compares this week with last week: views, reach, engagement and followers per account, and the top posts | "How did my social media do this week?" |
| [`reconnect-accounts`](skills/reconnect-accounts/SKILL.md) | Finds accounts that cannot publish (expired logins, missing permissions, no Pinterest board), reconnects them through an Ampost link, and retries the posts they failed | "Fix my broken accounts" |
| [`csv-bulk-import`](skills/csv-bulk-import/SKILL.md) | Imports posts from a CSV or spreadsheet: maps the columns, runs a dry run, fixes the rows with errors, then imports | "Import posts.csv into Ampost" |

Every skill takes limits from `platforms_list` instead of assuming them, checks posts with
`posts_validate` before `posts_create`, asks before it publishes, and sends an idempotency key, so a
retried call never posts twice.

## Other agents

The skills use only the Agent Skills fields (`name`, `description`, `license`, `compatibility`,
`metadata`), so every client that reads `SKILL.md` loads them unchanged. Two steps:

1. **Connect the MCP server** `https://api.ampost.io/mcp` in your agent:
   [install guide for each client](https://ampost.io/docs/mcp/install?ref=github).
2. **Add the skills**, with the [`skills`](https://github.com/vercel-labs/skills) CLI:

   ```bash
   npx skills add ampost-io/ampost-skills
   ```

   or copy the folders in `skills/` to your agent's skills folder:

   | Agent | Project folder | User folder |
   | --- | --- | --- |
   | Codex (CLI, IDE, app) | `.agents/skills/` | `~/.agents/skills/` |
   | Cursor | `.agents/skills/` or `.cursor/skills/` | `~/.agents/skills/` or `~/.cursor/skills/` |
   | VS Code (GitHub Copilot) | `.agents/skills/` or `.github/skills/` | `~/.agents/skills/` |
   | Gemini CLI | `.agents/skills/` or `.gemini/skills/` | `~/.agents/skills/` or `~/.gemini/skills/` |
   | OpenCode | `.agents/skills/` or `.opencode/skills/` | `~/.agents/skills/` |
   | Windsurf | `.agents/skills/` or `.windsurf/skills/` | `~/.agents/skills/` |

   Claude Code without the plugin: copy them to `.claude/skills/` or `~/.claude/skills/`.

Claude chat (claude.ai and the apps) takes skills as uploads: zip one skill folder and add it under
Settings, Capabilities, Skills, with Ampost added as a
[custom connector](https://ampost.io/docs/mcp/install?ref=github).

## What's in the repo

```text
.claude-plugin/marketplace.json   the marketplace: one plugin, ampost, at the repo root
.claude-plugin/plugin.json        the plugin manifest
.mcp.json                         the hosted MCP server, OAuth sign-in
skills/<name>/SKILL.md            the seven skills
test/                             offline checks; mcp-tools.json lists the server's tools
```

## Develop

```bash
npm test                 # spec, tool names and example arguments, manifests, links
claude plugin validate --strict .
claude --plugin-dir .    # try the plugin without installing it
```

`test/mcp-tools.json` is exported from the Ampost server code. A skill that names a tool or an
argument the server does not have fails the tests.

## Links

- [Ampost](https://ampost.io?ref=github)
- [MCP server docs](https://ampost.io/docs/mcp?ref=github)
- [API docs](https://ampost.io/docs?ref=github)
- [Privacy](https://ampost.io/privacy?ref=github) and [terms](https://ampost.io/tos?ref=github)

## License

MIT
