import chalk from 'chalk';
import { apiFetch } from '../lib/api.js';

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function renderSlots(slots) {
  if (!slots.length) return chalk.dim('  No availability');
  return slots.map(s => {
    const [h, m] = s.start.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    const startFmt = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    const endH = h + s.maxHours;
    const endPeriod = endH < 12 ? 'AM' : 'PM';
    const end12 = endH % 12 || 12;
    const endFmt = `${end12}:${String(m).padStart(2, '0')} ${endPeriod}`;
    return `  ${chalk.green('✓')} ${chalk.bold(startFmt)} — up to ${chalk.cyan(s.maxHours + 'h')} (until ${endFmt}) — ${chalk.yellow('$' + (s.maxHours * 40))} max`;
  }).join('\n');
}

export async function availabilityCommand(options) {
  try {
    if (options.date) {
      process.stdout.write(`Checking availability for ${options.date}...\n`);
      const data = await apiFetch(`/availability?date=${options.date}`);
      console.log(`\n${chalk.bold(dayLabel(options.date))}`);
      console.log(renderSlots(data.slots));
    } else {
      process.stdout.write('Fetching availability for upcoming weekends...\n\n');
      const data = await apiFetch('/availability');
      for (const { date, slots } of data.weekends) {
        console.log(chalk.bold(dayLabel(date)));
        console.log(renderSlots(slots));
        console.log();
      }
    }
    console.log(chalk.dim('\nBook with: claw-cleaning book --date YYYY-MM-DD --start HH:MM --hours N --address "..." --name "..." --email "..."'));
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
