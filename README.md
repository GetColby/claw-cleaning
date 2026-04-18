# claw.cleaning

[![MCP](https://img.shields.io/badge/MCP-claw.cleaning%2Fmcp-blue)](https://claw.cleaning/mcp)
[![Registry](https://img.shields.io/badge/registry-modelcontextprotocol.io-black)](https://registry.modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

AI-booked apartment cleaning in San Francisco. $40/hour, Saturdays and Sundays, 8 AM to 6 PM PT, SF addresses only. The whole service is built to be driven by an LLM on the customer's behalf.

## Connect via MCP (recommended, zero-install)

Streamable HTTP, no auth, no CLI:

```
https://claw.cleaning/mcp
```

### Claude Desktop / Claude.ai

```json
{
  "mcpServers": {
    "claw-cleaning": {
      "url": "https://claw.cleaning/mcp"
    }
  }
}
```

### Cursor (`.cursor/mcp.json`) / Windsurf (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "claw-cleaning": {
      "url": "https://claw.cleaning/mcp"
    }
  }
}
```

## What the server does

Three tools over MCP, all for booking an SF weekend apartment cleaning:

- `check_availability` — list open weekend slots (Sat/Sun, 8am–6pm PT)
- `initiate_booking` — start a booking; returns a Stripe checkout URL for pay-now, or books immediately for pay-in-person
- `check_booking_status` — list a customer's bookings by email

## Other integration paths

- **Claude Code plugin** — bundles the MCP connector + the `apartment-cleaning` skill, zero local binary. See [`plugin/`](plugin/).
- **Skill** — `openclaw install apartment-cleaning` or `hermes install apartment-cleaning`. The skill drives the MCP server above — no local binary required. See [`skill/apartment-cleaning/SKILL.md`](skill/apartment-cleaning/SKILL.md).
- **CLI** — `npm install -g claw-cleaning` then `claw-cleaning availability`, `claw-cleaning book`, `claw-cleaning status`. See [`cli/`](cli/).

## Machine-readable metadata

- [`server.json`](server.json) — official MCP registry schema
- [`smithery.yaml`](smithery.yaml) — Smithery indexer
- `https://claw.cleaning/.well-known/mcp.json` — served manifest
- `https://claw.cleaning/agents.txt` — binding rules and rate limits
- `https://claw.cleaning/llms.txt` — LLM-oriented overview

## Repository layout

- [`worker/`](worker/) — Cloudflare Worker hosting the homepage, REST endpoints, and MCP server
- [`cli/`](cli/) — `claw-cleaning` npm CLI
- [`skill/`](skill/) — Openclaw / Hermes skill definition
- [`plugin/`](plugin/) — Claude Code plugin (MCP connector + skill)

## Contact

Operator: connor@getcolby.com

## License

MIT
