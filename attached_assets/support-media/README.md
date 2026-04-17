# Support Media — Demo Clips

Short, looping demo clips that get embedded in the support manual to make
the most-asked-about flows visually obvious. Each flow ships in two
formats:

- **`.gif`** — animated GIF, used for the Markdown embeds in
  `support-manual.md` so it works anywhere images do (the rendered manual,
  in-app help links, email digests).
- **`.mp4`** — H.264 video, the better choice for the published support
  site (smaller, sharper, and friendlier on data plans). Swap a Markdown
  embed for a `<video>` tag when the surface supports it.

Each clip is a 12-second loop (4 annotated steps × 3 seconds) recorded at
360×720 (phone aspect ratio) and 12 fps.

## Embed mapping

| Flow | GIF (used in manual) | MP4 | Embedded in `support-manual.md` section | Article / topic |
| --- | --- | --- | --- | --- |
| Connecting Stripe | `connect-stripe.gif` | `connect-stripe.mp4` | §5 Invoices & Payments → *Connecting Stripe* | "How do I connect Stripe?" |
| Creating a job from a template | `create-job-from-template.gif` | `create-job-from-template.mp4` | §4 Jobs → *Job templates* | "How do I create a job from a template?" |
| Sharing the booking link | `share-booking-link.gif` | `share-booking-link.mp4` | §2 Booking Link & Public Page → *Sharing your link* | "How do I share my booking link?" |
| Sending an invoice | `send-invoice.gif` | `send-invoice.mp4` | §5 Invoices & Payments → *Sending an invoice* | "How do I send an invoice?" |
| Using Quick Capture | `quick-capture.gif` | `quick-capture.mp4` | §7 AI Features → *Quick Capture* | "What is Quick Capture and how do I use it?" |

## Regenerating

The clips are produced from a single generator so they stay visually
consistent. To rebuild after a copy or layout tweak:

```bash
node attached_assets/support-media/_generate.mjs
```

The generator writes one SVG per step, rasterizes each to PNG with
ImageMagick (`magick`), then assembles the per-flow `.gif` and `.mp4`
with `ffmpeg`. Both `magick` and `ffmpeg` are already on the runtime
path; no extra packages required.

## Notes

These first-pass clips are stylized, hand-built UI walkthroughs (built
from synthetic frames rather than recorded against the live app) so the
support manual ships with visuals immediately. A follow-up task tracks
re-recording each flow against the running GigAid app for higher
fidelity; the file names are intentionally stable so swapping in real
captures will not require any edits to `support-manual.md`.
