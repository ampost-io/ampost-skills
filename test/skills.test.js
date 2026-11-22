// Checks the skills and manifests without network access:
// - every SKILL.md follows the Agent Skills spec (https://agentskills.io/specification), so the same
//   files load in Claude Code, Codex, Cursor and other clients;
// - every Ampost tool a skill names exists on the MCP server, and every example's arguments are
//   arguments of its tool (test/mcp-tools.json, exported from the server code);
// - the marketplace, plugin and package manifests agree.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const readJson = (path) => JSON.parse(read(path));

const snapshot = readJson("test/mcp-tools.json");
const tools = new Map(snapshot.tools.map((tool) => [tool.name, tool]));
const platforms = Object.keys(snapshot.platformOptions);
const pkg = readJson("package.json");
const plugin = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");

const SPEC_FIELDS = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
const TOOL_PREFIXES = ["accounts", "analytics", "docs", "feedback", "media", "platform_sets", "platforms", "posts", "queue", "webhooks"];
const TOOL_PATTERN = new RegExp(`^(?:mcp__\\w+?__)?((?:${TOOL_PREFIXES.join("|")})_[a-z_]+)$`);

/** The YAML subset the skills use: `key: value` lines and one level of nested string map. */
function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md must start with --- frontmatter");
  const fields = {};
  let parent = null;
  for (const line of match[1].split("\n")) {
    const nested = line.match(/^ {2}([\w-]+):\s*(.*)$/);
    if (nested && parent) {
      fields[parent][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    assert.ok(top, `unexpected frontmatter line: ${line}`);
    if (top[2] === "") {
      parent = top[1];
      fields[parent] = {};
    } else {
      parent = null;
      fields[top[1]] = unquote(top[2]);
    }
  }
  return { fields, body: source.slice(match[0].length) };
}

function unquote(value) {
  return /^".*"$/.test(value) ? JSON.parse(value) : value;
}

/** Each ```json block with the tool named in backticks on the line before it ("`posts_validate` arguments:"). */
function examples(body) {
  const found = [];
  const pattern = /([^\n]*)\n\n?```json\n([\s\S]*?)\n```/g;
  for (const [, intro, json] of body.matchAll(pattern)) {
    const tool = intro.match(/`([a-z_]+)` arguments:\s*$/)?.[1];
    if (tool) found.push({ tool, args: JSON.parse(json) });
  }
  return found;
}

const skillNames = readdirSync(join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

test("the plugin ships the seven skills", () => {
  assert.deepEqual(skillNames, [
    "blog-to-posts",
    "csv-bulk-import",
    "post-everywhere",
    "reconnect-accounts",
    "repurpose-video",
    "schedule-week",
    "weekly-analytics-report",
  ]);
});

for (const name of skillNames) {
  test(`${name}: SKILL.md follows the Agent Skills spec`, () => {
    const source = read(`skills/${name}/SKILL.md`);
    const { fields, body } = parseFrontmatter(source);

    for (const key of Object.keys(fields)) {
      assert.ok(SPEC_FIELDS.includes(key), `${key} is not an Agent Skills field; other clients refuse it`);
    }
    assert.equal(fields.name, name, "name must match the folder");
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(fields.name.length <= 64);
    assert.ok(fields.description.length > 0 && fields.description.length <= 1024, "description: 1-1024 characters");
    assert.ok(!/[<>]/.test(fields.description), "no angle brackets in the description");
    assert.ok(fields.compatibility.length <= 500, "compatibility: at most 500 characters");
    assert.equal(fields.license, pkg.license);
    assert.equal(fields.metadata.version, pkg.version, "metadata.version follows package.json");
    for (const value of Object.values(fields.metadata)) assert.equal(typeof value, "string");

    assert.ok(body.split("\n").length < 500, "keep SKILL.md under 500 lines");
    assert.ok(!/\$ARGUMENTS|\$\{CLAUDE_/.test(body), "Claude Code substitutions do not work in other clients");
  });

  test(`${name}: every tool it names exists on the MCP server`, () => {
    const { body } = parseFrontmatter(read(`skills/${name}/SKILL.md`));
    const named = [...body.matchAll(/`([^`\s]+)`/g)]
      .map(([, code]) => code.match(TOOL_PATTERN)?.[1])
      .filter(Boolean);
    assert.ok(named.length > 0);
    for (const tool of named) assert.ok(tools.has(tool), `${tool} is not an Ampost MCP tool`);
  });

  test(`${name}: its example calls a real tool with real arguments`, () => {
    const { body } = parseFrontmatter(read(`skills/${name}/SKILL.md`));
    const found = examples(body);
    assert.ok(found.length > 0, "each skill has a `<tool>` arguments: example");

    for (const { tool, args } of found) {
      const spec = tools.get(tool);
      assert.ok(spec, `${tool} is not an Ampost MCP tool`);
      for (const key of Object.keys(args)) assert.ok(spec.arguments.includes(key), `${tool} has no argument ${key}`);
      for (const key of spec.required) assert.ok(key in args, `${tool} requires ${key}`);

      const targeted = (args.targets ?? []).flatMap((target) => target.platforms);
      for (const platform of targeted) assert.ok(platforms.includes(platform), `unknown platform ${platform}`);
      for (const [platform, options] of Object.entries(args.options ?? {})) {
        assert.ok(targeted.includes(platform), `options.${platform} needs ${platform} in targets`);
        for (const key of Object.keys(options)) {
          assert.ok(snapshot.platformOptions[platform].includes(key), `options.${platform} has no field ${key}`);
        }
      }
    }
  });
}

test("the marketplace lists the plugin at its root, under the manifest's name", () => {
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, plugin.name, "entry name and plugin.json name must match");
  assert.equal(marketplace.plugins[0].source, "./");
  assert.equal(plugin.version, pkg.version);
  assert.equal(plugin.license, pkg.license);
  assert.ok(existsSync(join(root, plugin.icon)), "plugin.json icon exists");
});

test("the plugin connects the hosted MCP server with OAuth (no key in the config)", () => {
  const { mcpServers } = readJson(".mcp.json");
  assert.deepEqual(Object.keys(mcpServers), ["ampost"]);
  assert.equal(mcpServers.ampost.type, "http");
  assert.equal(mcpServers.ampost.url, snapshot.server);
  assert.equal(mcpServers.ampost.headers, undefined, "a static Authorization header turns off OAuth sign-in");
});

test("links to ampost.io carry ?ref=github", () => {
  const files = ["README.md", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", ...skillNames.map((name) => `skills/${name}/SKILL.md`)];
  for (const file of files) {
    for (const [url] of read(file).matchAll(/https:\/\/ampost\.io[^\s)"'`>]*/g)) {
      assert.match(url, /[?&]ref=github/, `${file}: ${url}`);
    }
  }
});
