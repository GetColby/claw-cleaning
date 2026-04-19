import { getBusyIntervals, computeAvailableSlots, isSlotFree, createBookingEvents, getBookingsByEmail } from '../lib/calendar.js';
import { ALLOWED_SOURCES } from './bookings.js';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'claw-cleaning', version: '1.0.0' };
const RATE_DOLLARS = 40;

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
    description: 'Reserve a cleaning slot. No payment is collected up front — the customer pays the cleaner in cash or card at the appointment. Returns `{ status: "booked" }`, the slot is locked in the calendar, and a calendar invite is sent to the email. Always ask the customer for full details (date, start time, hours, address, name, email) and confirm the booking preview before calling this tool.',
    inputSchema: {
      type: 'object',
      required: ['date', 'startTime', 'hours', 'address', 'name', 'email'],
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD. Must be Saturday or Sunday.' },
        startTime: { type: 'string', description: '24h HH:MM, between 08:00 and 18:00 PT.' },
        hours: { type: 'integer', minimum: 1, maximum: 8, description: 'Number of hours (1–8). $40/hour.' },
        address: { type: 'string', description: 'Full street address. Must be in San Francisco, CA.' },
        name: { type: 'string', description: "Customer's full name." },
        email: { type: 'string', description: 'Customer email. Calendar invite goes here.' },
        source: { type: 'string', enum: [...ALLOWED_SOURCES], description: 'Optional caller surface. Defaults to `mcp` when omitted.' },
      },
    },
  },
  {
    name: 'check_booking_status',
    description: 'List upcoming bookings for a customer by email. Queries Google Calendar directly, so results are live and reflect any bookings in the next ~20 events.',
    inputSchema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', description: 'Customer email used when booking.' },
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

function isEmailBlocked(env, email) {
  const raw = env.BLOCKED_PAYINPERSON_EMAILS;
  if (!raw) return false;
  const needle = email.trim().toLowerCase();
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(needle);
}

function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function validateBookingArgs(args) {
  const { date, startTime, hours, address, name: customer, email, source } = args;
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
  const resolvedSource = source == null ? 'mcp' : source;
  if (!ALLOWED_SOURCES.includes(resolvedSource)) {
    return { error: `Invalid source. Must be one of: ${ALLOWED_SOURCES.join(', ')}.` };
  }
  return { ok: { date, startTime, hours: hoursNum, address, name: customer, email, source: resolvedSource } };
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

  if (name === 'initiate_booking') {
    const v = validateBookingArgs(args);
    if (v.error) return toolError(v.error);
    const { date, startTime, hours, address, name: customer, email, source } = v.ok;
    const totalDollars = hours * RATE_DOLLARS;

    if (isEmailBlocked(env, email)) {
      return toolError('This email is blocked from booking. Contact the operator at connor@getcolby.com.');
    }

    const free = await isSlotFree(env, date, startTime, hours);
    if (!free) return toolError('That time slot is no longer available. Check availability and choose another time.');

    try {
      await createBookingEvents(env, { date, startTime, hours, address, name: customer, email, source });
    } catch (err) {
      console.error('Calendar event creation failed:', err);
      return toolError('Could not create calendar event. Please try again.');
    }
    return textResult({
      status: 'booked',
      total: `$${totalDollars}`,
      date, startTime, hours, address, email, source,
      message: `Cleaning confirmed for ${date} at ${startTime} (${hours}h). Calendar invite sent to ${email}. The customer pays $${totalDollars} to the cleaner at the appointment (cash or card).`,
    });
  }

  if (name === 'check_booking_status') {
    if (!args.email) return toolError('Missing email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) return toolError('Invalid email address.');
    const bookings = await getBookingsByEmail(env, args.email);
    if (!bookings.length) return textResult({ email: args.email, bookings: [], note: 'No upcoming bookings found for this email.' });
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
        instructions: 'claw.cleaning books apartment cleanings in San Francisco. Saturdays and Sundays only, $40/hour. No payment is collected up front — the customer pays the cleaner (cash or card) at the appointment. initiate_booking reserves the slot and sends a calendar invite immediately. Always show a full booking preview (date, start, hours, address, total, email) and get explicit confirmation before calling initiate_booking.',
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
