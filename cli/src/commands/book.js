import chalk from 'chalk';
import { apiFetch } from '../lib/api.js';
import { isSFAddress, isSatOrSun, validateHours, validateTime, validateEmail, validateDate } from '../lib/validate.js';

export async function bookCommand(options) {
  const { date, start, hours, address, name, email, payOnCompletion } = options;

  const errors = [];
  if (!date) errors.push('--date is required (YYYY-MM-DD)');
  else if (!validateDate(date)) errors.push('--date must be in YYYY-MM-DD format');
  else if (!isSatOrSun(date)) errors.push('Bookings are only available Saturday and Sunday');

  if (!start) errors.push('--start is required (HH:MM, 24h)');
  else if (!validateTime(start)) errors.push('--start must be in HH:MM format (e.g. 10:00)');

  if (!hours) errors.push('--hours is required');
  else if (!validateHours(hours)) errors.push('--hours must be between 1 and 8');

  if (!address) errors.push('--address is required');
  else if (!isSFAddress(address)) errors.push('Address must be in San Francisco, CA');

  if (!name) errors.push('--name is required');
  if (!email) errors.push('--email is required');
  else if (!validateEmail(email)) errors.push('--email must be a valid email address');

  if (errors.length) {
    for (const e of errors) console.error(chalk.red('✗'), e);
    process.exit(1);
  }

  const hoursNum = parseInt(hours, 10);
  const total = hoursNum * 40;

  const paymentLabel = payOnCompletion ? 'In person (cash or card at the appointment)' : 'Stripe (card)';

  console.log('\n' + chalk.bold('Booking Preview'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  ${chalk.dim('Date:')}    ${date}`);
  console.log(`  ${chalk.dim('Time:')}    ${start} (${hoursNum}h)`);
  console.log(`  ${chalk.dim('Address:')} ${address}`);
  console.log(`  ${chalk.dim('Name:')}    ${name}`);
  console.log(`  ${chalk.dim('Email:')}   ${email}`);
  console.log(`  ${chalk.dim('Total:')}   ${chalk.yellow('$' + total)}`);
  console.log(`  ${chalk.dim('Payment:')} ${paymentLabel}`);
  console.log(chalk.dim('─'.repeat(40)));
  console.log('\nInitiating booking...');

  let data;
  try {
    data = await apiFetch('/bookings/initiate', {
      method: 'POST',
      body: JSON.stringify({ date, startTime: start, hours: hoursNum, address, name, email, payInPerson: !!payOnCompletion }),
    });
  } catch (err) {
    // The server returns 402 with structured body for off-session card failures.
    const stripeCode = err.code || err.stripeCode;
    if (stripeCode) {
      console.error('\n' + chalk.red('✗ Card on file was declined.'));
      if (err.declineCode) console.error(chalk.dim(`  Reason: ${err.declineCode}`));
      console.error(chalk.dim('  The agent-initiated charge failed. Retry will fall back to a checkout URL.'));
    } else {
      console.error('\n' + chalk.red('✗ Booking failed:'), err.message);
    }
    process.exit(1);
  }

  if (data.status === 'booked' && data.paymentMethod === 'in_person') {
    console.log('\n' + chalk.green('✓ Booked! No payment required upfront.'));
    console.log(chalk.dim(`  Total:   ${data.total} (pay cash or card to the cleaner at the appointment)`));
    console.log(chalk.dim(`\nCalendar invite sent to ${email}.`));
    return;
  }

  if (data.status === 'booked') {
    console.log('\n' + chalk.green('✓ Charged your card on file and booked!'));
    console.log(chalk.dim(`  Payment: ${data.paymentIntentId}`));
    console.log(chalk.dim(`  Total:   ${data.total}`));
    console.log(chalk.dim(`\nCalendar invite sent to ${email}.`));
    return;
  }

  // First-time customer — needs browser checkout.
  console.log('\n' + chalk.green('✓ Slot is available!'));
  console.log(chalk.bold('\nComplete payment to confirm your booking:'));
  console.log(chalk.cyan('\n  ' + data.checkoutUrl + '\n'));
  console.log(chalk.dim('Your card will be saved — future bookings with the same email charge automatically.'));
  console.log(chalk.dim(`\nCheck status: claw-cleaning status --email ${email}`));
  console.log(chalk.dim(`After payment, a calendar invite goes to ${email}.`));
}
