import { verifyWebhook, refundSession, getStripe } from '../lib/stripe.js';
import { isSlotFree, createBookingEvents } from '../lib/calendar.js';

export async function handleStripeWebhook(c) {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header.' }, 400);
  }

  const rawBody = await c.req.text();
  let event;
  try {
    event = await verifyWebhook(c.env, rawBody, signature);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return c.json({ error: 'Invalid webhook signature.' }, 400);
  }

  if (event.type !== 'checkout.session.completed') {
    return c.json({ received: true });
  }

  const session = event.data.object;
  const { date, startTime, hours, address, name, email } = session.metadata;
  const hoursNum = parseInt(hours, 10);

  try {
    const free = await isSlotFree(c.env, date, startTime, hoursNum);

    if (!free) {
      // Race condition: slot was taken — refund immediately
      console.warn(`Slot taken after payment for session ${session.id}, issuing refund.`);
      if (session.payment_intent) {
        await refundSession(c.env, session.payment_intent);
      }
      // TODO: send apology email to customer
      return c.json({ received: true, action: 'refunded' });
    }

    await createBookingEvents(c.env, { date, startTime, hours: hoursNum, address, name, email });

    // Update session metadata to mark as booked (best-effort via Stripe metadata)
    const stripe = getStripe(c.env);
    await stripe.checkout.sessions.update(session.id, {
      metadata: { ...session.metadata, calendarBooked: 'true' },
    });

    console.log(`Booking confirmed: ${name} on ${date} at ${startTime} for ${hours}h`);
    return c.json({ received: true, action: 'booked' });
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Return 200 to prevent Stripe retries for non-transient errors
    return c.json({ received: true, error: err.message });
  }
}
