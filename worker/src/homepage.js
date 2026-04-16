export const homepageMarkdown = `# Clawt — Apartment Cleaning, Booked by AI

Clawt is a professional apartment cleaning service in **San Francisco**, designed to be booked end-to-end by an AI assistant on your behalf. You tell Claude "book me a cleaning Saturday morning," and it handles availability, scheduling, payment, and the calendar invite — no app, no forms.

- **Rate:** $60/hour
- **Days:** Saturdays and Sundays
- **Hours:** 8 AM – 6 PM PT
- **Area:** San Francisco addresses only

## How to book

### Option 1 — Through Claude (recommended)

1. Install the \`apartment-cleaning\` skill (see below).
2. Ask Claude: *"Book me a 2-hour cleaning this Saturday at 10 AM."*
3. Claude checks availability, collects your address, and shows you a Stripe checkout link.
4. Pay. A Google Calendar invite arrives in your inbox with the confirmed time.

### Option 2 — Direct CLI

If you already use the \`clawt\` CLI, you can run \`clawt availability\` and \`clawt book\` yourself. Claude uses the same commands under the hood.

## Connect to Clawt

Pick whichever path fits your AI client.

### Option A — Install the skill via Openclaw or Hermes *(recommended)*

The skill is a single file that teaches Claude how to use this service safely (no inventing times, always confirms before charging, never books outside SF).

\`\`\`
openclaw install apartment-cleaning
\`\`\`

\`\`\`
hermes install apartment-cleaning
\`\`\`

Either command wires the skill into your Claude harness and installs the \`clawt\` CLI as a dependency. See [Openclaw](https://openclaw.com) or [Hermes](https://hermes.so) for the client itself.

### Option B — Connect via MCP *(zero-install)*

Clawt speaks the [Model Context Protocol](https://modelcontextprotocol.io) over Streamable HTTP. No skill, no CLI — just point your MCP-compatible client at the remote endpoint:

\`\`\`
https://claw.cleaning/mcp
\`\`\`

Add that URL as a custom connector in Claude.ai, Claude Desktop, Cursor, or any MCP client. The server exposes three tools: \`check_availability\`, \`initiate_booking\`, and \`check_booking_status\`. A \`GET\` to the same URL returns server metadata.

### Option C — Manual CLI

\`\`\`
npm install -g clawt
export CLAWT_SERVER_URL=https://claw.cleaning
clawt availability
\`\`\`

Useful if you want to script bookings yourself without an AI in the loop.

## What the AI can do on your behalf

Every integration (skill, MCP, or CLI) exposes the same three actions:

- **Check availability** — lists open weekend slots.
- **Initiate booking** — creates a pending hold and returns a Stripe checkout link.
- **Check status** — confirms whether your payment landed and the slot is locked in.

The assistant is required to show you the full booking preview (date, time, hours, address, total) and get explicit confirmation before initiating payment. It cannot charge you silently.

## Privacy & data use

To operate the service we use:

- **Google Calendar** — we create one event on the cleaner's calendar per confirmed booking, and send you a calendar invite to the email you provide at checkout. We do not read your calendar.
- **Stripe** — handles payment. We never see your card details.
- **Your booking details** (name, email, SF address, date/time) — stored only to fulfill the cleaning and send the calendar invite.

We do not sell, share, or use your information for marketing. If a slot is taken between availability check and payment, Stripe issues an automatic full refund.

## Terms in short

- Cancellations & reschedules: email us at least 24 hours before the slot.
- Race conditions: if two people book the same slot, the second payment is refunded in full.
- Out-of-area requests: we only clean within San Francisco city limits.

## Contact

Questions, issues, or refunds: **connor@getcolby.com**

---

*This site is the public homepage for the Clawt apartment-cleaning service and serves as the OAuth application homepage for our Google Calendar integration.*
`;

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
  out = out.replace(/\*([^*]+)\*/g, (_, c) => `<em>${c}</em>`);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `<a href="${h}">${t}</a>`);
  return out;
}

export function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inCode = false;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${renderInline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = false; }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushPara(); closeList();
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else { out.push('<pre><code>'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }

    if (/^---\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^-\s+(.*)$/);
    if (li) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${renderInline(li[1])}</li>`);
      continue;
    }

    const oli = line.match(/^\d+\.\s+(.*)$/);
    if (oli) {
      flushPara();
      if (!inList) { out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${renderInline(oli[1])}</li>`);
      continue;
    }

    if (line.trim() === '') { flushPara(); closeList(); continue; }

    para.push(line);
  }
  flushPara();
  if (inList) out.push(inList === 'ol' ? '</ol>' : '</ul>');
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

export function homepageHtml() {
  const body = markdownToHtml(homepageMarkdown);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clawt — Apartment Cleaning, Booked by AI</title>
<meta name="description" content="Professional apartment cleaning in San Francisco, bookable end-to-end by an AI assistant. $60/hour, weekends, SF only.">
<link rel="alternate" type="text/markdown" href="/homepage.md">
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; background: #fafafa; }
  h1 { font-size: 2em; margin-top: 0; }
  h2 { margin-top: 2em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
  h3 { margin-top: 1.5em; }
  a { color: #0366d6; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f0f0f0; padding: 14px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.3em 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #161616; color: #e6e6e6; }
    code, pre { background: #262626; }
    h2 { border-color: #333; }
    hr { border-color: #333; }
    a { color: #58a6ff; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
