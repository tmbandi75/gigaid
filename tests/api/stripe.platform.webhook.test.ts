import Stripe from "stripe";
import { TEST_BASE_URL, STRIPE_WEBHOOK_SECRET } from "../utils/env";

const BASE_URL = TEST_BASE_URL;
const WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;

function generateWebhookPayload(
  eventType: string,
  dataObject: Record<string, any>,
  eventId?: string
) {
  return JSON.stringify({
    id:
      eventId ||
      `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
    data: { object: dataObject },
  });
}

function signPayload(payload: string, secret: string): string {
  const stripe = new Stripe("sk_test_fake");
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
}

async function sendRawWebhook(
  payload: string,
  headers: Record<string, string> = {}
) {
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: payload,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe("Stripe Platform Webhook (/api/stripe/webhook)", () => {
  describe("Webhook secret configured", () => {
    it("server has STRIPE_WEBHOOK_SECRET configured (returns 400 not 500)", async () => {
      const { status, data } = await sendRawWebhook("{}", {
        "stripe-signature": "t=1234567890,v1=invalidsignature",
      });
      expect(status).toBe(400);
      expect(data?.error).toMatch(/webhook/i);
    });
  });

  describe("Signature enforcement", () => {
    it("rejects requests without stripe-signature header", async () => {
      const payload = generateWebhookPayload("payment_intent.created", {
        id: "pi_nosig",
      });
      const { status, data } = await sendRawWebhook(payload);
      expect(status).toBe(400);
      expect(data?.error).toMatch(/signature/i);
    });

    it("rejects requests with malformed signature header", async () => {
      const payload = generateWebhookPayload("payment_intent.created", {
        id: "pi_badsig",
      });
      const { status } = await sendRawWebhook(payload, {
        "stripe-signature": "not-a-real-signature",
      });
      expect(status).toBe(400);
    });

    it("rejects requests with wrong signature value", async () => {
      const payload = generateWebhookPayload("payment_intent.created", {
        id: "pi_wrongsig",
      });
      const { status, data } = await sendRawWebhook(payload, {
        "stripe-signature":
          "t=1234567890,v1=0000000000000000000000000000000000000000000000000000000000000000",
      });
      expect(status).toBe(400);
      expect(data?.error).toMatch(/webhook error/i);
    });
  });

  describe("Valid signature handling", () => {
    const describeWithSecret = WEBHOOK_SECRET ? describe : describe.skip;

    describeWithSecret(
      "end-to-end with correctly signed payloads",
      () => {
        it("accepts a properly signed event and returns 200", async () => {
          const eventId = `evt_valid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const payload = generateWebhookPayload(
            "payment_intent.created",
            {
              id: `pi_valid_${Date.now()}`,
              object: "payment_intent",
              status: "requires_payment_method",
              amount: 5000,
              currency: "usd",
              metadata: {},
            },
            eventId
          );

          const signature = signPayload(payload, WEBHOOK_SECRET);
          const { status, data } = await sendRawWebhook(payload, {
            "stripe-signature": signature,
          });

          expect(status).toBe(200);
          expect(data?.received).toBe(true);
        });

        it("rejects replayed events with a different body", async () => {
          const eventId = `evt_replay_${Date.now()}`;
          const originalPayload = generateWebhookPayload(
            "payment_intent.created",
            { id: "pi_original", amount: 1000 },
            eventId
          );
          const signature = signPayload(originalPayload, WEBHOOK_SECRET);

          const tamperedPayload = generateWebhookPayload(
            "payment_intent.created",
            { id: "pi_original", amount: 99999 },
            eventId
          );

          const { status } = await sendRawWebhook(tamperedPayload, {
            "stripe-signature": signature,
          });
          expect(status).toBe(400);
        });

        it("deduplicates events with the same stripe event ID", async () => {
          const eventId = `evt_dedup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const payload = generateWebhookPayload(
            "payment_intent.processing",
            {
              id: `pi_dedup_${Date.now()}`,
              object: "payment_intent",
              status: "processing",
              amount: 2000,
              currency: "usd",
              metadata: {},
            },
            eventId
          );

          const signature = signPayload(payload, WEBHOOK_SECRET);
          const headers = { "stripe-signature": signature };

          const first = await sendRawWebhook(payload, headers);
          expect(first.status).toBe(200);
          expect(first.data?.received).toBe(true);

          const second = await sendRawWebhook(payload, headers);
          expect(second.status).toBe(200);
          expect(second.data?.duplicate).toBe(true);
        });
      }
    );
  });
});
