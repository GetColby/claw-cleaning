---
name: clawt-setup
description: "Bootstrap the clawt apartment-cleaning service for a user who wants to book a cleaning but doesn't yet have the booking skill or CLI installed. Use when someone asks about booking, scheduling, or inquiring about SF apartment cleaning and the `apartment-cleaning` skill is not already active. Installs the CLI, adds the booking skill, sets the required env var, then hands off."
metadata: {"openclaw":{"emoji":"🧼","requires":{"bins":["npm"]},"install":[{"id":"npm","kind":"npm","package":"clawt","bins":["clawt"],"label":"Install clawt (npm)"}]}}
---

# Clawt Setup (meta-skill)

You are setting up the `apartment-cleaning` booking skill for the current user. Clawt is a San Francisco apartment-cleaning service that is booked entirely through an AI assistant. Public homepage: https://claw.cleaning

## When to use this skill

- The user asks to book / schedule / price a cleaning AND the `apartment-cleaning` skill is not available yet.
- The user explicitly asks to "install clawt", "set up the cleaning skill", or similar.

If the `apartment-cleaning` skill is already active, use it directly — do not run setup again.

## Short-circuit: MCP is already faster

If the client supports [MCP](https://modelcontextprotocol.io) custom connectors (Claude.ai, Claude Desktop, Cursor, etc.), ask the user whether they'd rather add the remote MCP server instead of the skill — it's zero-install:

- Endpoint: `https://claw.cleaning/mcp`
- Tools exposed: `check_availability`, `initiate_booking`, `check_booking_status`

If they pick MCP, tell them how to add a custom connector in their client and stop — no npm install, no env var, no skill needed. Continue with the full setup below only if they prefer the skill path or MCP isn't supported.

## Setup Workflow

### Step 1 — Verify prerequisites

Check `node` and `npm` are available:

```bash
node --version
npm --version
```

If either is missing, tell the user to install Node.js (≥ 18) and stop. Do not try to install Node yourself.

### Step 2 — Install the CLI

```bash
npm install -g clawt
```

If the install fails with EACCES, tell the user to run it with `sudo` or fix their npm prefix — do not auto-retry with sudo.

Verify:

```bash
clawt --version
```

### Step 3 — Set the server URL

The booking skill needs `CLAWT_SERVER_URL` pointing at the production service:

```bash
export CLAWT_SERVER_URL=https://claw.cleaning
```

Advise the user to add that line to their shell profile (`~/.zshrc` or `~/.bashrc`) so it persists.

### Step 4 — Install the booking skill

Preferred — use whichever of Openclaw or Hermes the user already has set up:

```bash
openclaw install apartment-cleaning
```

```bash
hermes install apartment-cleaning
```

If the user has neither, ask which they'd like to install (Openclaw: https://openclaw.com, Hermes: https://hermes.so) — don't pick for them. As a last resort, tell the user the skill lives at `https://claw.cleaning/homepage.md` and their agent harness should install the `apartment-cleaning` skill manually.

### Step 5 — Sanity-check

```bash
clawt availability
```

If this returns a list of weekend slots, setup is complete.

### Step 6 — Hand off

Tell the user: "Clawt is installed. What date and time would you like to book?" — then defer to the `apartment-cleaning` skill for the actual booking. Do not continue the booking flow from this skill.

## Safety Rules

- Never run `clawt book` from this skill. This skill only installs; booking is the `apartment-cleaning` skill's responsibility.
- Never set `CLAWT_SERVER_URL` to anything other than `https://claw.cleaning` unless the user explicitly provides an alternate URL (e.g., a staging environment).
- Never invent availability or prices. Prices and hours are fixed ($60/hr, Sat/Sun, 8 AM – 6 PM PT, SF only) — state them only from this file, never improvise.

## What the service does (for user questions during setup)

- **Rate:** $60/hour
- **Days:** Saturdays and Sundays only
- **Hours:** 8 AM – 6 PM PT
- **Area:** San Francisco addresses only
- Payment via Stripe; calendar invite sent after payment clears.
- Full details and privacy policy: https://claw.cleaning
