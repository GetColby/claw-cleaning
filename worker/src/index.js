import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleAvailability } from './routes/availability.js';
import { handleInitiateBooking, handleBookingStatus } from './routes/bookings.js';
import { handleStripeWebhook } from './routes/webhooks.js';
import { handleMcp, handleMcpInfo } from './routes/mcp.js';
import { homepageMarkdown, homepageHtml } from './homepage.js';

const app = new Hono();

app.use('*', cors());

app.get('/availability', handleAvailability);
app.post('/bookings/initiate', handleInitiateBooking);
app.get('/bookings/status', handleBookingStatus);
app.post('/webhooks/stripe', handleStripeWebhook);

app.post('/mcp', handleMcp);
app.get('/mcp', handleMcpInfo);

app.get('/success', c => c.html(`
  <html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>✅ Payment received!</h1>
    <p>Your cleaning is booked. Check your email for a calendar invite.</p>
  </body></html>
`));

app.get('/cancel', c => c.html(`
  <html><body style="font-family:sans-serif;text-align:center;padding:60px">
    <h1>❌ Booking cancelled</h1>
    <p>No charge was made. Run <code>clawt availability</code> to try again.</p>
  </body></html>
`));

app.get('/', c => c.html(homepageHtml()));
app.get('/homepage.md', c => c.text(homepageMarkdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' }));
app.get('/health', c => c.json({ service: 'clawt-server', status: 'ok' }));

export default app;
