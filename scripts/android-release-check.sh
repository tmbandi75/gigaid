#!/usr/bin/env bash
set -euo pipefail

ANDROID_DIR="$(cd "$(dirname "$0")/../android" && pwd)"
ERRORS=0

echo "=== Gig Aid — Android Release Pre-Flight Check ==="
echo ""

# 1. google-services.json
if [ -f "$ANDROID_DIR/app/google-services.json" ]; then
  echo "[PASS] google-services.json found"
else
  echo "[FAIL] google-services.json missing"
  echo "       Download from Firebase Console and place in android/app/"
  ERRORS=$((ERRORS + 1))
fi

# 2. keystore.properties
if [ -f "$ANDROID_DIR/keystore.properties" ]; then
  echo "[PASS] keystore.properties found"
  if grep -q "CHANGE_ME" "$ANDROID_DIR/keystore.properties"; then
    echo "[WARN] keystore.properties still has placeholder values — update before release"
  fi
else
  echo "[FAIL] keystore.properties missing"
  echo "       Copy android/keystore.properties.example to android/keystore.properties"
  echo "       and fill in your signing credentials"
  ERRORS=$((ERRORS + 1))
fi

# 3. Keystore file
if [ -f "$ANDROID_DIR/keystore.properties" ]; then
  STORE_FILE=$(grep "storeFile" "$ANDROID_DIR/keystore.properties" | cut -d'=' -f2 | tr -d '[:space:]')
  if [ -n "$STORE_FILE" ] && [ -f "$ANDROID_DIR/$STORE_FILE" ]; then
    echo "[PASS] Keystore file found: $STORE_FILE"
  else
    echo "[WARN] Keystore file not found: $STORE_FILE"
    echo "       Generate with: keytool -genkey -v -keystore android/$STORE_FILE -alias gigaid -keyalg RSA -keysize 2048 -validity 10000"
  fi
fi

# 4. versionCode check
VERSION_CODE=$(grep "versionCode" "$ANDROID_DIR/app/build.gradle" | head -1 | grep -o '[0-9]\+')
if [ -n "$VERSION_CODE" ] && [ "$VERSION_CODE" -gt 0 ]; then
  echo "[PASS] versionCode = $VERSION_CODE"
else
  echo "[FAIL] versionCode not set or invalid"
  ERRORS=$((ERRORS + 1))
fi

# 5. versionName check
VERSION_NAME=$(grep "versionName" "$ANDROID_DIR/app/build.gradle" | head -1 | grep -o '"[^"]*"' | tr -d '"')
if [ -n "$VERSION_NAME" ]; then
  echo "[PASS] versionName = $VERSION_NAME"
else
  echo "[FAIL] versionName not set"
  ERRORS=$((ERRORS + 1))
fi

# 6. targetSdkVersion check
TARGET_SDK=$(grep "targetSdkVersion" "$ANDROID_DIR/variables.gradle" | grep -o '[0-9]\+')
if [ -n "$TARGET_SDK" ] && [ "$TARGET_SDK" -ge 35 ]; then
  echo "[PASS] targetSdkVersion = $TARGET_SDK (meets Play requirement)"
else
  echo "[FAIL] targetSdkVersion = $TARGET_SDK (must be >= 35)"
  ERRORS=$((ERRORS + 1))
fi

# 7. Web assets built
if [ -d "$ANDROID_DIR/app/src/main/assets/public" ]; then
  FILE_COUNT=$(find "$ANDROID_DIR/app/src/main/assets/public" -type f | wc -l)
  if [ "$FILE_COUNT" -gt 0 ]; then
    echo "[PASS] Web assets synced ($FILE_COUNT files)"
  else
    echo "[WARN] Web assets directory exists but is empty — run: npm run build && npx cap sync android"
  fi
else
  echo "[WARN] Web assets not synced — run: npm run build && npx cap sync android"
fi

# 8. No hardcoded secrets
SECRETS_FOUND=$(grep -rn "sk_live\|sk_test\|AIza" "$ANDROID_DIR/app/src/main/" 2>/dev/null | grep -v "Binary" | grep -v "\.png" || true)
if [ -z "$SECRETS_FOUND" ]; then
  echo "[PASS] No hardcoded secrets detected"
else
  echo "[FAIL] Possible hardcoded secrets found:"
  echo "$SECRETS_FOUND"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=== Summary ==="
if [ "$ERRORS" -gt 0 ]; then
  echo "$ERRORS error(s) found. Fix before submitting to Google Play."
  exit 1
else
  echo "All checks passed. Ready to build release."
  echo ""
  echo "Next steps:"
  echo "  1. npm run build"
  echo "  2. npx cap sync android"
  echo "  3. cd android && ./gradlew bundleRelease"
  echo "  4. Upload app/build/outputs/bundle/release/app-release.aab to Play Console"
  exit 0
fi
