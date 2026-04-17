import { getBusyIntervals, computeAvailableSlots, isSlotFree, createBookingEvents } from '../lib/calendar.js';
import {
  RATE_CENTS,
  createCheckoutSession,
  chargeSavedCard,
  getCustomerWithSavedCard,
  getOrCreateCustomer,
  refundPaymentIntent,
  getBookingsByEmail,
} from '../lib/stripe.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'claw-cleaning', version: '1.0.0' };

const TOOLS = [
  {
    name: 'check_availability',
    description: 'List available cleaning slots. Saturdays and Sundays only, 8 AM – 6 PM PT, San Francisco only. Omit `date` for the next 8 upcoming weekend days.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD date (must be Saturday or Sunday).' },
      },
    },
  },
  {
    name: 'initiate_booking',
    description: 'Start a booking. The customer picks how they want to pay:\n- **Pay on completion** (`payInPerson: true`): no Stripe, no card. Slot is booked immediately, calendar invite is sent, customer pays the cleaner in cash or card at the appointment. Returns `{ status: "booked", paymentMethod: "in_person" }`.\n- **Pay now** (`payInPerson` omitted or false): behavior depends on payment history:\n  - First-time customer (no saved card for this email): returns `{ status: "checkout_required", checkoutUrl }`. Share the URL; the customer pays once in their browser and their card is saved for next time.\n  - Returning customer (has a saved card): charges the card on file immediately, creates the calendar event, and returns `{ status: "booked" }`. No URL needed.\n  - Charge failure on a returning customer: returns `{ error, code, requiresAction }`. Tell the customer the card was declined and offer to retry — a retry will fall back to a fresh checkout URL they can use with a different card.\nAlways ask the customer which payment option they want, then show a full booking preview (date, start, hours, address, total, email, payment method) and get explicit confirmation before calling this tool.',
    inputSchema: {
      type: 'object',
      required: ['date', 'startTime', 'hours', 'address', 'name', 'email'],
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Must be Saturday or Sunday.' },
        startTime: { type: 'string', description: '24h HH:MM, between 08:00 and 18:00 PT.' },
        hours: { type: 'integer', minimum: 1, maximum: 8, description: 'Number of hours (1–8). $40/hour.' },
        address: { type: 'string', description: 'Full street address. Must be in San Francisco, CA.' },
        name: { type: 'string', description: "Customer's full name." },
        email: { type: 'string', description: 'Customer email. Used to identify repeat customers and deliver the calendar invite.' },
        payInPerson: { type: 'boolean', description: 'If true, book without taking payment — customer pays the cleaner in cash or card at the appointment. Defaults to false (Stripe flow).' },
      },
    },
  },
  {
    name: 'check_booking_status',
    description: 'List the bookings for a customer by email, with payment/calendar status for each. Returns most recent first. Covers both first-time (Stripe Checkout) and repeat (direct charge) bookings. Stripe search indexing can lag a few seconds behind a brand-new booking.',
    inputSchema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', description: 'Customer email used during checkout.' },
      },
    },
  },
  {
    name: 'force_checkout_booking',
    description: 'Like `initiate_booking`, but always returns a Stripe checkout URL even for returning customers. Use this when a returning customer\'s saved card was declined and you want to give them a fresh browser checkout to try another card.',
    inputSchema: {
      type: 'object',
      required: ['date', 'startTime', 'hours', 'address', 'name', 'email'],
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Must be Saturday or Sunday.' },
        startTime: { type: 'string', description: '24h HH:MM, between 08:00 and 18:00 PT.' },
        hours: { type: 'integer', minimum: 1, maximum: 8, description: 'Number of hours (1–8). $40/hour.' },
        address: { type: 'string', description: 'Full street address. Must be in San Francisco, CA.' },
        name: { type: 'string', description: "Customer's full name." },
        email: { type: 'string', description: 'Customer email.' },
      },
    },
  },
];

