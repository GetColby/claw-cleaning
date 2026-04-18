import chalk from 'chalk';
import { apiFetch } from '../lib/api.js';

export async function statusCommand(options) {
  const { email } = options;
  if (!email) {
    console.error(chalk.red('✗'), '--email is required');
    process.exit(1);
  }

  try {
    const data = await apiFetch(`/bookings/status?email=${encodeURIComponent(email)}`);
    const bookings = data.bookings || [];
    if (!bookings.length) {
      console.log(chalk.dim('\nNo upcoming bookings found for'), chalk.bold(email) + '\n');
      return;
    }
    console.log(`\nUpcoming bookings for ${chalk.bold(email)}:\n`);
    for (const b of bookings) {
      console.log(`  ${chalk.green('✅ Booked')}`);
      if (b.date) console.log(`    Date:    ${b.date} at ${b.startTime} (${b.hours}h)`);
      if (b.address) console.log(`    Address: ${b.address}`);
      console.log();
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
