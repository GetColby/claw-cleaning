import { isSlotFree, createBookingEvents } from '../lib/calendar.js';
import {
  RATE_CENTS,
  createCheckoutSession,
  getOrCreateCustomer,
  getBookingsByEmail,
} from '../lib/stripe.js';

function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function isSFAddress(address) {
  const lower = address.toLowerCase();
  const sfZipPattern = /\b94(10[2-9]|1[1-6][0-9]|17[0-7])\b/;
  return lower.includes('san francisco') || lower.includes(', sf,') || lower.includes(', sf ') || sfZipPattern.test(address);
}

function isPayInPersonBlocked(env, email) {
  const raw = env.BLOCKED_PAYINPERSON_EMAILS;
  if (!raw) return false;
  const needle = email.trim().toLowerCase();
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(needle);
}

function validateBookingBody(body) {
  const { date, startTime, hours, address, name, email, payInPerson } = body || {};
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
  return { ok: { date, startTime, hours: hoursNum, address, name, email, payInPerson: !!payInPerson } };
}

export async function handleInitiateBooking(c) {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const validated = validateBookingBody(body);
  if (validated.error) return c.json({ error: validated.error }, 400);
  const { date, startTime, hours, address, name, email, payInPerson } = validated.ok;
  const total = hours * (RATE_CENTS / 100);

  try {
    const free = await isSlotFree(c.env, date, startTime, hours);
    if (!free) {
      return c.json({ error: 'That time slot is no longer available. Please check availability and choose another time.' }, 409);
    }

    // Pay-on-completion — customer pays the cleaner in person. No Stripe.
    if (payInPerson) {
      if (isPayInPersonBlocked(c.env, email)) {
        return c.json({
          error: 'Pay-on-completion is not available for this email. Please book via Stripe checkout instead (omit payInPerson).',
          code: 'pay_in_person_blocked',
        }, 403);
      }
      try {
        await createBookingEvents(c.env, { date, startTime, hours, address, name, email });
      } catch (err) {
        console.error('Calendar event creation failed (pay-in-person):', err);
        return c.json({ error: 'Could not create calendar event. Please try again.' }, 500);
      }
      return c.json({
        status: 'booked',
        paymentMethod: 'in_person',
        total: `$${total}`,
        date, startTime, hours, address, email,
        message: `Cleaning confirmed for ${date} at ${startTime} (${hours}h). Calendar invite sent to ${email}. Pay $${total} cash or card to the cleaner at the appointment.`,
      });
    }

    // Pay now — always via Stripe Checkout. Customer enters payment info every time.
    const customer = await getOrCreateCustomer(c.env, { email, name });
    const session = await createCheckoutSession(c.env, {
      customer, date, startTime, hours, address, name, email,
    });

    return c.json({
      status: 'checkout_required',
      checkoutUrl: session.url,
      sessionId: session.id,
      total: `$${total}`,
      message: `Share the checkoutUrl with the customer. They'll complete payment in their browser and receive a calendar invite at ${email} afterwards.`,
    });
  } catch (err) {
    console.error('initiate_booking error:', err);
    return c.json({ error: 'Failed to initiate booking.' }, 500);
  }
}

function deriveStatus(booking) {
  if (booking.paid) return booking.metadata.calendarBooked === 'true' ? 'booked' : 'processing';
  if (booking.expired) return 'expired';
  return 'pending';
}

export async function handleBookingStatus(c) {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'Missing email query parameter.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address.' }, 400);

  try {
    const raw = await getBookingsByEmail(c.env, email);
    const bookings = raw.map(b => ({
      status: deriveStatus(b),
      date: b.metadata.date,
      startTime: b.metadata.startTime,
      hours: b.metadata.hours,
      address: b.metadata.address,
      source: b.source,
      id: b.id,
      createdAt: b.created ? new Date(b.created * 1000).toISOString() : null,
    }));
    return c.json({ email, bookings });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch booking status.' }, 500);
  }
}
