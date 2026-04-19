import { getAccessToken } from './google-auth.js';

const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

const WORK_START = 8;   // 8 AM
const WORK_END = 18;    // 6 PM
const BUFFER_MINS = 30;
const TZ = 'America/Los_Angeles';

async function calFetch(env, path, options = {}) {
  const token = await getAccessToken(env);
  const resp = await fetch(`${CAL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Calendar API error ${resp.status}: ${body}`);
  }
  return resp.json();
}

// Returns busy intervals (in ms) for a given date in PT
export async function getBusyIntervals(env, dateStr) {
  const dayStart = new Date(`${dateStr}T${String(WORK_START).padStart(2, '0')}:00:00-07:00`);
  const dayEnd = new Date(`${dateStr}T${String(WORK_END).padStart(2, '0')}:00:00-07:00`);

  const data = await calFetch(env, '/freeBusy', {
    method: 'POST',
    body: JSON.stringify({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      timeZone: TZ,
      items: [{ id: env.GOOGLE_CALENDAR_ID }],
    }),
  });

  const busy = data.calendars?.[env.GOOGLE_CALENDAR_ID]?.busy ?? [];
  return busy.map(b => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
}

// Returns available slots: [{start: "HH:MM", maxHours: N}]
export function computeAvailableSlots(busyIntervals, dateStr) {
  const dayStart = new Date(`${dateStr}T${String(WORK_START).padStart(2, '0')}:00:00-07:00`).getTime();
  const dayEnd = new Date(`${dateStr}T${String(WORK_END).padStart(2, '0')}:00:00-07:00`).getTime();
  const bufMs = BUFFER_MINS * 60 * 1000;

  // Expand each busy interval by BUFFER_MINS on each side
  const blocked = busyIntervals.map(b => ({
    start: b.start - bufMs,
    end: b.end + bufMs,
  }));

  // Merge overlapping blocked intervals
  blocked.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const b of blocked) {
    if (merged.length && b.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, b.end);
    } else {
      merged.push({ ...b });
    }
  }

  // Find free windows between dayStart and dayEnd
  const freeWindows = [];
  let cursor = dayStart;
  for (const block of merged) {
    if (block.start > cursor) {
      freeWindows.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < dayEnd) {
    freeWindows.push({ start: cursor, end: dayEnd });
  }

  // For each free window, emit 30-min-increment start times with max hours
  const slots = [];
  for (const win of freeWindows) {
    const winMs = win.end - win.start;
    if (winMs < 60 * 60 * 1000) continue; // skip windows < 1 hour

    // Cleaning can start within the window; buffer is ALREADY excluded (absorbed into win boundaries)
    // Cleaning start: win.start (first possible cleaning start after buffer ends)
    // Cleaning end must be <= win.end (before next buffer starts)
    // Max hours = floor(winMs / 3600000)
    const maxHours = Math.min(8, Math.floor(winMs / (60 * 60 * 1000)));

    // Emit start times in 30-min increments across the window
    let t = win.start;
    while (t + 60 * 60 * 1000 <= win.end) {
      const remainMs = win.end - t;
      const avail = Math.min(8, Math.floor(remainMs / (60 * 60 * 1000)));
      if (avail >= 1) {
        const h = new Date(t);
        const hStr = h.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
        slots.push({ start: hStr, maxHours: avail });
      }
      t += 30 * 60 * 1000;
    }
  }

  return slots;
}

