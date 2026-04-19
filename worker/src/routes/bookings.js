import { isSlotFree, createBookingEvents, getBookingsByEmail } from '../lib/calendar.js';

const RATE_DOLLARS = 40; // $40/hour

export const ALLOWED_SOURCES = ['mcp', 'web', 'direct', 'agent'];

function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function isSFAddress(address) {
  const lower = address.toLowerCase();
  const sfZipPattern = /\b94(10[2-9]|1[1-6][0-9]|17[0-7])\b/;
  return lower.includes('san francisco') || lower.includes(', sf,') || lower.includes(', sf ') || sfZipPattern.test(address);
}

function isEmailBlocked(env, email) {
  const raw = env.BLOCKED_PAYINPERSON_EMAILS;
  if (!raw) return false;
  const needle = email.trim().toLowerCase();
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(needle);
}

function validateBookingBody(body, defaultSource) {
  const { date, startTime, hours, address, name, email, source } = body || {};
  if (!date || !startTime || !hours || !address || !name || !email) {
    return { error: 'Missing required fields: date, startTime, hours, address, name, email.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date format. Use YYYY-MM-DD.' };
  if (!isSatOrSun(date)) return { error: 'Bookings are only available Saturday and Sunday.' };
  if (!/^\d{2}:\d{2}$/.test(startTime)) return { error: 'Invalid startTime format. Use HH:MM (24h).' };
  const hoursNum = parseInt(hours, 10);
  if (!hoursNum || hoursNum < 1 || hoursNum > 8) return { error: 'Hours must be between 1 and 8.' };
  if (!isSFAddress(address)) return { error: 'Address must be in San Francisco, CA.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address.' };
  const resolvedSource = source == null ? defaultSource : source;
  if (!ALLOWED_SOURCES.includes(resolvedSource)) {
    return { error: `Invalid source. Must be one of: ${ALLOWED_SOURCES.join(', ')}.` };
  }
  return { ok: { date, startTime, hours: hoursNum, address, name, email, source: resolvedSource } };
}

export async function handleInitiateBooking(c) {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body.' }, 400); }

  // REST callers that don't declare a source are treated as `direct`.
  // MCP has its own handler that defaults to `mcp`; a future web form should send `web`.
  const validated = validateBookingBody(body, 'direct');
  if (validated.error) return c.json({ error: validated.error }, 400);
  const { date, startTime, hours, address, name, email, source } = validated.ok;
  const total = hours * RATE_DOLLARS;

  if (isEmailBlocked(c.env, email)) {
    return c.json({
      error: 'This email is blocked from booking. Contact the operator at connor@getcolby.com.',
      code: 'email_blocked',
    }, 403);
  }

  try {
    const free = await isSlotFree(c.env, date, startTime, hours);
    if (!free) {
      return c.json({ error: 'That time slot is no longer available. Please check availability and choose another time.' }, 409);
    }

    try {
      await createBookingEvents(c.env, { date, startTime, hours, address, name, email, source });
    } catch (err) {
      console.error('Calendar event creation failed:', err);
      return c.json({ error: 'Could not create calendar event. Please try again.' }, 500);
    }

    return c.json({
      status: 'booked',
      total: `$${total}`,
      date, startTime, hours, address, email, source,
      message: `Cleaning confirmed for ${date} at ${startTime} (${hours}h). Calendar invite sent to ${email}. Pay $${total} cash or card to the cleaner at the appointment.`,
    });
  } catch (err) {
    console.error('initiate_booking error:', err);
    return c.json({ error: 'Failed to initiate booking.' }, 500);
  }
}

export async function handleBookingStatus(c) {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'Missing email query parameter.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address.' }, 400);

  try {
    const bookings = await getBookingsByEmail(c.env, email);
    return c.json({ email, bookings });
  } catch (err) {
    console.error('booking status error:', err);
    return c.json({ error: 'Failed to fetch booking status.' }, 500);
  }
}
