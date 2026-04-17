# claw.cleaning — OpenClaw plugin

OpenClaw plugin that bundles the `apartment-cleaning` skill with a registration for the remote MCP server at `https://claw.cleaning/mcp`.

- Zero local binary — the plugin talks to the hosted MCP server.
- The `apartment-cleaning` skill (same one distributed standalone in `../skill/`) lives under `skills/apartment-cleaning/`.

## Install

```
clawhub package publish ./plugin --dry-run
clawhub package publish ./plugin
```

Users then enable it via their OpenClaw plugins UI (or `openclaw plugins install claw-cleaning` once it's on the registry).

## Layout

This directory carries manifests for **both** OpenClaw and Claude Code plugin ecosystems. They share the same skill and MCP server URL, so they coexist peacefully.

```
plugin/
├── openclaw.plugin.json     # OpenClaw manifest (id, skills, configSchema)
├── package.json             # openclaw.extensions -> ./index.js
├── index.js                 # OpenClaw definePluginEntry — registers the remote MCP server
├── .claude-plugin/
│   └── plugin.json          # Claude Code plugin manifest
├── .mcp.json                # Claude Code MCP connector registration
├── skills/
│   └── apartment-cleaning/  # mirror of /skill/apartment-cleaning/
│       ├── SKILL.md
│       └── references/booking-flow.md
└── README.md
```

## Config

| field       | default                         | notes                                      |
|-------------|---------------------------------|--------------------------------------------|
| `serverUrl` | `https://claw.cleaning/mcp`     | Override only for staging / self-hosting.  |

## TODO before first publish

The `api.registerMcpServer(...)` call in `index.js` matches OpenClaw's naming conventions but hasn't been confirmed against the live plugin SDK types (docs at https://docs.openclaw.ai/plugins/manifest and https://docs.openclaw.ai/plugins/building-plugins). Before running `clawhub package publish`, pull the SDK and confirm the exact registration method name / shape. The rest of the plugin (manifest, skill, entry-point wiring) follows the documented schema.

## Relationship to `/skill/` and `/worker/`

- `worker/` — the hosted MCP server itself at `https://claw.cleaning/mcp`. **Not modified by this plugin.** Both plugin formats just point at the already-running service.
- `skill/apartment-cleaning/` — the standalone skill, distributed via `clawhub skill publish`. Still works on its own.
- `plugin/` — bundles a copy of the skill with the MCP registration, distributed via `clawhub package publish` (OpenClaw) or `/plugin marketplace add GetColby/claw-cleaning` (Claude Code).

The skill inside this plugin is a copy, not a symlink, so the two distribution paths can version independently if needed. Keep them in sync when the skill changes.
