# Android Release Guide — Gig Aid

## Prerequisites

- Android Studio (latest stable)
- Java 17+
- Firebase project with Android app registered (package: `com.gigaid.app`)

---

## 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project > Project Settings > General
3. Under "Your apps", find the Android app (`com.gigaid.app`)
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`
6. **Do not commit this file** (it is in `.gitignore`)

---

## 2. Release Signing

### Generate a keystore (first time only)

```bash
keytool -genkey -v \
  -keystore android/gigaid-release.keystore \
  -alias gigaid \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Configure signing

1. Copy the template:
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   ```

2. Edit `android/keystore.properties` with your actual values:
   ```
   storeFile=gigaid-release.keystore
   storePassword=your_actual_password
   keyAlias=gigaid
   keyPassword=your_actual_password
   ```

3. **Do not commit** `keystore.properties` or `*.keystore` files (they are in `.gitignore`)

4. **Back up your keystore securely.** If you lose it, you cannot update your app on Google Play.

---

## 3. Build the Web App

```bash
npm run build
npx cap sync android
```

---

## 4. Build the Release AAB

```bash
cd android
./gradlew bundleRelease
```

The output `.aab` will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. Pre-Upload Checks

Run the validation script:

```bash
bash scripts/android-release-check.sh
```

This verifies:
- `google-services.json` is present
- `keystore.properties` is present and not using placeholder values
- Keystore file exists
- `versionCode` and `versionName` are set
- `targetSdkVersion` meets Play requirement (>= 35)
- Web assets are synced
- No hardcoded secrets in source

---

## 6. Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app > Production > Create new release
3. Upload the `.aab` file
4. Fill in release notes
5. Complete the Data Safety form (see `android/PLAY_STORE_ASSETS.md`)
6. Submit for review

---

## 7. Version Bumping

Before each new release, update in `android/app/build.gradle`:

- `versionCode` — increment by 1 (e.g., 1 -> 2 -> 3)
- `versionName` — update to match release (e.g., "1.0" -> "1.1")

---

## 8. Demo / Review Account

For Google Play review, provide these credentials:

- **Email:** reviewer@gigaid.ai
- **Password:** GigaidReview2026!

Provision the account (if not already done):
```bash
NODE_ENV=production npx tsx server/scripts/provisionReviewAccount.ts
```

---

## Troubleshooting

### "google-services.json not found"
Download from Firebase Console and place in `android/app/`.

### "No key with alias 'gigaid' found"
Ensure `keyAlias` in `keystore.properties` matches the alias used when generating the keystore.

### Build fails with SDK errors
Ensure Android Studio has SDK 35 installed: Tools > SDK Manager > SDK Platforms > Android 15 (API 35).
