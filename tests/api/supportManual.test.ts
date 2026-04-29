/**
 * Integration coverage for Task #230.
 *
 * Task #221 added a unit test for the pure rewrite helper
 * (`tests/api/supportManualMedia.unit.test.ts`), but that doesn't catch a
 * regression at the *route* level — e.g. someone removing the call to
 * `rewriteSupportMediaGifsToVideo`, renaming the `?raw=1` escape hatch, or
 * changing the response headers the marketing site relies on.
 *
 * These tests hit the running server's `GET /support-manual.md` endpoint and
 * assert the wiring end-to-end:
 *   - Default response: 200, text/markdown, CORS+cache headers, GIF embeds
 *     swapped for `<video>` blocks (one per known clip).
 *   - `?raw=1` escape hatch: 200, identical content-type, but the original
 *     unmodified markdown (GIF embeds intact, no `<video>` blocks).
 */

import { TEST_BASE_URL } from "../utils/env";

const BASE_URL = TEST_BASE_URL;

const EXPECTED_CLIP_COUNT = 10;

describe("GET /support-manual.md (public site swap)", () => {
  it("rewrites every support-media GIF embed into a <video> block with the right headers", async () => {
    const res = await fetch(`${BASE_URL}/support-manual.md`);
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toMatch(/^text\/markdown/);
    expect(contentType.toLowerCase()).toContain("charset=utf-8");

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const cacheControl = res.headers.get("cache-control") || "";
    expect(cacheControl).toMatch(/public/);
    expect(cacheControl).toMatch(/max-age=\d+/);

    const body = await res.text();

    const gifEmbeds = body.match(/!\[[^\]]*\]\(support-media\/[A-Za-z0-9_\-]+\.gif\)/g) || [];
    expect(gifEmbeds).toHaveLength(0);

    const videoOpens = body.match(/<video\b/g) || [];
    expect(videoOpens).toHaveLength(EXPECTED_CLIP_COUNT);

    const mp4Sources = body.match(/<source src="support-media\/[A-Za-z0-9_\-]+\.mp4" type="video\/mp4">/g) || [];
    expect(mp4Sources).toHaveLength(EXPECTED_CLIP_COUNT);

    // Every <video> should have a matching <source> for an MP4 clip — i.e. the
    // open count, source count, and close count line up. Catches partial
    // rewrites where the regex matched the open tag but lost a child.
    const videoCloses = body.match(/<\/video>/g) || [];
    expect(videoCloses).toHaveLength(EXPECTED_CLIP_COUNT);
  });

  it("returns the unmodified markdown when ?raw=1 is set", async () => {
    const res = await fetch(`${BASE_URL}/support-manual.md?raw=1`);
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toMatch(/^text\/markdown/);

    const body = await res.text();

    const gifEmbeds = body.match(/!\[[^\]]*\]\(support-media\/[A-Za-z0-9_\-]+\.gif\)/g) || [];
    expect(gifEmbeds).toHaveLength(EXPECTED_CLIP_COUNT);

    const videoOpens = body.match(/<video\b/g) || [];
    expect(videoOpens).toHaveLength(0);
  });
});
