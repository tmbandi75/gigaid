# App Store Review Notes

Paste the text below into the **"Notes for Review"** field in App Store Connect when submitting your build.

---

## REVIEW NOTES — Gig Aid v1.0.0

### Demo Account

- Email: reviewer@gigaid.ai
- Password: GigaidReview2026!
- No MFA or CAPTCHA is required to sign in.
- The account is pre-loaded with sample clients, jobs, and invoices so you can explore the full app experience immediately.
- This account has an active Pro subscription so all features are accessible.

### How to Test

1. Launch the app and tap "Continue with Email"
2. Enter the demo credentials above
3. You will land on the Dashboard with sample data
4. Navigate via the bottom tabs: Plan (dashboard), Jobs, Requests (leads), Get Paid (invoices), and More
5. Settings > Account & Security contains account deletion and data export
6. Settings > Subscription contains "Restore Access" for subscription recovery after reinstall

### Payment Model — Guideline 3.1.3(b)

Gig Aid is a business tool for real-world service professionals (plumbers, cleaners, electricians, handymen). All payments processed through Stripe are for **physical, real-world services** performed at client locations — not digital goods or digital content.

Per App Store Review Guideline 3.1.3(b), apps that facilitate payments for physical goods and services rendered outside the app may use external payment systems. No digital content, subscriptions for digital features, or in-app unlocks are sold through Stripe.

The Pro subscription unlocks business management tools (more job slots, advanced invoicing, lead tracking) that support the user's real-world service business. These are productivity tools for managing physical service work, not digital content consumption.

### Account Deletion — Guideline 5.1.1

Users can delete their account from:
**Settings > Account & Security > Delete Account**

The deletion process:
- Days 0–30: Account disabled, data hidden but recoverable if the user changes their mind
- Days 30–150: Account archived, minimal data retained for legal/financial obligations
- Day 150+: Permanent deletion of all personal data
- Stripe Connect and Stripe Customer records are cleaned up immediately
- Firebase Authentication credentials are deleted immediately
- Re-login is blocked after deletion

### Privacy & Analytics

- Analytics (PostHog) initializes **only after user consent** via an in-app consent modal
- On iOS, the ATT (App Tracking Transparency) prompt is shown before any tracking
- If the user denies tracking, all identifier-based analytics are fully disabled
- No advertising SDKs are used; we do not serve ads
- The IDFA is not used for advertising purposes
- Privacy Policy is accessible at /privacy within the app and discloses all third-party SDKs

### Data Export

Users can export all their data as JSON from:
**Settings > Data Export > Download JSON**

### Permissions Requested

All permissions have clear, purpose-driven usage descriptions in Info.plist:
- Camera: Job site photos and invoice documentation
- Microphone: Voice notes for job details
- Photo Library: Upload/save job and invoice photos
- Location: Find client addresses and provide directions to job sites
- Tracking (ATT): Product analytics only, with full opt-out support

### Offline Support

The app works offline for core actions (adding notes, updating job status). Data syncs automatically when connectivity is restored.

### Accessibility

- All icon-only buttons have accessible labels
- All toggle switches have accessible labels
- Touch targets meet the 44pt minimum
- Keyboard navigation is supported
- Dark mode is fully supported