function upcomingWeekendDates(n = 8) {
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    const day = d.getDay();
    if (day === 0 || day === 6) dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

function isSFAddress(address) {
  const lower = address.toLowerCase();
  const sfZip = /\b94(10[2-9]|1[1-6][0-9]|17[0-7])\b/;
  return lower.includes('san francisco') || lower.includes(', sf,') || lower.includes(', sf ') || sfZip.test(address);
}

function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function validateBookingArgs(args) {
  const { date, startTime, hours, address, name: customer, email, payInPerson } = args;
  if (!date || !startTime || hours == null || !address || !customer || !email) {
    return { error: 'Missing required fields: date, startTime, hours, address, name, email.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date format. Use YYYY-MM-DD.' };
  if (!isSatOrSun(date)) return { error: 'Bookings are only available Saturday and Sunday.' };
  if (!/^\d{2}:\d{2}$/.test(startTime)) return { error: 'Invalid startTime. Use HH:MM (24h).' };
  const hoursNum = parseInt(hours, 10);
  if (!hoursNum || hoursNum < 1 || hoursNum > 8) return { error: 'Hours must be between 1 and 8.' };
  if (!isSFAddress(address)) return { error: 'Address must be in San Francisco, CA.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address.' };
  return { ok: { date, startTime, hours: hoursNum, address, name: customer, email, payInPerson: !!payInPerson } };
}

async function runTool(env, name, args) {
  args = args || {};

  if (name === 'check_availability') {
    if (args.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) return toolError('Invalid date format. Use YYYY-MM-DD.');
      if (!isSatOrSun(args.date)) return toolError('Bookings are only available Saturday and Sunday.');
      const busy = await getBusyIntervals(env, args.date);
      const slots = computeAvailableSlots(busy, args.date);
      return textResult({ date: args.date, slots });
    }
    const dates = upcomingWeekendDates(8);
    const weekends = await Promise.all(dates.map(async date => {
      const busy = await getBusyIntervals(env, date);
      return { date, slots: computeAvailableSlots(busy, date) };
    }));
    return textResult({ weekends });
  }

  if (name === 'initiate_booking' || name === 'force_checkout_booking') {
    const v = validateBookingArgs(args);
    if (v.error) return toolError(v.error);
    const { date, startTime, hours, address, name: customer, email, payInPerson } = v.ok;
    const totalDollars = hours * (RATE_CENTS / 100);

    const free = await isSlotFree(env, date, startTime, hours);
    if (!free) return toolError('That time slot is no longer available. Check availability and choose another time.');

    // Pay-on-completion path — no Stripe. `force_checkout_booking` ignores this since its whole point is to return a checkout URL.
    if (payInPerson && name === 'initiate_booking') {
      try {
        await createBookingEvents(env, { date, startTime, hours, address, name: customer, email });
      } catch (err) {
        console.error('Calendar event creation failed (pay-in-person):', err);
        return toolError('Could not create calendar event. Please try again.');
      }
      return textResult({
        status: 'booked',
        paymentMethod: 'in_person',
        total: `$${totalDollars}`,
        date, startTime, hours, address, email,
        message: `Cleaning confirmed for ${date} at ${startTime} (${hours}h). Calendar invite sent to ${email}. The customer pays $${totalDollars} to the cleaner at the appointment (cash or card).`,
      });
    }

    const forceCheckout = name === 'force_checkout_booking';
    const saved = forceCheckout ? null : await getCustomerWithSavedCard(env, email);

    if (saved) {
      let intent;
      try {
        intent = await chargeSavedCard(env, {
          customer: saved.customer,
          paymentMethod: saved.paymentMethod,
          hours, date, startTime, address, name: customer, email,
        });
      } catch (err) {
        return textResult({
          status: 'charge_failed',
          error: err.message,
          code: err.stripeCode,
          declineCode: err.stripeDeclineCode,
          requiresAction: !!err.requiresAction,
          hint: 'The saved card was declined or needs 3DS. Call `force_checkout_booking` with the same arguments to give the customer a fresh checkout URL where they can use another card.',
        });
      }

      const stillFree = await isSlotFree(env, date, startTime, hours);
      if (!stillFree) {
        await refundPaymentIntent(env, intent.id).catch(e => console.error('Refund failed:', e));
        return toolError('That time slot was just taken. Full refund issued — check availability and choose another time.');
      }

      try {
        await createBookingEvents(env, { date, startTime, hours, address, name: customer, email });
      } catch (err) {
        console.error('Calendar event creation failed, refunding:', err);
        await refundPaymentIntent(env, intent.id).catch(e => console.error('Refund failed:', e));
        return toolError('Could not create calendar event. Full refund issued — please try again.');
      }

      return textResult({
        status: 'booked',
        paymentIntentId: intent.id,
        total: `$${totalDollars}`,
        date, startTime, hours, address, email,
        message: `Charged the card on file. Cleaning confirmed. Calendar invite sent to ${email}.`,
      });
    }

    // First-time (or forced) — Stripe Checkout.
    const customerObj = await getOrCreateCustomer(env, { email, name: customer });
    const session = await createCheckoutSession(env, {
      customer: customerObj, date, startTime, hours, address, name: customer, email,
    });
    return textResult({
      status: 'checkout_required',
      checkoutUrl: session.url,
      sessionId: session.id,
      total: `$${totalDollars}`,
      message: `Share the checkoutUrl with the customer. Their card will be saved; future bookings with email "${email}" will charge automatically without a browser.`,
    });
  }

  if (name === 'check_booking_status') {
    if (!args.email) return toolError('Missing email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) return toolError('Invalid email address.');
    const raw = await getBookingsByEmail(env, args.email);
    if (!raw.length) return textResult({ email: args.email, bookings: [], note: 'No bookings found. Stripe search indexing can lag a few seconds behind a new booking.' });
    const bookings = raw.map(b => {
      let status;
      if (b.paid) status = b.metadata.calendarBooked === 'true' ? 'booked' : 'processing';
      else if (b.expired) status = 'expired';
      else status = 'pending';
      return {
        status,
        date: b.metadata.date,
        startTime: b.metadata.startTime,
        hours: b.metadata.hours,
        address: b.metadata.address,
        source: b.source,
        createdAt: b.created ? new Date(b.created * 1000).toISOString() : null,
      };
    });
    return textResult({ email: args.email, bookings });
  }

  return toolError(`Unknown tool: ${name}`);
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleRpc(env, msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'claw.cleaning books apartment cleanings in San Francisco. Saturdays and Sundays only, $40/hour. Customers choose how to pay: (1) pay on completion — pass `payInPerson: true` to initiate_booking, no Stripe needed, the customer pays the cleaner at the appointment; or (2) pay now via Stripe — first-time customers get a checkout URL (their card is saved), repeat customers are charged automatically on file. Always ask the customer which payment option they want, then show a full booking preview and get explicit confirmation before calling initiate_booking.',
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    if (!name) return jsonRpcError(id, -32602, 'Missing tool name.');
    try {
      const result = await runTool(env, name, args);
      return { jsonrpc: '2.0', id, result };
    } catch (err) {
      console.error('tool error', name, err);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
    }
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  // Notifications: no response
  if (id === undefined || id === null) return null;

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

export async function handleMcp(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json(jsonRpcError(null, -32700, 'Parse error'), 400);
  }

  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.map(msg => handleRpc(c.env, msg)))).filter(r => r !== null);
    return responses.length ? c.json(responses) : new Response(null, { status: 202 });
  }

  const response = await handleRpc(c.env, body);
  if (response === null) return new Response(null, { status: 202 });
  return c.json(response);
}

export function handleMcpInfo(c) {
  return c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: PROTOCOL_VERSION,
    transport: 'streamable-http',
    endpoint: '/mcp',
    tools: TOOLS.map(t => t.name),
  });
}
