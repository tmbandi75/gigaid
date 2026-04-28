/**
 * Unit tests for the slug retry helper. The helper is the application-side
 * half of the slug-uniqueness contract — the DB-side half (the partial
 * unique index) is exercised separately in `tests/api/usersSlugUniqueIndex.test.ts`.
 *
 * Together they guarantee that two simultaneous writers can never end up
 * with the same `users.public_profile_slug`.
 */

import {
  isSlugUniqueViolation,
  writeUserSlugWithRetry,
} from "../../server/lib/bookingSlug";

function pgUniqueViolation(constraint: string, message?: string): Error {
  const err = new Error(
    message ?? `duplicate key value violates unique constraint "${constraint}"`,
  ) as any;
  err.code = "23505";
  err.constraint = constraint;
  err.detail = `Key (public_profile_slug)=(...) already exists.`;
  return err;
}

describe("isSlugUniqueViolation", () => {
  it("matches a 23505 error tagged with the slug constraint", () => {
    expect(
      isSlugUniqueViolation(
        pgUniqueViolation("users_public_profile_slug_unique_idx"),
      ),
    ).toBe(true);
  });

  it("matches when the column name only appears in the detail/message", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "some_other_idx_name"',
    ) as any;
    err.code = "23505";
    err.detail = "Key (public_profile_slug)=(larry-payne) already exists.";
    expect(isSlugUniqueViolation(err)).toBe(true);
  });

  it("ignores a 23505 on an unrelated unique column (e.g. username)", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "users_username_unique"',
    ) as any;
    err.code = "23505";
    err.constraint = "users_username_unique";
    err.detail = "Key (username)=(jdoe) already exists.";
    expect(isSlugUniqueViolation(err)).toBe(false);
  });

  it("ignores non-unique-violation errors and non-errors", () => {
    expect(isSlugUniqueViolation(new Error("boom"))).toBe(false);
    expect(isSlugUniqueViolation(null)).toBe(false);
    expect(isSlugUniqueViolation(undefined)).toBe(false);
    expect(isSlugUniqueViolation("oops")).toBe(false);
  });

  it("walks .cause for wrapped pg errors", () => {
    const inner = pgUniqueViolation("users_public_profile_slug_unique_idx");
    const outer = new Error("transaction failed") as any;
    outer.cause = inner;
    expect(isSlugUniqueViolation(outer)).toBe(true);
  });
});

describe("writeUserSlugWithRetry", () => {
  it("returns the base slug when the write succeeds first try", async () => {
    const write = jest.fn().mockResolvedValue("ok");
    const out = await writeUserSlugWithRetry("larry-payne", write);
    expect(out.slug).toBe("larry-payne");
    expect(out.result).toBe("ok");
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("larry-payne");
  });

  it("advances suffix and retries when the write hits a slug unique violation", async () => {
    const taken = new Set(["larry-payne", "larry-payne-2"]);
    const write = jest.fn(async (slug: string) => {
      if (taken.has(slug)) {
        throw pgUniqueViolation("users_public_profile_slug_unique_idx");
      }
      return { slug };
    });

    const out = await writeUserSlugWithRetry("larry-payne", write);
    expect(out.slug).toBe("larry-payne-3");
    expect(write.mock.calls.map((c) => c[0])).toEqual([
      "larry-payne",
      "larry-payne-2",
      "larry-payne-3",
    ]);
  });

  it("uses the optional checkExists pre-probe to skip known-taken candidates", async () => {
    const taken = new Set(["larry-payne", "larry-payne-2"]);
    const checkExists = jest.fn(async (s: string) => taken.has(s));
    const write = jest.fn(async (slug: string) => ({ slug }));

    const out = await writeUserSlugWithRetry("larry-payne", write, {
      checkExists,
    });
    expect(out.slug).toBe("larry-payne-3");
    // Pre-probe walks 'larry-payne' (taken), 'larry-payne-2' (taken),
    // 'larry-payne-3' (free) — so write is called once with -3.
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("larry-payne-3");
  });

  it("re-throws any non-slug error untouched (e.g. a different unique column)", async () => {
    const usernameViolation = pgUniqueViolation(
      "users_username_unique",
      'duplicate key value violates unique constraint "users_username_unique"',
    );
    (usernameViolation as any).detail = "Key (username)=(x) already exists.";
    (usernameViolation as any).constraint = "users_username_unique";
    const write = jest.fn().mockRejectedValue(usernameViolation);
    await expect(
      writeUserSlugWithRetry("larry-payne", write),
    ).rejects.toBe(usernameViolation);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("falls back to a timestamp suffix once maxAttempts is exhausted", async () => {
    // Force every numbered candidate to collide so we exercise the escape
    // hatch. With maxAttempts=3 the helper tries: base, base-2, base-3,
    // then base-<timestamp>; that fourth attempt also throws and bubbles up.
    const write = jest.fn(async () => {
      throw pgUniqueViolation("users_public_profile_slug_unique_idx");
    });
    await expect(
      writeUserSlugWithRetry("popular", write, { maxAttempts: 3 }),
    ).rejects.toMatchObject({ code: "23505" });
    expect(write).toHaveBeenCalledTimes(4);
    // The last attempt should have used the timestamp escape-hatch shape.
    const last = write.mock.calls[write.mock.calls.length - 1][0] as string;
    expect(last).toMatch(/^popular-[a-z0-9]{1,4}$/);
    expect(last).not.toBe("popular-2");
    expect(last).not.toBe("popular-3");
  });
});
