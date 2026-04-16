import Stripe from 'stripe';

export function getStripe(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createCheckoutSession(env, { date, startTime, hours, address, name, email }) {
  const stripe = getStripe(env);
  const sessionId = crypto.randomUUID();
  const total = hours * 60; // $60/hour in dollars

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: 6000, // $60 in cents
        product_data: {
          name: 'Apartment Cleaning',
          description: `${hours}h cleaning at ${address}`,
        },
      },
      quantity: hours,
    }],
    mode: 'payment',
    customer_email: email,
    metadata: { date, startTime, hours: String(hours), address, name, email },
    success_url: `${env.CLAWT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.CLAWT_CANCEL_URL,
  });

  return session;
}

export async function verifyWebhook(env, body, signature) {
  const stripe = getStripe(env);
  return stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function refundSession(env, paymentIntentId) {
  const stripe = getStripe(env);
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

export async function getSession(env, sessionId) {
  const stripe = getStripe(env);
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function getSessionsByEmail(env, email, limit = 10) {
  const stripe = getStripe(env);
  const escaped = email.replace(/'/g, "\\'");
  const results = await stripe.checkout.sessions.search({
    query: `customer_details.email:'${escaped}'`,
    limit,
  });
  return results.data.sort((a, b) => (b.created || 0) - (a.created || 0));
}
