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
    // Update the name if Stripe has none yet (first booking set email only, or older record)
    if (!existing.name && name) {
      const stripe = getStripe(env);
      return stripe.customers.update(existing.id, { name });
    }
    return existing;
  }
  const stripe = getStripe(env);
  return stripe.customers.create({ email, name });
}

// Returns { customer, paymentMethod } if the customer has a saved card usable
// for off-session charges. Returns null otherwise.
export async function getCustomerWithSavedCard(env, email) {
  const customer = await findCustomerByEmail(env, email);
  if (!customer) return null;
  const stripe = getStripe(env);

  const defaultPmId = customer.invoice_settings?.default_payment_method;
  if (defaultPmId) {
    const pm = await stripe.paymentMethods.retrieve(defaultPmId);
    if (pm && pm.type === 'card') return { customer, paymentMethod: pm };
  }

  // Fall back to the most recently attached card on the customer
  const pms = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 1 });
  if (pms.data.length) return { customer, paymentMethod: pms.data[0] };
  return null;
}

export async function createCheckoutSession(env, { customer, date, startTime, hours, address, name, email }) {
  const stripe = getStripe(env);
  const metadata = { date, startTime, hours: String(hours), address, name, email };

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
    payment_intent_data: {
      setup_future_usage: 'off_session',
      metadata,
    },
    metadata,
    success_url: `${env.CLAW_CLEANING_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.CLAW_CLEANING_CANCEL_URL,
  });
}

// Charge a customer's saved card off-session. Throws a tagged error on failure.
export async function chargeSavedCard(env, { customer, paymentMethod, hours, date, startTime, address, name, email }) {
  const stripe = getStripe(env);
  const metadata = { date, startTime, hours: String(hours), address, name, email };
  try {
    return await stripe.paymentIntents.create({
      amount: hours * RATE_CENTS,
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethod.id,
      off_session: true,
      confirm: true,
      description: `${hours}h cleaning at ${address} on ${date} at ${startTime}`,
      metadata,
    });
  } catch (err) {
    const raw = err.raw || {};
    const tagged = new Error(raw.message || err.message || 'Payment failed');
    tagged.stripeCode = raw.code || err.code || 'payment_failed';
    tagged.stripeDeclineCode = raw.decline_code || err.decline_code || null;
    tagged.paymentIntentId = raw.payment_intent?.id || err.payment_intent?.id || null;
    tagged.requiresAction = tagged.stripeCode === 'authentication_required';
    throw tagged;
  }
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

export async function getSession(env, sessionId) {
  const stripe = getStripe(env);
  return stripe.checkout.sessions.retrieve(sessionId);
}

// Returns a unified, time-ordered list of bookings for an email, covering both
// Checkout sessions (first-time customers) and direct PaymentIntents (repeat).
// All booking flows create a Customer record first, so we can enumerate both
// resources by customer_id rather than using the (unavailable) search API.
export async function getBookingsByEmail(env, email, limit = 10) {
  const customer = await findCustomerByEmail(env, email);
  if (!customer) return [];

  const stripe = getStripe(env);
  const [sessions, intents] = await Promise.all([
    stripe.checkout.sessions.list({ customer: customer.id, limit }),
    stripe.paymentIntents.list({ customer: customer.id, limit }),
  ]);

  const fromSessions = sessions.data.map(s => ({
    source: 'checkout',
    id: s.id,
    paymentIntentId: typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id || null,
    paid: s.payment_status === 'paid',
    expired: s.status === 'expired',
    metadata: s.metadata || {},
    created: s.created || 0,
  }));

  const sessionPIIds = new Set(fromSessions.map(s => s.paymentIntentId).filter(Boolean));
  const fromIntents = intents.data
    .filter(pi => !sessionPIIds.has(pi.id))
    .map(pi => ({
      source: 'direct',
      id: pi.id,
      paymentIntentId: pi.id,
      paid: pi.status === 'succeeded',
      expired: false,
      metadata: pi.metadata || {},
      created: pi.created || 0,
    }));

  return [...fromSessions, ...fromIntents].sort((a, b) => b.created - a.created);
}
