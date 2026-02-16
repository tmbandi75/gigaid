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

    if (isDev) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      logger.info("[AppCheck] Debug mode enabled for development");
    }

    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
      logger.warn("[AppCheck] VITE_RECAPTCHA_SITE_KEY not set — App Check disabled");
      return null;
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
