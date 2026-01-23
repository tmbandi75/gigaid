import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available, activating...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        });
      }
    });

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

    console.log('[SW] Service worker registered successfully');
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
  }
}

window.addEventListener('load', registerServiceWorker);

createRoot(document.getElementById("root")!).render(<App />);
