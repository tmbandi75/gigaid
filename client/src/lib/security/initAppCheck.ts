import { type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { logger } from "@/lib/logger";

let appCheckInstance: AppCheck | null = null;

export function getAppCheck(): AppCheck | null {
  return appCheckInstance;
}

export function initAppCheck(app: FirebaseApp): AppCheck | null {
  if (appCheckInstance) {
    return appCheckInstance;
  }

  try {
    const isDev =
      import.meta.env.DEV ||
      import.meta.env.MODE === "development" ||
      window.location.hostname === "localhost";

    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
      logger.warn("[AppCheck] VITE_RECAPTCHA_SITE_KEY not set — App Check disabled");
      return null;
    }

    // In dev, only activate App Check when a specific debug token is provided.
    // Setting FIREBASE_APPCHECK_DEBUG_TOKEN = true generates a random token
    // that must be registered in the Firebase Console; if it isn't, App Check
    // silently blocks auth operations like signInWithPopup.
    if (isDev) {
      const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
      if (debugToken) {
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
        logger.info("[AppCheck] Using explicit debug token for development");
      } else {
        logger.info("[AppCheck] Skipped in development (set VITE_APPCHECK_DEBUG_TOKEN to enable)");
        return null;
      }
    }

    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });

    logger.info("[AppCheck] Initialized successfully");
    return appCheckInstance;
  } catch (err) {
    logger.warn(
      "[AppCheck] Initialization failed (non-fatal):",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}
