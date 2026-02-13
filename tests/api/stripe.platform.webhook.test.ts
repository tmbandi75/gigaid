const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

function generateWebhookPayload(eventType: string, dataObject: Record<string, any>, eventId?: string) {
  return JSON.stringify({
    id: eventId || `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: 'event',
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
    data: { object: dataObject },
  });
}

async function sendRawWebhook(payload: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: payload,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe('Stripe Platform Webhook (/api/stripe/webhook)', () => {

  describe('Webhook secret configured', () => {
    it('server has STRIPE_WEBHOOK_SECRET configured (returns 400 not 500)', async () => {
      const { status, data } = await sendRawWebhook('{}', {
        'stripe-signature': 't=1234567890,v1=invalidsignature',
      });
      expect(status).toBe(400);
      expect(data?.error).toMatch(/webhook/i);
    });
  });

  describe('Signature enforcement', () => {
    it('rejects requests without stripe-signature header', async () => {
      const payload = generateWebhookPayload('payment_intent.created', { id: 'pi_nosig' });
      const { status, data } = await sendRawWebhook(payload);
      expect(status).toBe(400);
      expect(data?.error).toMatch(/signature/i);
    });

    it('rejects requests with malformed signature header', async () => {
      const payload = generateWebhookPayload('payment_intent.created', { id: 'pi_badsig' });
      const { status } = await sendRawWebhook(payload, {
        'stripe-signature': 'not-a-real-signature',
      });
      expect(status).toBe(400);
    });

    it('rejects requests with wrong signature value', async () => {
      const payload = generateWebhookPayload('payment_intent.created', { id: 'pi_wrongsig' });
      const { status, data } = await sendRawWebhook(payload, {
        'stripe-signature': 't=1234567890,v1=0000000000000000000000000000000000000000000000000000000000000000',
      });
      expect(status).toBe(400);
      expect(data?.error).toMatch(/webhook error/i);
    });
  });

  // TODO: Signature verification with valid test-signed payloads cannot be
  // tested end-to-end right now. The global express.json() middleware in
  // server/index.ts parses req.body into a JS object before the route-level
  // raw() middleware in stripeWebhookRoutes.ts runs. Stripe's constructEvent
  // requires a raw string/Buffer. Fix: use req.rawBody (already stored by
  // the express.json verify callback) in constructEvent instead of req.body.
  // Once fixed, add tests here that use Stripe.webhooks.generateTestHeaderString
  // to verify event receipt, idempotency, and per-event-type processing.
});
