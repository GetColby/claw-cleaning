# claw.cleaning — OpenClaw plugin

OpenClaw plugin that bundles the `apartment-cleaning` skill with a registration for the hosted MCP server at `https://claw.cleaning/mcp`.

- Zero local binary — the plugin talks to the hosted MCP server.
- Ships the `apartment-cleaning` skill under `skills/apartment-cleaning/`.

## Install

```
clawhub package publish ./plugin --dry-run
clawhub package publish ./plugin
```

Users enable it via their OpenClaw plugins UI, or `openclaw plugins install claw-cleaning` once it is on the registry.

This directory also carries a Claude Code manifest (`.claude-plugin/plugin.json` + `.mcp.json`), so the same directory publishes to both ecosystems.

## Layout

```
plugin/
├── openclaw.plugin.json     # OpenClaw manifest (id, skills, configSchema)
├── package.json             # openclaw.extensions -> ./index.js
├── index.js                 # OpenClaw entry — registers the remote MCP server
├── .claude-plugin/
│   └── plugin.json          # Claude Code plugin manifest
├── .mcp.json                # Claude Code MCP connector registration
├── skills/
│   └── apartment-cleaning/
│       ├── SKILL.md
│       └── references/booking-flow.md
└── README.md
```

## Config

| field       | default                         | notes                                      |
|-------------|---------------------------------|--------------------------------------------|
| `serverUrl` | `https://claw.cleaning/mcp`     | Override only for staging / self-hosting.  |

## Tools exposed

Three tools, all wired through the remote MCP server:

- `check_availability` — list open weekend slots (Sat/Sun, 8am–6pm PT).
- `initiate_booking` — reserve a slot; the customer pays the cleaner at the appointment ($40/hr).
- `check_booking_status` — list a customer's upcoming bookings by email.

## License

MIT-0
