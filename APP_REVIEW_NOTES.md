# App Store Review Notes

Paste the text below into the **"Notes for Review"** field in App Store Connect when submitting your build.

---

## REVIEW NOTES — Gig Aid (resubmission)

### Guideline 4.8 — Sign in with Apple (equivalent login)

**Sign in with Apple** is offered on the **first sign-in screen** as the **top** option, before Google and email. It satisfies Guideline 4.8 (limited data, Hide My Email where the user chooses it, no ad profiling by Apple as the login provider).

**How to test:** On launch, tap **Continue with Apple** and complete the system sheet. You can also use **Continue with Google** or **Continue with Email** on the same screen.

### Demo account (email path)

- Email: reviewer@gigaid.ai  
- Password: GigaidReview2026!  
- No MFA or CAPTCHA. Sample data is pre-loaded. The account has Pro access for feature testing.

### Guideline 3.1.1 — Subscriptions and In-App Purchase

On **iOS and Android**, **paid plan upgrades** are completed with **in-app purchase** (StoreKit / Google Play billing via RevenueCat). **Stripe / web checkout is not offered for new mobile subscriptions** from the app.

**Web:** Users who use the website can subscribe with Stripe as before.

**How to test IAP:** Sign in → **Settings** → **Subscription** (or **Pricing**) → choose a higher plan → complete the **App Store** purchase sheet. Use a Sandbox Apple ID if needed.

### Guideline 5.1.1(iv) — App Tracking Transparency

We **do not** show a launch-time “analytics” dialog before the system ATT prompt. **Analytics default to off.** If the user turns on **Enable usage analytics** in **Settings**, the **system ATT prompt** may appear (neutral; no custom screen encouraging acceptance).

### Guideline 5.1.1(v) — Account deletion

**Settings → Account & Security → Delete account** (confirm with typing DELETE). See screen recording in App Review Information if attached.

### Guideline 2.1 — AI (information)

1. **Model:** OpenAI **gpt-4o-mini** for in-app AI assists (suggestions, summaries, similar text features).  
2. **Third-party AI:** **OpenAI** receives text the user submits in those flows plus related business content already in the account (e.g. job or lead descriptions). We do not intentionally send account email/phone/client contacts unless the user pastes them into the AI input.  
3. **Where users can read this:** **Settings → AI features** (summary) and **Privacy Policy** section **OpenAI (AI features)** (`/privacy#ai-third-parties` in the app).

### Guideline 1.5 — Support URL

Ensure **App Store Connect → Support URL** points to a **working** page. This build exposes **in-app help** at **`/support`** (same experience as Help). If your production host is `https://gigaid.ai`, use **`https://gigaid.ai/support`** (or fix **`http://support.gigaid.ai`** to redirect there with HTTPS).

### Guideline 2.1(a) — iPad “+” (quick add)

The header **New (+)** menu uses a native-friendly menu mode on iOS. Please retry on iPad; if issues persist, note the screen and we will follow up.

### How to navigate the app

- Bottom tabs: Plan, Jobs, Requests (leads), Get Paid (invoices), More  
- **Settings** includes Analytics, AI disclosure, Subscription, Account deletion, Data export  

### Data export

**Settings → Export Data → Download JSON**

### Permissions (Info.plist)

Camera, microphone, photo library, location, speech recognition, and **NSUserTrackingUsageDescription** (factual; analytics only if the user opts in and allows tracking).

---

## Paste-ready replies (Guideline 2.1 AI questions)

**1. What AI model is your app using?**  
OpenAI **gpt-4o-mini** via the OpenAI API for optional in-app AI tools.

**2. Is your app sending users’ data to any third-party AI provider? If yes, what personal information is sent?**  
Yes — **OpenAI**. We send the **text the user enters** into AI features and **related business content** they already store in the app (for example job or service descriptions, notes). We do **not** send account email, phone, or client contact fields as part of those API calls unless the user **pastes** that information into the AI input.

**3. Where in the app's UI can users check what is being sent and to which third parties?**  
**Settings → AI features** (short summary) and the **Privacy Policy** under **Third-Party Services → OpenAI** (`/privacy#ai-third-parties`).
