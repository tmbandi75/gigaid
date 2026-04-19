import { pickPayload, resolveAppUserId } from "../../server/revenuecatWebhookPayload";

describe("RevenueCat webhook payload helpers", () => {
  it("unwraps nested event and resolves app_user_id", () => {
    const { payload, nestedEvent } = pickPayload({
      api_version: "1.0",
      event: { type: "INITIAL_PURCHASE", id: "e1", app_user_id: "user-abc" },
    });
    expect(nestedEvent).toBe(true);
    expect(resolveAppUserId(payload)).toBe("user-abc");
  });

  it("falls back to original_app_user_id", () => {
    const { payload } = pickPayload({
      type: "RENEWAL",
      original_app_user_id: "orig-1",
    });
    expect(resolveAppUserId(payload)).toBe("orig-1");
  });

  it("uses first string alias when primary ids missing", () => {
    const { payload } = pickPayload({
      type: "CANCELLATION",
      aliases: ["", "alias-user"],
    });
    expect(resolveAppUserId(payload)).toBe("alias-user");
  });

  it("uses transferred_to for transfer-style payloads", () => {
    const { payload } = pickPayload({
      type: "TRANSFER",
      transferred_to: ["dest-user"],
    });
    expect(resolveAppUserId(payload)).toBe("dest-user");
  });

  it("falls back to transferred_from for TRANSFER when transferred_to empty", () => {
    const { payload } = pickPayload({
      type: "TRANSFER",
      transferred_to: [],
      transferred_from: ["src-user"],
    });
    expect(resolveAppUserId(payload)).toBe("src-user");
  });

  it("returns null for empty payload", () => {
    const { payload } = pickPayload({});
    expect(resolveAppUserId(payload)).toBeNull();
  });
});
