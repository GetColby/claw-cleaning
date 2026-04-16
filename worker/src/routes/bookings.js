import { isSlotFree } from '../lib/calendar.js';
import { createCheckoutSession, getSessionsByEmail } from '../lib/stripe.js';

function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function isSFAddress(address) {
  const lower = address.toLowerCase();
  const sfZipPattern = /\b94(10[2-9]|1[1-6][0-9]|17[0-7])\b/;
  return lower.includes('san francisco') || lower.includes(', sf,') || lower.includes(', sf ') || sfZipPattern.test(address);
}

export async function handleInitiateBooking(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const { date, startTime, hours, address, name, email } = body;

  // Validate required fields
  if (!date || !startTime || !hours || !address || !name || !email) {
    return c.json({ error: 'Missing required fields: date, startTime, hours, address, name, email.' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, 400);
  }
  if (!isSatOrSun(date)) {
    return c.json({ error: 'Bookings are only available Saturday and Sunday.' }, 400);
  }
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return c.json({ error: 'Invalid startTime format. Use HH:MM (24h).' }, 400);
  }
  const hoursNum = parseInt(hours, 10);
  if (!hoursNum || hoursNum < 1 || hoursNum > 8) {
    return c.json({ error: 'Hours must be between 1 and 8.' }, 400);
  }
  if (!isSFAddress(address)) {
    return c.json({ error: 'Address must be in San Francisco, CA.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email address.' }, 400);
  }

  try {
    const free = await isSlotFree(c.env, date, startTime, hoursNum);
    if (!free) {
      return c.json({ error: 'That time slot is no longer available. Please check availability and choose another time.' }, 409);
    }

    const session = await createCheckoutSession(c.env, {
      date, startTime, hours: hoursNum, address, name, email,
    });

    return c.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      total: `$${hoursNum * 60}`,
      message: `Complete payment to confirm your ${hoursNum}h cleaning on ${date} at ${startTime}.`,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to initiate booking.' }, 500);
  }
}

function deriveStatus(session) {
  const meta = session.metadata || {};
  if (session.payment_status === 'paid') return meta.calendarBooked === 'true' ? 'booked' : 'processing';
  if (session.status === 'expired') return 'expired';
  return 'pending';
}

export async function handleBookingStatus(c) {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'Missing email query parameter.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address.' }, 400);

  try {
    const sessions = await getSessionsByEmail(c.env, email);
    const bookings = sessions.map(s => {
      const meta = s.metadata || {};
      return {
        status: deriveStatus(s),
        date: meta.date,
        startTime: meta.startTime,
        hours: meta.hours,
        address: meta.address,
        sessionId: s.id,
        createdAt: s.created ? new Date(s.created * 1000).toISOString() : null,
      };
    });
    return c.json({ email, bookings });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch booking status.' }, 500);
  }
}
