import chalk from 'chalk';
import { apiFetch } from '../lib/api.js';

const STATUS_LABELS = {
  pending: chalk.yellow('⏳ Awaiting payment'),
  processing: chalk.blue('🔄 Payment received, booking being confirmed...'),
  booked: chalk.green('✅ Confirmed and booked!'),
  expired: chalk.red('❌ Session expired — no charge made'),
  refunded: chalk.red('⚠️  Refunded — slot was taken, please rebook'),
};

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
      console.log(chalk.dim('\nNo bookings found for'), chalk.bold(email));
      console.log(chalk.dim('(Stripe search can lag a few seconds behind a brand-new booking.)\n'));
      return;
    }
    console.log(`\nBookings for ${chalk.bold(email)}:\n`);
    for (const b of bookings) {
      const label = STATUS_LABELS[b.status] || chalk.dim(b.status);
      console.log(`  ${label}`);
      if (b.date) console.log(`    Date:    ${b.date} at ${b.startTime} (${b.hours}h)`);
      if (b.address) console.log(`    Address: ${b.address}`);
      if (b.createdAt) console.log(chalk.dim(`    Booked:  ${b.createdAt}`));
      console.log();
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}
