export const homepageMarkdown = `# claw.cleaning — Apartment Cleaning, Booked by AI

claw.cleaning is a professional apartment cleaning service in **San Francisco**, designed to be booked end-to-end by an AI assistant on your behalf. You tell Claude "book me a cleaning Saturday morning," and it handles availability, scheduling, payment, and the calendar invite — no app, no forms.

- **Rate:** $40/hour
- **Days:** Saturdays and Sundays
- **Hours:** 8 AM – 6 PM PT
- **Area:** San Francisco addresses only
- **Payment:** pay now by card, or pay the cleaner in person at the appointment

## How to book

### Option 1 — Through Claude (recommended)

1. Connect claw.cleaning to Claude via one of the paths in *"Connect to claw.cleaning"* below — MCP (zero-install) is the fastest.
2. Ask Claude: *"Book me a 2-hour cleaning this Saturday at 10 AM."*
3. Claude checks availability, collects your address, and asks whether you'd like to pay now or pay on completion.
4. Pick one:
   - **Pay now** — Claude hands you a Stripe checkout link. Pay, and a Google Calendar invite arrives.
   - **Pay on completion** — no upfront payment. The calendar invite is sent immediately; you pay the cleaner (cash or card) at the end of the session.

### Option 2 — Direct CLI

If you already use the \`claw-cleaning\` CLI, you can run \`claw-cleaning availability\` and \`claw-cleaning book\` yourself. The CLI hits the same REST endpoints the MCP server does.

## Connect to claw.cleaning

Pick whichever path fits your AI client.

### Option A — Connect via MCP *(recommended, zero-install)*

claw.cleaning speaks the [Model Context Protocol](https://modelcontextprotocol.io) over Streamable HTTP. Just point your MCP-compatible client at the remote endpoint:

\`\`\`
https://claw.cleaning/mcp
\`\`\`

Add that URL as a custom connector in Claude.ai, Claude Desktop, Cursor, Windsurf, or any MCP client. The server exposes three tools: \`check_availability\`, \`initiate_booking\`, and \`check_booking_status\`. A \`GET\` to the same URL returns server metadata.

### Option B — Claude Code plugin

If you use Claude Code, install the \`claw-cleaning\` plugin. It bundles the MCP connector above with the \`apartment-cleaning\` skill (safety rules, booking flow, example conversations) in one install. No local binary.

The plugin lives in the [\`plugin/\`](https://github.com/GetColby/claw-cleaning/tree/main/plugin) directory of the repo.

### Option C — Install the skill via Openclaw or Hermes

The \`apartment-cleaning\` skill is a single file that teaches your assistant how to drive the MCP tools safely (no inventing times, always confirms before charging, never books outside SF). The skill calls the MCP server above — there is no local binary to install.

\`\`\`
openclaw install apartment-cleaning
\`\`\`

\`\`\`
hermes install apartment-cleaning
\`\`\`

See [Openclaw](https://openclaw.com) or [Hermes](https://hermes.so) for the client itself.

### Option D — Manual CLI

\`\`\`
npm install -g claw-cleaning
claw-cleaning availability
\`\`\`

The CLI defaults to \`https://claw.cleaning\` — no env var needed. (Operators running a staging instance can override with \`CLAW_CLEANING_SERVER_URL\`.)

Useful if you want to script bookings yourself without an AI in the loop.

## What the AI can do on your behalf

Every integration (MCP, skill, or CLI) exposes the same three actions:

- **Check availability** — lists open weekend slots.
- **Initiate booking** — either returns a Stripe checkout link (pay now) or books the slot immediately with no charge (pay on completion).
- **Check status** — confirms whether your payment landed and the slot is locked in.

The assistant is required to ask which payment option you want, show the full booking preview (date, time, hours, address, total, payment method), and get explicit confirmation before acting. It cannot charge you silently.

## Privacy & data use

Short version: we collect only the booking details you provide (name, email, SF address, date/time), use them only to fulfill your cleaning, and never sell or share them for marketing. We access Google Calendar only to write the cleaner's schedule — we do not read your personal calendar. Payment is handled by Stripe; we never see your card details.

Read the full [Privacy Policy](https://claw.cleaning/privacy).

## Terms in short

- Cancellations & reschedules: email us at least 24 hours before the slot.
- Race conditions: if two people book the same slot, the second payment is refunded in full.
- Out-of-area requests: we only clean within San Francisco city limits.

## Contact

Questions, issues, or refunds: **connor@getcolby.com**

---

*This site is the public homepage for the claw.cleaning apartment-cleaning service and serves as the OAuth application homepage for our Google Calendar integration.*
`;

import { pageHtml } from './page.js';

export function homepageHtml() {
  return pageHtml({
    title: 'claw.cleaning — Apartment Cleaning, Booked by AI',
    description: 'Professional apartment cleaning in San Francisco, bookable end-to-end by an AI assistant. $40/hour, weekends, SF only.',
    markdownPath: '/homepage.md',
    markdown: homepageMarkdown,
  });
}
