---
name: apartment-cleaning
description: "Book a professional apartment cleaning in San Francisco via the claw.cleaning MCP server. Use when someone wants to book, schedule, or inquire about apartment cleaning services, cleaning availability, cleaning prices, or cleaning appointments. Rate is $40/hour, Saturdays and Sundays only, SF addresses only. No payment is collected up front — customers pay the cleaner in cash or card at the appointment. Handles the full flow: check availability, collect details, confirm booking."
metadata: {"openclaw":{"emoji":"🧹","mcp":{"url":"https://claw.cleaning/mcp","transport":"streamable-http","tools":["check_availability","initiate_booking","check_booking_status"]}}}
---

# Apartment Cleaning Booking

## At a Glance
- **Service:** Professional apartment cleaning
- **Area:** San Francisco only
- **Rate:** $40/hour (1–8 hours)
- **Days:** Saturdays and Sundays only
- **Hours:** 8 AM – 6 PM PT
- **Payment:** No upfront payment. The customer pays the cleaner (cash or card) at the appointment.

## How This Skill Works

This skill drives the `claw-cleaning` MCP server — nothing runs locally.

- **Endpoint:** `https://claw.cleaning/mcp`
- **Transport:** Streamable HTTP, no auth
- **Setup:** If the client isn't already connected, ask the user to add the endpoint above as a custom MCP connector (Claude.ai, Claude Desktop, Cursor, Windsurf, etc. all support this), then retry.

### Available Tools
- `check_availability` — list open weekend slots
- `initiate_booking` — reserve a slot (calendar invite sent immediately, customer pays the cleaner at the appointment)
- `check_booking_status` — list upcoming bookings by email

## Safety Rules
- Never call `initiate_booking` without showing the full preview to the customer and getting explicit confirmation ("yes", "confirm", "book it", etc.).
- Always call `check_availability` before `initiate_booking` to confirm the slot is listed as available.
- Do not invent available times — only offer times returned by `check_availability`.
- Make it clear to the customer that the total ($40/hour × hours) is paid in cash or card to the cleaner at the end of the session.

## Booking Workflow

### Step 1 — Check availability

Call `check_availability`. Omit `date` to get the next 8 upcoming weekend days; pass `date` (YYYY-MM-DD, Saturday or Sunday) to check one day.

Present the available slots clearly. Each slot shows start time and max hours available.

### Step 2 — Collect customer details
Ask the customer:
- Which date and start time?
- How many hours? (1–8, $40 each)
- Full SF address (street, city, state)
- Their name
- Their email (calendar invite goes here)

### Step 3 — Confirm before booking
Show the customer a summary (date, start time, hours, address, total, email) and remind them the total is paid to the cleaner at the appointment. Ask for explicit confirmation before calling `initiate_booking`.

### Step 4 — Initiate booking

Call `initiate_booking` with `{ date, startTime, hours, address, name, email }`. Returns `{ status: "booked", total, ... }`. The slot is reserved immediately and the calendar invite is sent.

### Step 5 — Deliver the outcome
Tell the customer the slot is booked, the calendar invite is on its way, and they owe the cleaner $40/hour at the end of the session (cash or card).

### Step 6 — Check status (optional)

Call `check_booking_status` with `{ email }` if the customer asks whether their booking went through. Returns upcoming bookings for that email.

## Key Details
- Working hours: 8 AM – 6 PM PT
- 30-min travel buffers are automatically blocked before and after each cleaning
- The calendar event blocks the slot immediately on booking
- Persistent no-shows may result in the email being blocked from future bookings

## Error Handling
- "Address must be in San Francisco, CA." → ask for a valid SF address
- "That time slot is no longer available." → call `check_availability` and offer alternatives
- "Hours must be between 1 and 8." → correct the hours value
- "This email is blocked from booking." → the operator has blocked this email due to prior no-shows. Customer should contact connor@getcolby.com.

See `references/booking-flow.md` for a full example conversation flow.
