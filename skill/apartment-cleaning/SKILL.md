---
name: apartment-cleaning
description: "Book a professional apartment cleaning in San Francisco via the clawt CLI. Use when someone wants to book, schedule, or inquire about apartment cleaning services, cleaning availability, cleaning prices, or cleaning appointments. Rate is $60/hour, Saturdays and Sundays only, SF addresses only. Handles the full flow: check availability, collect details, initiate payment, confirm booking."
metadata: {"openclaw":{"emoji":"🧹","requires":{"bins":["clawt"]},"install":[{"id":"npm","kind":"npm","package":"clawt","bins":["clawt"],"label":"Install clawt (npm)"}]}}
---

# Apartment Cleaning Booking

Professional cleaning service, San Francisco only. $60/hour. Saturdays and Sundays only.

**Required env var:** `CLAWT_SERVER_URL` must be set (provided by the service operator).

## Safety Rules
- Never run `clawt book` without showing the full preview to the customer and getting explicit confirmation ("yes", "confirm", "book it", etc.).
- Always run `clawt availability` before `clawt book` to confirm the slot is listed as available.
- Do not invent available times — only offer times from `clawt availability` output.

## Booking Workflow

### Step 1 — Check availability
```bash
# All upcoming weekends
clawt availability

# Specific date
clawt availability --date 2026-04-19
```
Present the available slots clearly. Each slot shows start time and max hours available.

### Step 2 — Collect customer details
Ask the customer:
- Which date and start time?
- How many hours? (1–8, $60 each)
- Full SF address (street, city, state)
- Their name
- Their email (calendar invite goes here)

### Step 3 — Confirm before booking
Show the customer a summary and ask for explicit confirmation before running `clawt book`.

### Step 4 — Initiate booking
```bash
clawt book \
  --date 2026-04-19 \
  --start 10:00 \
  --hours 2 \
  --address "123 Market St, San Francisco, CA 94102" \
  --name "Jane Smith" \
  --email "jane@example.com"
```
This returns a Stripe payment URL. Share it with the customer.

### Step 5 — Payment
Tell the customer to open the payment link and complete checkout. After payment, they'll receive a calendar invite.

### Step 6 — Check status (optional)
```bash
clawt status --email jane@example.com
```
Use this if the customer asks whether their booking went through. Returns all recent bookings for that email, most recent first. Stripe search indexing can lag a few seconds behind a brand-new booking.

## Key Details
- Working hours: 8 AM – 6 PM PT
- 30-min travel buffers are automatically blocked before and after each cleaning
- The slot is only confirmed after payment completes
- If a race condition occurs (slot taken between check and payment), a full refund is issued automatically

## Error Handling
- "Address must be in San Francisco" → ask for a valid SF address
- "That time slot is no longer available" → run `clawt availability` and offer alternatives
- "Hours must be between 1 and 8" → correct the hours value

See `references/booking-flow.md` for a full example conversation flow.
