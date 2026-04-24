/**
 * Unit tests for the pure pieces of the duplicate-phone alert job:
 *   - decideAlerts: dedupe + grow detection
 *   - buildAlertEmail: subject/body shape
 *   - maskPhoneE164: PII masking
 *
 * The DB-touching runDuplicatePhoneAlertJob is exercised manually via the
 * /admin/sms-health/duplicate-phones/run-alerts endpoint.
 */

import {
  decideAlerts,
  buildAlertEmail,
  maskPhoneE164,
} from "../admin/duplicatePhoneAlertJob";
import type { DuplicatePhoneGroup } from "../admin/duplicatePhones";

interface TestResult {
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function check(name: string, cond: boolean, detail = "") {
  results.push({
    passed: cond,
    message: cond ? `PASS ${name}` : `FAIL ${name}${detail ? " — " + detail : ""}`,
  });
}

function group(phone: string, ids: string[]): DuplicatePhoneGroup {
  return {
    phoneE164: phone,
    userCount: ids.length,
    users: ids.map((id) => ({ id, phoneE164: phone })),
  };
}

// --- decideAlerts ---
{
  const current = [group("+15550001111", ["a", "b"]), group("+15550002222", ["c", "d"])];
  const { groupsToAlert, reasons } = decideAlerts(current, []);
  check(
    "new groups with empty history are all flagged 'new'",
    groupsToAlert.length === 2 &&
      reasons["+15550001111"] === "new" &&
      reasons["+15550002222"] === "new",
  );
}
{
  const current = [group("+15550001111", ["a", "b"])];
  const history = [{ phoneE164: "+15550001111", lastUserCount: 2 }];
  const { groupsToAlert } = decideAlerts(current, history);
  check("unchanged group is NOT re-alerted", groupsToAlert.length === 0);
}
{
  const current = [group("+15550001111", ["a", "b", "c"])];
  const history = [{ phoneE164: "+15550001111", lastUserCount: 2 }];
  const { groupsToAlert, reasons } = decideAlerts(current, history);
  check(
    "grown group is re-alerted with reason 'grew'",
    groupsToAlert.length === 1 && reasons["+15550001111"] === "grew",
  );
}
{
  const current = [group("+15550001111", ["a"])]; // shrunk to 1 (would not be a group anyway)
  const history = [{ phoneE164: "+15550001111", lastUserCount: 3 }];
  const { groupsToAlert } = decideAlerts(current, history);
  check("shrunk group is NOT re-alerted", groupsToAlert.length === 0);
}

// --- maskPhoneE164 ---
check(
  "maskPhoneE164 keeps last 4",
  maskPhoneE164("+15551234567") === "+*******4567",
  maskPhoneE164("+15551234567"),
);
check("maskPhoneE164 short-circuits short input", maskPhoneE164("123") === "123");

// --- buildAlertEmail ---
{
  const groupsToAlert = [group("+15550001111", ["a", "b"])];
  const reasons = { "+15550001111": "new" as const };
  const { subject, text, html } = buildAlertEmail(groupsToAlert, reasons);
  check(
    "subject mentions group count",
    subject.includes("1 duplicate phone group"),
    subject,
  );
  check(
    "text body masks the phone",
    text.includes("*1111") && !text.includes("+15550001111"),
  );
  check("text body lists user ids", text.includes("a") && text.includes("b"));
  check("html includes admin link", html.includes("/admin/sms-health"));
}
{
  const groupsToAlert = [
    group("+15550001111", ["a", "b"]),
    group("+15550002222", ["c", "d", "e"]),
  ];
  const reasons = {
    "+15550001111": "new" as const,
    "+15550002222": "grew" as const,
  };
  const { subject } = buildAlertEmail(groupsToAlert, reasons);
  check("subject reports new vs grew breakdown", subject.includes("1 new, 1 grew"), subject);
}

// Reporter
const failed = results.filter((r) => !r.passed);
for (const r of results) console.log(r.message);
if (failed.length > 0) {
  console.error(`\n${failed.length}/${results.length} test(s) failed`);
  process.exit(1);
} else {
  console.log(`\nAll ${results.length} test(s) passed`);
}
