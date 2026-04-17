# Apartment Cleaning — Full Example Booking Flow

All interactions go through the `claw-cleaning` MCP server at `https://claw.cleaning/mcp`. The agent never runs a local CLI and never crafts HTTP calls by hand — it calls MCP tools.

## Customer starts

**Customer:** "Hey, I want to book an apartment cleaning"

**Agent:** "Great! Let me check what's available this weekend."

Tool call: `check_availability` (no arguments).

Result:
```json
{
  "weekends": [
    {
      "date": "2026-04-18",
      "slots": [
        { "startTime": "09:00", "maxHours": 5 },
        { "startTime": "10:00", "maxHours": 4 },
        { "startTime": "14:00", "maxHours": 3 }
      ]
    },
    {
      "date": "2026-04-19",
      "slots": [
        { "startTime": "09:00", "maxHours": 8 }
      ]
    }
  ]
}
```

**Agent:** "Here's what's open this weekend:

**Saturday, April 18:**
- 9:00 AM (up to 5 hours, max $200)
- 10:00 AM (up to 4 hours, max $160)
- 2:00 PM (up to 3 hours, max $120)

**Sunday, April 19:**
- 9:00 AM (up to 8 hours, max $320)

Rate is $40/hour. Which time works for you?"

---

## Customer selects a slot

**Customer:** "Saturday at 10, I need 3 hours"

**Agent:** "Got it — 3 hours at $120 total. A few more things:
- What's the full address? (Must be in San Francisco)
- Your name?
- Your email for the calendar invite?
- How would you like to pay: now with a card, or pay the cleaner in person at the appointment?"

**Customer:** "456 Castro St, San Francisco, CA 94114. Jane Smith, jane@example.com. I'll pay in person."

---

## Agent confirms before booking

**Agent:** "Here's your booking summary before I confirm:

- **Date:** Saturday, April 18, 2026
- **Time:** 10:00 AM – 1:00 PM (3 hours)
- **Address:** 456 Castro St, San Francisco, CA 94114
- **Name:** Jane Smith
- **Email:** jane@example.com
- **Total:** $120
- **Payment:** In person at the appointment (cash or card)

Shall I proceed?"

**Customer:** "Yes, book it!"

---

## Agent initiates booking (pay-on-completion path)

Tool call: `initiate_booking`
```json
{
  "date": "2026-04-18",
  "startTime": "10:00",
  "hours": 3,
  "address": "456 Castro St, San Francisco, CA 94114",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "payInPerson": true
}
```

Result:
```json
{
  "status": "booked",
  "paymentMethod": "in_person",
  "total": "$120",
  "message": "Cleaning confirmed for 2026-04-18 at 10:00 (3h). Calendar invite sent to jane@example.com. The customer pays $120 to the cleaner at the appointment (cash or card)."
}
```

**Agent:** "You're booked! The calendar invite is on its way to jane@example.com. Please have $120 ready for the cleaner at the end of the session — they take cash or card."

---

## Alternative — Pay now via Stripe (first-time customer)

If the customer had said "I'll pay now":

Tool call: `initiate_booking`
```json
{
  "date": "2026-04-18",
  "startTime": "10:00",
  "hours": 3,
  "address": "456 Castro St, San Francisco, CA 94114",
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

Result (first-time customer):
```json
{
  "status": "checkout_required",
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
  "total": "$120",
  "message": "Share the checkoutUrl with the customer. Their card will be saved; future bookings with email \"jane@example.com\" will charge automatically without a browser."
}
```

**Agent:** "You're almost done! Click this link to complete payment:

https://checkout.stripe.com/pay/cs_test_...

After you pay, you'll get a calendar invite at jane@example.com. The cleaning is 10:00 AM – 1:00 PM on April 18th."

---

## Alternative — Pay now via Stripe (returning customer)

Same `initiate_booking` call, but the email already has a saved card:

```json
{
  "status": "booked",
  "paymentIntentId": "pi_...",
  "total": "$120",
  "message": "Charged the card on file. Cleaning confirmed. Calendar invite sent to jane@example.com."
}
```

**Agent:** "All set — I charged the card on file. Your cleaning is confirmed for April 18th at 10:00 AM, and a calendar invite is on its way to jane@example.com."

---

## Status check (pay-now path)

**Customer:** "Done, paid!"

Optional — call `check_booking_status`:
```json
{ "email": "jane@example.com" }
```

Result:
```json
{
  "email": "jane@example.com",
  "bookings": [
    {
      "status": "booked",
      "date": "2026-04-18",
      "startTime": "10:00",
      "hours": "3",
      "address": "456 Castro St, San Francisco, CA 94114"
    }
  ]
}
```

**Agent:** "You're all set! Your cleaning is confirmed for April 18th at 10:00 AM. Check your email for the calendar invite."

---

## Edge cases

### Address not in SF
**Customer:** "123 Main St, Oakland, CA"
**Agent:** "Sorry, the cleaning service is only available in San Francisco. Do you have an SF address?"

### Slot unavailable
`initiate_booking` returns an `isError` with "That time slot is no longer available."
**Agent:** "That slot was just taken. Let me check what else is available..." — then call `check_availability` for the same date.

### Saved card declined (returning customer)
`initiate_booking` returns:
```json
{
  "status": "charge_failed",
  "error": "Your card was declined.",
  "hint": "The saved card was declined or needs 3DS. Call `force_checkout_booking` with the same arguments to give the customer a fresh checkout URL where they can use another card."
}
```
**Agent:** "Your card on file was declined. Want me to generate a fresh checkout link so you can use a different card?" — on "yes", call `force_checkout_booking` with the same booking arguments and share the returned `checkoutUrl`.

### Refund (race condition, pay-now only)
If a refund is issued, tell the customer: "We're sorry — your slot was taken by another booking right as your payment processed. A full refund has been issued. Let me find you another time."

### Pay-on-completion no-show
Pay-on-completion relies on the customer being there. If they ask to cancel, they can email **connor@getcolby.com** at least 24 hours before the slot. Persistent no-shows may be required to pre-pay on future bookings.
