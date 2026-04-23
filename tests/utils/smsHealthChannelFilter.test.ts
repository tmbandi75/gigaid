import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression guard for Task 47.
 *
 * The /api/admin/sms/summary endpoint must only count outbound_messages with
 * channel='sms'. If someone removes the channel filter from either the
 * canceled or failed aggregate query, the SMS Health tiles silently start
 * including email / in-app rows. This test reads the route source and asserts
 * the filter is present in both query blocks.
 */
describe("Admin SMS health summary — channel scoping", () => {
  const source = readFileSync(
    resolve(__dirname, "../../server/admin/smsHealthRoutes.ts"),
    "utf8",
  );

  it("scopes the canceled-in-7d query to SMS only", () => {
    const canceledBlock = source.slice(
      source.indexOf("// Cancellations in the last 7d"),
      source.indexOf("const canceledByReason"),
    );
    expect(canceledBlock).toMatch(/eq\(outboundMessages\.channel,\s*["']sms["']\)/);
    expect(canceledBlock).toMatch(/eq\(outboundMessages\.status,\s*["']canceled["']\)/);
  });

  it("scopes the failed-in-7d query to SMS only", () => {
    const failedBlock = source.slice(
      source.indexOf("// Failed sends in the last 7d"),
      source.indexOf("const failedByReason"),
    );
    expect(failedBlock).toMatch(/eq\(outboundMessages\.channel,\s*["']sms["']\)/);
    expect(failedBlock).toMatch(/eq\(outboundMessages\.status,\s*["']failed["']\)/);
  });
});
