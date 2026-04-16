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

// Create the 3 calendar events for a confirmed booking
export async function createBookingEvents(env, { date, startTime, hours, address, name, email }) {
  const [h, m] = startTime.split(':').map(Number);
  const cleanStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-07:00`);
  const cleanEnd = new Date(cleanStart.getTime() + hours * 60 * 60 * 1000);
  const bufMs = BUFFER_MINS * 60 * 1000;
  const travelStart = new Date(cleanStart.getTime() - bufMs);
  const travelEndAfter = new Date(cleanEnd.getTime() + bufMs);

  const toIso = d => d.toISOString();

  const makeEvent = (summary, start, end, extra = {}) => ({
    summary,
    start: { dateTime: toIso(start), timeZone: TZ },
    end: { dateTime: toIso(end), timeZone: TZ },
    ...extra,
  });

  const events = [
    makeEvent(`🚗 Travel to ${name}`, travelStart, cleanStart),
    makeEvent(`🧹 Apartment Cleaning — ${name}`, cleanStart, cleanEnd, {
      location: address,
      description: `${hours}h cleaning session\nAddress: ${address}\nCustomer: ${name} <${email}>\nRate: $${hours * 60}`,
      attendees: [{ email }],
      sendUpdates: 'all',
    }),
    makeEvent(`🚗 Travel from ${name}`, cleanEnd, travelEndAfter),
  ];

  const created = [];
  for (const event of events) {
    const result = await calFetch(env, `/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
    created.push(result.id);
  }
  return created;
}
