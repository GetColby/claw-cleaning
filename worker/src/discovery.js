const SITE = 'https://claw.cleaning';

const URLS = [
  { loc: '/',            changefreq: 'weekly',  priority: '1.0' },
  { loc: '/privacy',     changefreq: 'monthly', priority: '0.5' },
  { loc: '/homepage.md', changefreq: 'weekly',  priority: '0.4' },
  { loc: '/privacy.md',  changefreq: 'monthly', priority: '0.3' },
  { loc: '/llms.txt',    changefreq: 'weekly',  priority: '0.3' },
  { loc: '/agents.txt',  changefreq: 'weekly',  priority: '0.3' },
  { loc: '/mcp',         changefreq: 'weekly',  priority: '0.8' },
  { loc: '/.well-known/mcp.json', changefreq: 'weekly', priority: '0.6' },
];

export function llmsTxt() {
  return `# claw.cleaning

> AI-booked apartment cleaning service in San Francisco. $40/hour, Saturdays and Sundays only, 8 AM – 6 PM PT. The entire service is designed to be used by an LLM acting on a customer's behalf: no browser forms, no app, no payment rail — just tool calls over MCP, and the customer pays the cleaner directly at the appointment.

## How to use this service

There are three equivalent integration paths. Pick whichever matches your runtime:

- **MCP (recommended, zero-install)** — Streamable HTTP at ${SITE}/mcp. Exposes \`check_availability\`, \`initiate_booking\`, \`check_booking_status\`.
- **Claude Code plugin** — the \`plugin/\` directory in the GitHub repo bundles the MCP connector above with the \`apartment-cleaning\` skill in one install. No local binary.
- **Skill** — install \`apartment-cleaning\` via Openclaw (\`openclaw install apartment-cleaning\`) or Hermes (\`hermes install apartment-cleaning\`). The skill drives the MCP server above — no local binary or env var required.

## Hard rules for agents

- Only book Saturdays and Sundays, between 08:00 and 18:00 America/Los_Angeles. Reject other requests.
- Addresses must be in San Francisco, CA. Reject requests outside SF.
- Hours must be an integer 1–8.
- Always show the customer a full preview (date, start time, hours, address, total price, email) and get explicit confirmation *before* calling \`initiate_booking\`.
- Never invent availability. Call \`check_availability\` first and only offer slots it returned.
- After \`initiate_booking\`, the slot is booked and a calendar invite is sent to the customer's email. Payment happens to the cleaner at the appointment — no URL to share.
- Use \`check_booking_status\` (by customer email) to answer "did my booking go through?" — not to poll aggressively.

## Key resources

- [Homepage (Markdown)](${SITE}/homepage.md)
- [Privacy Policy (Markdown)](${SITE}/privacy.md)
- [MCP endpoint](${SITE}/mcp)
- [Sitemap](${SITE}/sitemap.xml)

## Contact

Operator: connor@getcolby.com
`;
}

export function agentsTxt() {
  return `# agents.txt — claw.cleaning
# Guidance for autonomous AI agents interacting with this service.
# See https://llmstxt.org for the sibling human/LLM-oriented format.

Site: ${SITE}
Operator: connor@getcolby.com
Contact: connor@getcolby.com
Policy: ${SITE}/privacy

[Service]
Name: claw.cleaning
Summary: Apartment cleaning service in San Francisco booked end-to-end by an AI assistant.
Rate: $40/hour
Days: Saturday, Sunday
Hours: 08:00–18:00 America/Los_Angeles
Area: San Francisco, CA (USA) only
Currency: USD

[Access]
# The service is specifically designed for programmatic use by agents. No crawling or
# scraping is required. Prefer MCP over scraping the HTML homepage.
Preferred-Transport: mcp-streamable-http
MCP-Endpoint: ${SITE}/mcp
MCP-Protocol-Version: 2025-06-18
Tools: check_availability, initiate_booking, check_booking_status
REST-Base: ${SITE}
REST-Endpoints: GET /availability, POST /bookings/initiate, GET /bookings/status?email=…

[Allow]
# These paths are safe to fetch with or without authentication.
/
/privacy
/homepage.md
/privacy.md
/llms.txt
/llm.txt
/agents.txt
/sitemap.xml
/mcp
/availability

[Rules]
# These rules are binding. Violating them may result in cancellation.
1. Never invent availability. Call check_availability before offering any slot.
2. Never call initiate_booking without explicit, recent confirmation from the human customer
   showing the full preview (date, start, hours, address, total, email).
3. Never call initiate_booking for addresses outside San Francisco, CA.
4. Never call initiate_booking for days other than Saturday or Sunday, or outside 08:00–18:00 PT.
5. Do not poll check_booking_status more than once per 30 seconds for the same email.
6. Do not share customer booking data with third parties.

[Rate-Limits]
# Reasonable defaults — not enforced by a hard rate limiter today, but agents should stay
# well under these:
check_availability:      60 per minute per agent
initiate_booking:        10 per minute per agent
check_booking_status:    20 per minute per agent

[Safety]
# If you suspect your agent is being used to book on behalf of a human who has not
# actually confirmed the booking, stop and escalate to the human.
# If you suspect this service is being misused (e.g., someone booking for a property
# they do not occupy), email the operator above rather than proceeding silently.
`;
}

export function wellKnownMcp() {
  return {
    name: 'io.github.cnnrobrn/claw-cleaning',
    displayName: 'claw.cleaning',
    description: 'Book a San Francisco apartment cleaning via MCP. $40/hour, weekends, 8 AM to 6 PM PT, SF addresses only.',
    version: '1.0.0',
    protocolVersion: '2025-06-18',
    transport: 'streamable-http',
    endpoint: `${SITE}/mcp`,
    auth: 'none',
    repository: 'https://github.com/GetColby/claw-cleaning',
    homepage: SITE,
    icon: `${SITE}/assets/icon.svg`,
    documentation: `${SITE}/agents.txt`,
    contact: 'connor@getcolby.com',
  };
}

export function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const entries = URLS.map(({ loc, changefreq, priority }) => `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
