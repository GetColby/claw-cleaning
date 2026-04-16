# Apartment Cleaning — Full Example Booking Flow

## Customer starts

**Customer:** "Hey, I want to book an apartment cleaning"

**Agent:** "Great! Let me check what's available this weekend."

```bash
clawt availability
```

Output:
```
Saturday, April 19, 2026
  ✓ 09:00 — up to 5h (until 2:00 PM) — $300 max
  ✓ 10:00 — up to 4h (until 2:00 PM) — $240 max
  ✓ 14:00 — up to 3h (until 5:00 PM) — $180 max

Sunday, April 20, 2026
  ✓ 09:00 — up to 8h (until 5:00 PM) — $480 max
```

**Agent:** "Here's what's open this weekend:

**Saturday, April 19:**
- 9:00 AM (up to 5 hours, max $300)
- 10:00 AM (up to 4 hours, max $240)
- 2:00 PM (up to 3 hours, max $180)

**Sunday, April 20:**
- 9:00 AM (up to 8 hours, max $480)

Rate is $60/hour. Which time works for you?"

---

## Customer selects a slot

**Customer:** "Saturday at 10, I need 3 hours"

**Agent:** "Got it — 3 hours at $180 total. A few more things:
- What's the full address? (Must be in San Francisco)
- Your name?
- Your email for the calendar invite?"

**Customer:** "456 Castro St, San Francisco, CA 94114. Jane Smith, jane@example.com"

---

## Agent confirms before booking

**Agent:** "Here's your booking summary before I confirm:

- **Date:** Saturday, April 19, 2026
- **Time:** 10:00 AM – 1:00 PM (3 hours)
- **Address:** 456 Castro St, San Francisco, CA 94114
- **Name:** Jane Smith
- **Email:** jane@example.com
- **Total:** $180

Shall I proceed?"

**Customer:** "Yes, book it!"

---

## Agent initiates booking

```bash
clawt book \
  --date 2026-04-19 \
  --start 10:00 \
  --hours 3 \
  --address "456 Castro St, San Francisco, CA 94114" \
  --name "Jane Smith" \
  --email "jane@example.com"
```

Output:
```
✓ Slot is available!

Complete payment to confirm your booking:

  https://checkout.stripe.com/pay/cs_test_...

Session ID: cs_test_abc123
Check status: clawt status --session cs_test_abc123
After payment, you will receive a calendar invite at jane@example.com.
```

**Agent:** "You're almost done! Click this link to complete payment:

https://checkout.stripe.com/pay/cs_test_...

After you pay, you'll get a calendar invite at jane@example.com. The cleaning is 10:00 AM – 1:00 PM on April 19th."

---

## Customer confirms payment

**Customer:** "Done, paid!"

**Agent:** *(optional status check)*

```bash
clawt status --session cs_test_abc123
```

Output:
```
Booking status: ✅ Confirmed and booked!
  Date:  2026-04-19
  Time:  10:00 (3h)
  Address: 456 Castro St, San Francisco, CA 94114
```

**Agent:** "You're all set! Your cleaning is confirmed for April 19th at 10:00 AM. Check your email for the calendar invite."

---

## Edge cases

### Address not in SF
**Customer:** "123 Main St, Oakland, CA"
**Agent:** "Sorry, the cleaning service is only available in San Francisco. Do you have an SF address?"

### Slot unavailable (409)
```
✗ Booking failed: That time slot is no longer available.
```
**Agent:** "That slot was just taken. Let me check what else is available..."
```bash
clawt availability --date 2026-04-19
```

### Refund (race condition)
If a refund is issued, tell the customer: "We're sorry — your slot was taken by another booking right as your payment processed. A full refund has been issued. Let me find you another time."
