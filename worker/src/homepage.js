export const homepageMarkdown = `# claw.cleaning — Apartment Cleaning, Booked by AI

claw.cleaning is a professional apartment cleaning service in **San Francisco**, designed to be booked end-to-end by an AI assistant on your behalf. You tell Claude "book me a cleaning Saturday morning," and it handles availability, scheduling, payment, and the calendar invite — no app, no forms.

- **Rate:** $40/hour
- **Days:** Saturdays and Sundays
- **Hours:** 8 AM – 6 PM PT
- **Area:** San Francisco addresses only
- **Payment:** pay the cleaner (cash or card) at the appointment — no upfront payment, no saved card, no checkout page

## How to book

1. Connect claw.cleaning to your AI assistant via one of the paths in *"Connect to claw.cleaning"* below — MCP (zero-install) is the fastest.
2. Ask: *"Book me a 2-hour cleaning this Saturday at 10 AM."*
3. The assistant checks availability, collects your address, and confirms the booking preview with you.
4. On confirmation, the slot is reserved, a Google Calendar invite is sent, and you pay the cleaner (cash or card) at the appointment.

### Cancelling

The calendar invite you receive has "Yes / No / Maybe" buttons. Declining the invite also cancels the booking — the cleaner won't show up. To cancel with questions or on short notice, email **connor@getcolby.com** at least 24 hours before the slot.

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

## What the AI can do on your behalf

Every integration (MCP, skill, or plugin) exposes the same three actions:

- **Check availability** — lists open weekend slots.
- **Initiate booking** — reserves the slot and sends a calendar invite. No payment rail involved.
- **Check status** — confirms your upcoming bookings.

The assistant is required to show the full booking preview (date, time, hours, address, total, email) and get explicit confirmation before acting.

## Privacy & data use

Short version: we collect only the booking details you provide (name, email, SF address, date/time), use them only to fulfill your cleaning, and never sell or share them for marketing. We access Google Calendar only to write the cleaner's schedule — we do not read your personal calendar. No payment information is collected by this service; you pay the cleaner directly at the appointment.

Read the full [Privacy Policy](https://claw.cleaning/privacy).

## Terms in short

- Payment: pay the cleaner (cash or card) at the appointment — nothing is charged up front.
- Cancellations: decline the calendar invite, or email us at least 24 hours before the slot.
- Out-of-area requests: we only clean within San Francisco city limits.
- Persistent no-shows may be blocked from future bookings.

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
