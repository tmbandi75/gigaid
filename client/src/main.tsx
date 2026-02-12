import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
  console.log('[env] Startup check:', {
    VITE_STRIPE_ENABLED: import.meta.env.VITE_STRIPE_ENABLED,
    MODE: import.meta.env.MODE
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
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
      console.error('[SW] Registration failed:', err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
