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

## Real recordings vs. synthetic placeholders

Two of the five clips are **real screen recordings** of the live GigAid
app, captured at a phone-sized viewport (390×844, 24 fps) by driving the
public booking page and the public invoice page with Playwright + ffmpeg
(see `_capture.mjs`). The other three currently remain **synthetic
walkthroughs** — hand-built SVG frames assembled by `_generate.mjs` —
because they live behind Firebase auth (and, for Stripe, an external
Stripe-hosted onboarding page) that cannot be driven from this
environment without real test-account credentials. The filenames are
intentionally stable so swapping in a real capture later does not require
any edits to `support-manual.md`.

## Embed mapping

| Flow | Source | GIF (used in manual) | MP4 | Embedded in `support-manual.md` section | Article / topic |
| --- | --- | --- | --- | --- | --- |
| Connecting Stripe | Synthetic (`_generate.mjs`) | `connect-stripe.gif` | `connect-stripe.mp4` | §5 Invoices & Payments → *Connecting Stripe* | "How do I connect Stripe?" |
| Creating a job from a template | Synthetic (`_generate.mjs`) | `create-job-from-template.gif` | `create-job-from-template.mp4` | §4 Jobs → *Job templates* | "How do I create a job from a template?" |
| Sharing the booking link | **Real capture** (`_capture.mjs`) — customer-side view of `/book/<slug>` | `share-booking-link.gif` | `share-booking-link.mp4` | §2 Booking Link & Public Page → *Sharing your link* | "How do I share my booking link?" |
| Sending an invoice | **Real capture** (`_capture.mjs`) — customer-side view of `/invoice/<token>` | `send-invoice.gif` | `send-invoice.mp4` | §5 Invoices & Payments → *Sending an invoice* | "How do I send an invoice?" |
| Using Quick Capture | Synthetic (`_generate.mjs`) | `quick-capture.gif` | `quick-capture.mp4` | §7 AI Features → *Quick Capture* | "What is Quick Capture and how do I use it?" |
| AI Follow-Up Composer | Synthetic (`_generate.mjs`) | `follow-up-composer.gif` | `follow-up-composer.mp4` | §7 AI Features → *Follow-Up Composer* | "How do I send an AI follow-up to a quiet lead?" |
| Drive Mode | Synthetic (`_generate.mjs`) | `drive-mode.gif` | `drive-mode.mp4` | §4 Jobs → *Drive Mode* | "What is Drive Mode and how do I use it?" |
| Owner View dashboard | Synthetic (`_generate.mjs`) | `owner-view.gif` | `owner-view.mp4` | §7 AI Features → *Owner View* | "What does the Owner View dashboard show me?" |
| Requiring a deposit on bookings | Synthetic (`_generate.mjs`) | `require-deposit.gif` | `require-deposit.mp4` | §2 Booking Link & Public Page → *Requiring a deposit on bookings* | "How do I require a deposit on bookings?" |
| Marking an invoice paid by cash/Zelle | Synthetic (`_generate.mjs`) | `mark-paid-cash.gif` | `mark-paid-cash.mp4` | §5 Invoices & Payments → *Recording cash, Zelle, Venmo, or check* | "How do I mark an invoice paid by cash/Zelle/Venmo/check?" |

## Regenerating

The synthetic clips and the real captures are produced by two separate
scripts so each can be re-run independently.

### Synthetic walkthroughs

```bash
node attached_assets/support-media/_generate.mjs
```

Writes one SVG per step, rasterizes each to PNG with ImageMagick
(`magick`), then assembles the per-flow `.gif` and `.mp4` with `ffmpeg`.
Both `magick` and `ffmpeg` are already on the runtime path; no extra
packages required.

### Real captures (Playwright)

```bash
# In one shell
npm run dev

# In a second shell
PLAYWRIGHT_BROWSERS_PATH=/home/runner/workspace/.cache/ms-playwright \
  node attached_assets/support-media/_capture.mjs
```

The capture script seeds a stable demo user + sample invoice via the
`/api/test/*` helpers, opens each public page in a phone-sized Chromium
context with `recordVideo`, and transcodes the resulting `.webm` to
`.mp4` (H.264, faststart) and `.gif` (palette-optimized 360px @ 12 fps).

## Recording the three remaining flows

To replace the synthetic clips for **Connect Stripe**, **Create Job from
Template**, and **Quick Capture** with real recordings, you need a
signed-in worker session — those screens live behind Firebase auth and,
for Stripe, an external Stripe Connect onboarding page. The cleanest path
is to grab them by hand:

1. Sign in to a real test account on either the iOS/Android build (use
   the device's built-in screen recorder) or the web app in Chrome
   (Cmd/Ctrl-Shift-5 on macOS, OBS on other platforms).
2. Set the recording region to a phone-shaped viewport (around 390×844
   in Chrome devtools' device toolbar) so the new clip mixes in cleanly
   with the existing ones.
3. Walk through each flow end-to-end:
   - **Connect Stripe** — More → Settings → Get Paid → tap **Connect
     Stripe**, complete the Stripe onboarding form, return to the
     "Stripe connected" success state.
   - **Create Job from Template** — Jobs tab → tap the **+** → pick a
     template → fill in customer + date → **Save Job** → land on the
     Jobs list with the new card.
   - **Quick Capture** — More → Quick Capture (or the **+** in the
     header) → record a short voice memo (or paste text) → review the
     AI-suggested actions → tap **Create lead**.
4. Trim each recording to roughly 12 seconds, export as MP4 + GIF (e.g.
   with `ffmpeg`), and drop them in this directory using the existing
   filenames (`connect-stripe.{mp4,gif}` etc.). No changes to
   `support-manual.md` are needed because the embed paths are stable.
