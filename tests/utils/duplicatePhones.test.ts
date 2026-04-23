import { groupDuplicatePhones } from "../../server/admin/duplicatePhones";

/**
 * Unit tests for the pure duplicate-phone grouper that powers the
 * /api/admin/sms/duplicate-phones diagnostic. Keeps the grouping +
 * ordering rules locked so the STOP webhook ambiguity report stays
 * predictable for support.
 */
describe("groupDuplicatePhones", () => {
  it("returns no groups when every phone is unique", () => {
    const groups = groupDuplicatePhones([
      { id: "u1", phoneE164: "+15551110001" },
      { id: "u2", phoneE164: "+15551110002" },
      { id: "u3", phoneE164: "+15551110003" },
    ]);
    expect(groups).toEqual([]);
  });

  it("ignores users with null/empty phoneE164 (they aren't shared, just unset)", () => {
    const groups = groupDuplicatePhones([
      { id: "u1", phoneE164: null },
      { id: "u2", phoneE164: null },
      { id: "u3", phoneE164: "" },
      { id: "u4", phoneE164: "  " },
    ]);
    expect(groups).toEqual([]);
  });

  it("groups 2+ users sharing one phone and reports the count", () => {
    const groups = groupDuplicatePhones([
      { id: "u1", phoneE164: "+15551112222", lastActiveAt: "2025-04-01T00:00:00Z" },
      { id: "u2", phoneE164: "+15551112222", lastActiveAt: "2025-04-10T00:00:00Z" },
      { id: "u3", phoneE164: "+15559998888" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].phoneE164).toBe("+15551112222");
    expect(groups[0].userCount).toBe(2);
    // Most-recent lastActiveAt comes first so support can spot the live account.
    expect(groups[0].users.map((u) => u.id)).toEqual(["u2", "u1"]);
  });

  it("orders users with null lastActiveAt last within a group", () => {
    const groups = groupDuplicatePhones([
      { id: "u1", phoneE164: "+15551112222", lastActiveAt: null },
      { id: "u2", phoneE164: "+15551112222", lastActiveAt: "2025-04-10T00:00:00Z" },
      { id: "u3", phoneE164: "+15551112222", lastActiveAt: "2025-04-05T00:00:00Z" },
    ]);
    expect(groups[0].users.map((u) => u.id)).toEqual(["u2", "u3", "u1"]);
  });

  it("orders groups by userCount DESC so the worst offenders surface first", () => {
    const groups = groupDuplicatePhones([
      { id: "a1", phoneE164: "+15550000001" },
      { id: "a2", phoneE164: "+15550000001" },
      { id: "b1", phoneE164: "+15550000002" },
      { id: "b2", phoneE164: "+15550000002" },
      { id: "b3", phoneE164: "+15550000002" },
    ]);
    expect(groups.map((g) => g.phoneE164)).toEqual([
      "+15550000002",
      "+15550000001",
    ]);
    expect(groups.map((g) => g.userCount)).toEqual([3, 2]);
  });
});
