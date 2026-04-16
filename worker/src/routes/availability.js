import { getBusyIntervals, computeAvailableSlots } from '../lib/calendar.js';

// Returns next N sat/sun dates from today
function upcomingWeekendDates(n = 8) {
  const dates = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    const day = d.getDay();
    if (day === 0 || day === 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function isSatOrSun(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  return day === 0 || day === 6;
}

export async function handleAvailability(c) {
  const env = c.env;
  const dateParam = c.req.query('date');

  try {
    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return c.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, 400);
      }
      if (!isSatOrSun(dateParam)) {
        return c.json({ error: 'Bookings are only available Saturday and Sunday.' }, 400);
      }
      const busy = await getBusyIntervals(env, dateParam);
      const slots = computeAvailableSlots(busy, dateParam);
      return c.json({ date: dateParam, slots });
    }

    // Return next 4 weekends (sat + sun)
    const dates = upcomingWeekendDates(8);
    const results = await Promise.all(
      dates.map(async date => {
        const busy = await getBusyIntervals(env, date);
        const slots = computeAvailableSlots(busy, date);
        return { date, slots };
      })
    );
    return c.json({ weekends: results });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch availability.' }, 500);
  }
}
