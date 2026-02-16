import { createRoot } from "react-dom/client";
import { initGlobalErrorHandlers } from "./lib/errors/globalErrorHandler";
import App from "./App";
import "./index.css";
import { logger } from "@/lib/logger";

initGlobalErrorHandlers();

if (import.meta.env.DEV) {
  logger.debug('[env] Startup check:', {
    VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
    MODE: import.meta.env.MODE
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          logger.debug('[SW] New service worker found, waiting for install...');
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              logger.debug('[SW] New version installed, sending SKIP_WAITING and reloading...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      registration.update().catch(() => {});

      if ('sync' in registration) {
        navigator.serviceWorker.ready.then((reg) => {
          window.addEventListener('online', () => {
            (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
              .sync.register('gigaid-sync').catch(() => {});
          });
        });
      }

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_TRIGGERED') {
          window.dispatchEvent(new CustomEvent('sw-sync-triggered'));
        }
      });
    }).catch((err) => {
      logger.error('[SW] Registration failed:', err);
    });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      logger.debug('[SW] Controller changed, reloading page for fresh content...');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
