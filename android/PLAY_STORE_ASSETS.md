# Google Play Store Assets Checklist — Gig Aid

## Required Store Listing Assets

### App Icon
- **Size:** 512 x 512 px
- **Format:** 32-bit PNG (with alpha)
- **Status:** Launcher icons already in `app/src/main/res/mipmap-*` directories. Export a 512x512 version for the Play Console listing.

### Feature Graphic
- **Size:** 1024 x 500 px
- **Format:** JPEG or 24-bit PNG (no alpha)
- **Purpose:** Displayed at the top of the store listing and in promotional placements
- **Tips:** Include the app name, tagline, and a visual that conveys gig worker productivity

### Screenshots (required)
- **Phone:** Minimum 2, maximum 8
  - **Size:** 16:9 or 9:16 aspect ratio, min 320px, max 3840px on any side
  - **Recommended:** 1080 x 1920 px (portrait)
- **7-inch tablet:** Optional but recommended
  - **Size:** 1200 x 1920 px (portrait)
- **10-inch tablet:** Optional but recommended
  - **Size:** 1600 x 2560 px (portrait)

#### Recommended Screenshot Sequence
1. Dashboard / Today's Game Plan (shows immediate value)
2. Job management view (creating or viewing a job)
3. Invoice / Get Paid screen (shows payment capability)
4. Client list or lead tracking (shows CRM features)
5. Voice notes or AI tools (shows productivity features)
6. Settings / account management (shows professionalism)

### Promotional Video (optional)
- **Format:** YouTube URL
- **Duration:** 30 seconds to 2 minutes recommended
- **Content:** Show the app in use on a real device

---

## Store Listing Text

### App Name
- **Limit:** 30 characters
- **Current:** "Gig Aid" (7 characters — compliant)
- **Rules:** No keyword stuffing, no misleading terms

### Short Description
- **Limit:** 80 characters
- **Example:** "Manage jobs, clients, invoices & leads — built for service pros."

### Full Description
- **Limit:** 4000 characters
- **Must include:** Core features, target audience, privacy mention
- **Must not include:** Misleading claims, competitor names, excessive keywords
- **Tip:** Mention that payments are for physical services (supports billing compliance)

---

## Data Safety Form

Fill out in Google Play Console > App content > Data safety.

### Data collected and shared:

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| Name | Yes | No | App functionality | No |
| Email | Yes | No | Account management | No |
| Phone number | Yes | With Twilio | Notifications | Yes |
| Address | Yes | With Google Maps | Directions | Yes |
| Payment info | Yes | With Stripe | Payments | No |
| Photos | Yes | No | Job documentation | Yes |
| App interactions | Yes | With PostHog | Analytics | Yes |
| Crash logs | Yes | No | App stability | No |
| Device identifiers | Yes | With PostHog | Analytics | Yes |

### Security practices:
- Data encrypted in transit: **Yes** (TLS)
- Data can be deleted: **Yes** (Settings > Account & Security > Delete Account)
- Committed to Play Families Policy: **No** (not a children's app)

---

## Content Rating

Complete the content rating questionnaire in Play Console > App content > Content rating.

- **Violence:** None
- **Sexuality:** None
- **Language:** None
- **Controlled substances:** None
- **Expected rating:** Everyone / PEGI 3

---

## Export Instructions

### Taking Screenshots
Use Android Studio emulator or a physical device:
```bash
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png ./screenshot.png
```

### Creating Feature Graphic
Use any image editor (Figma, Canva, Photoshop) to create a 1024x500 banner with:
- App logo
- Tagline: e.g., "Your business, simplified."
- Professional service imagery
