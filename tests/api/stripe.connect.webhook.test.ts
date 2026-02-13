import Stripe from "stripe";
import { TEST_BASE_URL, STRIPE_CONNECT_WEBHOOK_SECRET } from "../utils/env";

const BASE_URL = TEST_BASE_URL;
const CONNECT_WEBHOOK_SECRET = STRIPE_CONNECT_WEBHOOK_SECRET;

function generateConnectPayload(
  eventType: string,
  dataObject: Record<string, any>,
  eventId?: string
) {
  return JSON.stringify({
    id:
      eventId ||
      `evt_connect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    livemode: false,
    account: "acct_test_connected",
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

async function sendConnectWebhook(
  payload: string,
  headers: Record<string, string> = {}
) {
  const res = await fetch(`${BASE_URL}/api/stripe/connect/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: payload,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// When STRIPE_CONNECT_WEBHOOK_SECRET is set, the handler verifies signatures
// using req.rawBody (raw Buffer). Tests sign payloads with the real secret.
//
// When no secret is set, the handler falls back to using req.body (parsed
// JSON) directly without signature verification.

const describeNoSecret = !CONNECT_WEBHOOK_SECRET ? describe : describe.skip;
const describeWithSecret = CONNECT_WEBHOOK_SECRET ? describe : describe.skip;

describe("Stripe Connect Webhook (/api/stripe/connect/webhook)", () => {
  describeWithSecret("Signature enforcement (secret configured)", () => {
    it("rejects requests with an invalid signature", async () => {
      const payload = generateConnectPayload("account.updated", {
        id: "acct_fake",
        object: "account",
        metadata: {},
      });
      const { status } = await sendConnectWebhook(payload, {
        "stripe-signature": "t=123,v1=badsig",
      });
      expect(status).toBe(400);
    });

    it("accepts a properly signed event and returns 200", async () => {
      const payload = generateConnectPayload("account.updated", {
        id: "acct_signed_test",
        object: "account",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        metadata: {},
      });
      const signature = signPayload(payload, CONNECT_WEBHOOK_SECRET);
      const { status, data } = await sendConnectWebhook(payload, {
        "stripe-signature": signature,
      });
      expect(status).toBe(200);
      expect(data?.received).toBe(true);
    });
  });

  describeNoSecret(
    "Event processing (no secret — fallback to parsed body)",
    () => {
      it("accepts unsigned requests and processes them", async () => {
        const payload = generateConnectPayload("account.updated", {
          id: "acct_nosecret_test",
          object: "account",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          metadata: {},
        });
        const { status } = await sendConnectWebhook(payload);
        expect(status).toBe(200);
      });

      it("processes account.updated for a connected account", async () => {
        const payload = generateConnectPayload("account.updated", {
          id: "acct_test_updated",
          object: "account",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          metadata: { gigaid_user_id: "nonexistent-user-id" },
        });
        const { status } = await sendConnectWebhook(payload);
        expect(status).toBe(200);
      });

      it("processes payment_intent.succeeded on connected account", async () => {
        const payload = generateConnectPayload("payment_intent.succeeded", {
          id: `pi_connect_success_${Date.now()}`,
          object: "payment_intent",
          status: "succeeded",
          amount: 7500,
          currency: "usd",
          metadata: { booking_id: "888888" },
        });
        const { status } = await sendConnectWebhook(payload);
        expect(status).toBe(200);
      });

      it("processes charge.dispute.created on connected account", async () => {
        const payload = generateConnectPayload("charge.dispute.created", {
          id: `dp_connect_${Date.now()}`,
          object: "dispute",
          charge: "ch_connect_dispute",
          amount: 3000,
          status: "needs_response",
          reason: "product_not_received",
          payment_intent: "pi_connect_dispute",
          metadata: {},
        });
        const { status } = await sendConnectWebhook(payload);
        expect(status).toBe(200);
      });

      it("processes customer.subscription.created", async () => {
        const payload = generateConnectPayload(
          "customer.subscription.created",
          {
            id: `sub_test_${Date.now()}`,
            object: "subscription",
            status: "active",
            customer: "cus_test_sub",
            items: {
              data: [
                { price: { id: "price_test", product: "prod_test" } },
              ],
            },
            metadata: { user_id: "nonexistent-sub-user" },
          }
        );
        const { status } = await sendConnectWebhook(payload);
        expect(status).toBe(200);
      });
    }
  );
});
