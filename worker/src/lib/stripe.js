import Stripe from 'stripe';

export const RATE_CENTS = 4000; // $40/hour

export function getStripe(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function findCustomerByEmail(env, email) {
  const stripe = getStripe(env);
  const list = await stripe.customers.list({ email, limit: 1 });
  return list.data[0] || null;
}

export async function getOrCreateCustomer(env, { email, name }) {
  const existing = await findCustomerByEmail(env, email);
  if (existing) {
    if (!existing.name && name) {
      const stripe = getStripe(env);
      return stripe.customers.update(existing.id, { name });
    }
    return existing;
  }
  const stripe = getStripe(env);
  return stripe.customers.create({ email, name });
}

export async function createCheckoutSession(env, { customer, date, startTime, hours, address, name, email }) {
  const stripe = getStripe(env);
  const metadata = { date, startTime, hours: String(hours), address, name, email };
  const origin = env.CLAW_CLEANING_ORIGIN || 'https://claw.cleaning';

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: RATE_CENTS,
        product_data: {
          name: 'Apartment Cleaning',
          description: `${hours}h cleaning at ${address}`,
        },
      },
      quantity: hours,
    }],
    payment_intent_data: { metadata },
    metadata,
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cancel`,
  });
}

export async function verifyWebhook(env, body, signature) {
  const stripe = getStripe(env);
  return stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function refundPaymentIntent(env, paymentIntentId) {
  const stripe = getStripe(env);
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

// Back-compat alias used by the webhook handler.
export async function refundSession(env, paymentIntentId) {
  return refundPaymentIntent(env, paymentIntentId);
}

// Returns a time-ordered list of checkout sessions for an email. Used by
// check_booking_status to look up recent bookings.
export async function getBookingsByEmail(env, email, limit = 10) {
  const customer = await findCustomerByEmail(env, email);
  if (!customer) return [];

  const stripe = getStripe(env);
  const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit });
  return sessions.data
    .map(s => ({
      source: 'checkout',
      id: s.id,
      paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id || null,
      paid: s.payment_status === 'paid',
      expired: s.status === 'expired',
      metadata: s.metadata || {},
      created: s.created || 0,
    }))
    .sort((a, b) => b.created - a.created);
}
