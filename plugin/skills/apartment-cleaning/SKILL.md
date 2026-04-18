---
name: apartment-cleaning
description: "Book a professional apartment cleaning in San Francisco via the claw.cleaning MCP server. Use when someone wants to book, schedule, or inquire about apartment cleaning services, cleaning availability, cleaning prices, or cleaning appointments. Rate is $40/hour, Saturdays and Sundays only, SF addresses only. Two payment options: pay now with a card (fresh Stripe checkout every time — nothing saved), or pay the cleaner in person at the appointment. Handles the full flow: check availability, collect details, choose payment, confirm booking."
metadata: {"openclaw":{"emoji":"🧹","mcp":{"url":"https://claw.cleaning/mcp","transport":"streamable-http","tools":["check_availability","initiate_booking","check_booking_status"]}}}
---

# Apartment Cleaning Booking

## At a Glance
- **Service:** Professional apartment cleaning
- **Area:** San Francisco only
- **Rate:** $40/hour (1–8 hours)
- **Days:** Saturdays and Sundays only
- **Hours:** 8 AM – 6 PM PT
- **Payment:** Pay now via Stripe Checkout (fresh every booking, nothing saved) or pay the cleaner in person

## How This Skill Works

This skill drives the `claw-cleaning` MCP server — nothing runs locally.

- **Endpoint:** `https://claw.cleaning/mcp`
- **Transport:** Streamable HTTP, no auth
- **Setup:** If the client isn't already connected, ask the user to add the endpoint above as a custom MCP connector (Claude.ai, Claude Desktop, Cursor, Windsurf, etc. all support this), then retry.

### Available Tools
- `check_availability` — list open weekend slots
- `initiate_booking` — reserve a slot (pay now via Stripe, or pay in person)
- `check_booking_status` — look up recent bookings by email

## Safety Rules
- Never call `initiate_booking` without showing the full preview to the customer and getting explicit confirmation ("yes", "confirm", "book it", etc.).
- Always call `check_availability` before `initiate_booking` to confirm the slot is listed as available.
- Do not invent available times — only offer times returned by `check_availability`.
- Ask the customer which payment option they want (pay now, or pay in person) before building the preview.
- If the customer chooses "pay now" and `initiate_booking` returns a `checkoutUrl`, share it only after they confirm. Verify the URL is on `checkout.stripe.com` before sharing.

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
- **Payment preference:**
  - **Pay now** — a Stripe checkout link; customer enters card details in their browser. Nothing is saved or auto-charged; the same flow happens for every booking.
  - **Pay on completion** — no upfront payment. The cleaner collects cash or card at the appointment.

### Step 3 — Confirm before booking
Show the customer a summary (date, start time, hours, address, total, email, payment method), then ask for explicit confirmation before calling `initiate_booking`.

### Step 4 — Initiate booking

**Pay now (default):** call `initiate_booking` with `{ date, startTime, hours, address, name, email }`. Returns `{ status: "checkout_required", checkoutUrl, sessionId }`. Share the URL; the customer pays and receives a calendar invite after payment clears.

**Pay on completion:** call `initiate_booking` with the same fields plus `payInPerson: true`. Returns `{ status: "booked", paymentMethod: "in_person" }`. The slot is reserved immediately and the calendar invite is sent.

### Step 5 — Deliver the outcome
- **Pay now, checkout_required:** share the `checkoutUrl` and tell the customer they'll get a calendar invite after payment clears.
- **Pay on completion:** tell the customer the slot is booked, the calendar invite is on its way, and they owe the cleaner $40/hour at the end of the session.

### Step 6 — Check status (optional)

Call `check_booking_status` with `{ email }` if the customer asks whether their booking went through. Returns recent bookings for that email, most recent first. Stripe search indexing can lag a few seconds behind a brand-new booking.

## Key Details
- Working hours: 8 AM – 6 PM PT
- 30-min travel buffers are automatically blocked before and after each cleaning
- Pay-now slots are only confirmed after payment completes
- Pay-on-completion slots are confirmed immediately (the calendar event blocks the slot)
- If a race condition occurs on a pay-now booking (slot taken between check and payment), a full refund is issued automatically

## Error Handling
- "Address must be in San Francisco, CA." → ask for a valid SF address
- "That time slot is no longer available." → call `check_availability` and offer alternatives
- "Hours must be between 1 and 8." → correct the hours value

See `references/booking-flow.md` for a full example conversation flow for both payment options.
