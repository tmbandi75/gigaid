/**
 * Regression coverage for Task #221.
 *
 * The on-disk support manual embeds each demo clip as a Markdown image
 * pointing at the matching `.gif`, because GIFs work on every Markdown-only
 * surface (in-app help, email digests, etc.). The published support site, by
 * contrast, can render raw HTML — so we swap each GIF embed for a sharper,
 * smaller `.mp4` served via a `<video autoplay muted loop playsinline>` tag.
 *
 * These tests pin down the exact swap so it cannot regress: the MP4 source
 * must be wired up, the GIF must remain as the `poster` and as the inner
 * `<img>` fallback (so browsers that block autoplay still show the demo),
 * the alt text must be HTML-escaped, and surrounding markdown must be
 * untouched.
 */

import { rewriteSupportMediaGifsToVideo } from "../../server/supportManualMedia";

describe("rewriteSupportMediaGifsToVideo", () => {
  it("swaps a support-media GIF embed for a <video> pointing at the matching MP4", () => {
    const input =
      "![Drive Mode — animated walkthrough](support-media/drive-mode.gif)";
    const out = rewriteSupportMediaGifsToVideo(input);

    expect(out).toContain("<video");
    expect(out).toContain("autoplay");
    expect(out).toContain("muted");
    expect(out).toContain("loop");
    expect(out).toContain("playsinline");
    expect(out).toContain('<source src="support-media/drive-mode.mp4" type="video/mp4">');
    expect(out).not.toMatch(/!\[[^\]]*\]\(support-media\/drive-mode\.gif\)/);
  });

  it("uses the matching GIF as the poster so blocked-autoplay browsers still see the demo", () => {
    const input =
      "![Owner View dashboard — animated walkthrough](support-media/owner-view.gif)";
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toContain('poster="support-media/owner-view.gif"');
  });

  it("includes the GIF as an inner <img> fallback for browsers without <video> support", () => {
    const input =
      "![Connecting Stripe — animated walkthrough](support-media/connect-stripe.gif)";
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toMatch(
      /<img src="support-media\/connect-stripe\.gif" alt="Connecting Stripe — animated walkthrough"/,
    );
  });

  it("preserves alt text on both aria-label and the fallback <img>", () => {
    const alt = "What your customer sees on your booking link — real screen recording";
    const input = `![${alt}](support-media/share-booking-link.gif)`;
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toContain(`aria-label="${alt}"`);
    expect(out).toContain(`alt="${alt}"`);
  });

  it("HTML-escapes alt text so a manual edit with quotes or angle brackets cannot break out of attributes", () => {
    const input =
      '![A "tricky" <alt> & friend](support-media/quick-capture.gif)';
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toContain(
      'aria-label="A &quot;tricky&quot; &lt;alt&gt; &amp; friend"',
    );
    expect(out).toContain(
      'alt="A &quot;tricky&quot; &lt;alt&gt; &amp; friend"',
    );
    // Critically, the raw quote must not appear inside an attribute and break out of it.
    expect(out).not.toMatch(/aria-label="[^"]*"[^>]*tricky/);
  });

  it("rewrites every GIF embed in a manual-shaped document and leaves prose untouched", () => {
    const input = [
      "# Booking",
      "",
      "Some prose.",
      "",
      "![Sharing the booking link](support-media/share-booking-link.gif)",
      "",
      "More prose with a regular [link](https://example.com).",
      "",
      "![Requiring a deposit](support-media/require-deposit.gif)",
      "",
      "Final paragraph.",
    ].join("\n");

    const out = rewriteSupportMediaGifsToVideo(input);

    expect(out).toContain("# Booking");
    expect(out).toContain("Some prose.");
    expect(out).toContain("[link](https://example.com)");
    expect(out).toContain("Final paragraph.");
    expect(out).toContain('<source src="support-media/share-booking-link.mp4"');
    expect(out).toContain('<source src="support-media/require-deposit.mp4"');
    expect(out).not.toMatch(/!\[[^\]]*\]\(support-media\/[A-Za-z0-9_\-]+\.gif\)/);
  });

  it("does not touch image embeds outside the support-media directory", () => {
    const input = "![Logo](images/logo.gif)\n\n![Diagram](other/path/foo.gif)";
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toBe(input);
  });

  it("does not touch non-GIF support-media embeds (e.g. PNG screenshots)", () => {
    const input = "![Screenshot](support-media/owner-view.png)";
    const out = rewriteSupportMediaGifsToVideo(input);
    expect(out).toBe(input);
  });

  it("is a no-op when there are no embeds to rewrite", () => {
    const input = "# Title\n\nJust text, no embeds.";
    expect(rewriteSupportMediaGifsToVideo(input)).toBe(input);
  });
});
