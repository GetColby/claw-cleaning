import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleAvailability } from './routes/availability.js';
import { handleInitiateBooking, handleBookingStatus } from './routes/bookings.js';
import { handleMcp, handleMcpInfo } from './routes/mcp.js';
import { homepageMarkdown, homepageHtml } from './homepage.js';
import { privacyMarkdown, privacyHtml } from './privacy.js';
import { llmsTxt, agentsTxt, sitemapXml, wellKnownMcp } from './discovery.js';
import { iconSvg } from './assets.js';
import { cancelDeclinedBookings } from './lib/calendar.js';

const app = new Hono();

app.use('*', cors());

app.get('/availability', handleAvailability);
app.post('/bookings/initiate', handleInitiateBooking);
app.get('/bookings/status', handleBookingStatus);

app.post('/mcp', handleMcp);
app.get('/mcp', handleMcpInfo);

app.get('/', c => c.html(homepageHtml()));
app.get('/homepage.md', c => c.text(homepageMarkdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' }));

app.get('/privacy', c => c.html(privacyHtml()));
app.get('/privacy.md', c => c.text(privacyMarkdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' }));

app.get('/llms.txt', c => c.text(llmsTxt(), 200, { 'Content-Type': 'text/plain; charset=utf-8' }));
app.get('/llm.txt', c => c.text(llmsTxt(), 200, { 'Content-Type': 'text/plain; charset=utf-8' }));
app.get('/agents.txt', c => c.text(agentsTxt(), 200, { 'Content-Type': 'text/plain; charset=utf-8' }));
app.get('/sitemap.xml', c => c.text(sitemapXml(), 200, { 'Content-Type': 'application/xml; charset=utf-8' }));
app.get('/.well-known/mcp.json', c => c.json(wellKnownMcp()));

app.get('/assets/icon.svg', c => c.body(iconSvg, 200, {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
}));
app.get('/favicon.svg', c => c.body(iconSvg, 200, {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
}));

app.get('/health', c => c.json({ service: 'claw-cleaning-server', status: 'ok' }));

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const cancelled = await cancelDeclinedBookings(env);
        if (cancelled.length) {
          console.log(`Decline-cleanup: cancelled ${cancelled.length} booking(s):`, JSON.stringify(cancelled));
        }
      } catch (err) {
        console.error('Decline-cleanup error:', err?.stack || err);
      }
    })());
  },
};
