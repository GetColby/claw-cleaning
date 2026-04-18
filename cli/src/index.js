#!/usr/bin/env node
import { program } from 'commander';
import { availabilityCommand } from './commands/availability.js';
import { bookCommand } from './commands/book.js';
import { statusCommand } from './commands/status.js';

program
  .name('claw-cleaning')
  .description('Book a professional apartment cleaning in San Francisco')
  .version('1.0.0');

program
  .command('availability')
  .description('Show available Saturday/Sunday cleaning slots')
  .option('--date <YYYY-MM-DD>', 'Check a specific date (must be Saturday or Sunday)')
  .action(availabilityCommand);

program
  .command('book')
  .description('Book a cleaning session ($40/hour, paid to the cleaner at the appointment)')
  .requiredOption('--date <YYYY-MM-DD>', 'Date of cleaning (Saturday or Sunday)')
  .requiredOption('--start <HH:MM>', 'Start time in 24h format (e.g. 10:00)')
  .requiredOption('--hours <N>', 'Number of hours (1–8)')
  .requiredOption('--address <address>', 'Full address in San Francisco, CA')
  .requiredOption('--name <name>', 'Your name')
  .requiredOption('--email <email>', 'Your email (calendar invite will be sent here)')
  .action(bookCommand);

program
  .command('status')
  .description('List upcoming bookings for a customer by email')
  .requiredOption('--email <email>', 'Customer email used when booking')
  .action(statusCommand);

program.parse();