// Check if a specific slot is free (accounting for buffers)
export async function isSlotFree(env, dateStr, startTime, hours) {
  const [h, m] = startTime.split(':').map(Number);
  const cleanStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-07:00`);
  const cleanEnd = new Date(cleanStart.getTime() + hours * 60 * 60 * 1000);
  const bufMs = BUFFER_MINS * 60 * 1000;
  const blockStart = cleanStart.getTime() - bufMs;
  const blockEnd = cleanEnd.getTime() + bufMs;

  const busy = await getBusyIntervals(env, dateStr);
  for (const b of busy) {
    // Overlap check
    if (b.start < blockEnd && b.end > blockStart) return false;
  }
  return true;
}

// List upcoming bookings for a given email by querying the calendar for
// future events whose description / attendees contain the email. Returns
// cleaning events only (travel-buffer events are filtered out).
export async function getBookingsByEmail(env, email, limit = 20) {
  const timeMin = new Date().toISOString();
  const path = `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?timeMin=${encodeURIComponent(timeMin)}&q=${encodeURIComponent(email)}&maxResults=${limit}&singleEvents=true&orderBy=startTime`;
  const data = await calFetch(env, path);
  const events = (data.items || []).filter(ev => typeof ev.summary === 'string' && ev.summary.startsWith('🧹'));
  return events.map(ev => {
    const startIso = ev.start?.dateTime || null;
    const endIso = ev.end?.dateTime || null;
    const startDate = startIso ? new Date(startIso) : null;
    const endDate = endIso ? new Date(endIso) : null;
    const hours = startDate && endDate ? Math.round((endDate - startDate) / (60 * 60 * 1000)) : null;
    const date = startIso ? startIso.slice(0, 10) : null;
    const startTime = startDate ? startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }) : null;
    return {
      eventId: ev.id,
      date,
      startTime,
      hours,
      address: ev.location || null,
      summary: ev.summary,
    };
  });
}

// Create the 3 calendar events for a confirmed booking. All three share a
// `claw_booking_id` extended-property so the decline-cleanup cron can find and
// delete the full set when the customer declines the invite.
export async function createBookingEvents(env, { date, startTime, hours, address, name, email, source }) {
  const [h, m] = startTime.split(':').map(Number);
  const cleanStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-07:00`);
  const cleanEnd = new Date(cleanStart.getTime() + hours * 60 * 60 * 1000);
  const bufMs = BUFFER_MINS * 60 * 1000;
  const travelStart = new Date(cleanStart.getTime() - bufMs);
  const travelEndAfter = new Date(cleanEnd.getTime() + bufMs);

  const toIso = d => d.toISOString();
  const bookingId = crypto.randomUUID();
  const extendedProperties = { private: { claw_booking_id: bookingId, claw_customer_email: email } };

  const makeEvent = (summary, start, end, extra = {}) => ({
    summary,
    start: { dateTime: toIso(start), timeZone: TZ },
    end: { dateTime: toIso(end), timeZone: TZ },
    extendedProperties,
    ...extra,
  });

  // `source=<value>` is the only durable caller-surface tag we have until a real bookings store exists.
  // Keep it on its own line so the weekly dashboard pull can grep it out of the description.
  const sourceLine = `source=${source || 'unknown'}`;

  const events = [
    makeEvent(`🚗 Travel to ${name}`, travelStart, cleanStart),
    makeEvent(`🧹 Apartment Cleaning — ${name}`, cleanStart, cleanEnd, {
      location: address,
      description: `${hours}h cleaning session\nAddress: ${address}\nCustomer: ${name} <${email}>\nRate: $${hours * 40}\n${sourceLine}\n\nDeclining this calendar invite cancels the booking — the cleaner will not show up.`,
      attendees: [{ email }],
      sendUpdates: 'all',
    }),
    makeEvent(`🚗 Travel from ${name}`, cleanEnd, travelEndAfter),
  ];

  const created = [];
  for (const event of events) {
    const result = await calFetch(env, `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
    created.push(result.id);
  }
  return { bookingId, eventIds: created };
}

// Cancel any upcoming bookings where the customer attendee has declined the
// calendar invite. Deletes all three events in the booking set (travel + cleaning
// + travel) by looking them up via the shared `claw_booking_id` extended property.
// Intended to be run from a cron trigger.
export async function cancelDeclinedBookings(env) {
  const timeMin = new Date().toISOString();
  const listPath = `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=50&singleEvents=true&orderBy=startTime`;
  const data = await calFetch(env, listPath);
  const cancelled = [];

  for (const ev of data.items || []) {
    if (typeof ev.summary !== 'string' || !ev.summary.startsWith('🧹')) continue;
    const customerEmail = ev.extendedProperties?.private?.claw_customer_email;
    const bookingId = ev.extendedProperties?.private?.claw_booking_id;
    if (!customerEmail || !bookingId) continue;

    const declined = (ev.attendees || []).some(a => a.email?.toLowerCase() === customerEmail.toLowerCase() && a.responseStatus === 'declined');
    if (!declined) continue;

    const setPath = `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?privateExtendedProperty=${encodeURIComponent(`claw_booking_id=${bookingId}`)}&maxResults=10&singleEvents=true`;
    const setData = await calFetch(env, setPath);
    for (const paired of setData.items || []) {
      try {
        await calFetch(env, `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events/${encodeURIComponent(paired.id)}?sendUpdates=none`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete paired event', paired.id, e.message);
      }
    }
    cancelled.push({ bookingId, customerEmail, summary: ev.summary });
  }

  return cancelled;
}

// Append `source=unknown` to the description of any future-dated cleaning event
// that does not already have a `source=` line. Idempotent: re-running skips
// events that already carry a source tag. Intended to be called once after the
// source-tagging change ships, via the protected admin endpoint.
export async function backfillSourceTags(env, { maxResults = 250 } = {}) {
  const timeMin = new Date().toISOString();
  const listPath = `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
  const data = await calFetch(env, listPath);
  const updated = [];
  const skipped = [];

  for (const ev of data.items || []) {
    if (typeof ev.summary !== 'string' || !ev.summary.startsWith('🧹')) continue;
    const desc = ev.description || '';
    if (/^source=/m.test(desc)) {
      skipped.push(ev.id);
      continue;
    }
    const separator = desc.length === 0 ? '' : (desc.endsWith('\n') ? '' : '\n');
    const newDesc = `${desc}${separator}source=unknown`;
    await calFetch(env, `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events/${encodeURIComponent(ev.id)}?sendUpdates=none`, {
      method: 'PATCH',
      body: JSON.stringify({ description: newDesc }),
    });
    updated.push(ev.id);
  }

  return { updated, skipped };
}
