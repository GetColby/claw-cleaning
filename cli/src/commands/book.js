import chalk from 'chalk';
import { apiFetch } from '../lib/api.js';
import { isSFAddress, isSatOrSun, validateHours, validateTime, validateEmail, validateDate } from '../lib/validate.js';

export async function bookCommand(options) {
  const { date, start, hours, address, name, email } = options;

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

  console.log('\n' + chalk.bold('Booking Preview'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`  ${chalk.dim('Date:')}    ${date}`);
  console.log(`  ${chalk.dim('Time:')}    ${start} (${hoursNum}h)`);
  console.log(`  ${chalk.dim('Address:')} ${address}`);
  console.log(`  ${chalk.dim('Name:')}    ${name}`);
  console.log(`  ${chalk.dim('Email:')}   ${email}`);
  console.log(`  ${chalk.dim('Total:')}   ${chalk.yellow('$' + total)} ${chalk.dim('(cash or card to the cleaner at the appointment)')}`);
  console.log(chalk.dim('─'.repeat(40)));
  console.log('\nBooking...');

  let data;
  try {
    data = await apiFetch('/bookings/initiate', {
      method: 'POST',
      body: JSON.stringify({ date, startTime: start, hours: hoursNum, address, name, email }),
    });
  } catch (err) {
    console.error('\n' + chalk.red('✗ Booking failed:'), err.message);
    process.exit(1);
  }

  console.log('\n' + chalk.green('✓ Booked!'));
  console.log(chalk.dim(`  Total: ${data.total} — pay cash or card to the cleaner at the appointment.`));
  console.log(chalk.dim(`\nCalendar invite sent to ${email}.`));
}
