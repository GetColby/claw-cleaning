# Apartment Cleaning — Full Example Booking Flow

All interactions go through the `claw-cleaning` MCP server at `https://claw.cleaning/mcp`. The agent never runs a local CLI and never crafts HTTP calls by hand — it calls MCP tools.

No payment is collected up front. The customer pays the cleaner (cash or card) at the appointment.

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

Rate is $40/hour, paid to the cleaner at the appointment. Which time works for you?"

---

## Customer selects a slot

**Customer:** "Saturday at 10, I need 3 hours"

**Agent:** "Got it — 3 hours at $120 total, paid to the cleaner. A few more things:
- What's the full address? (Must be in San Francisco)
- Your name?
- Your email for the calendar invite?"

**Customer:** "456 Castro St, San Francisco, CA 94114. Jane Smith, jane@example.com."

---

## Agent confirms before booking

**Agent:** "Here's your booking summary before I confirm:

- **Date:** Saturday, April 18, 2026
- **Time:** 10:00 AM – 1:00 PM (3 hours)
- **Address:** 456 Castro St, San Francisco, CA 94114
- **Name:** Jane Smith
- **Email:** jane@example.com
- **Total:** $120 (cash or card to the cleaner at the appointment)

Shall I proceed?"

**Customer:** "Yes, book it!"

---

## Agent initiates booking

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

Result:
```json
{
  "status": "booked",
  "total": "$120",
  "date": "2026-04-18",
  "startTime": "10:00",
  "hours": 3,
  "address": "456 Castro St, San Francisco, CA 94114",
  "email": "jane@example.com",
  "message": "Cleaning confirmed for 2026-04-18 at 10:00 (3h). Calendar invite sent to jane@example.com. The customer pays $120 to the cleaner at the appointment (cash or card)."
}
```

**Agent:** "You're booked! The calendar invite is on its way to jane@example.com. Please have $120 ready for the cleaner at the end of the session — they take cash or card."

---

## Status check

**Customer:** "Did that go through?"

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
      "date": "2026-04-18",
      "startTime": "10:00",
      "hours": 3,
      "address": "456 Castro St, San Francisco, CA 94114",
      "eventId": "..."
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

### Email blocked
`initiate_booking` returns an `isError` with "This email is blocked from booking."
**Agent:** "Your email has been blocked from booking through this service, usually because of a past no-show. Please contact the operator at connor@getcolby.com."

### No-show policy
If the customer asks to cancel, they can email **connor@getcolby.com** at least 24 hours before the slot. Persistent no-shows may result in the email being blocked from future bookings.
