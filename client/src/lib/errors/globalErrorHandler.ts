let recoveryOverlayShown = false;

function showRecoveryOverlay() {
  if (recoveryOverlayShown) return;
  if (typeof document === "undefined") return;
  recoveryOverlayShown = true;

  const existing = document.getElementById("global-error-overlay");
  if (existing) return;

  const overlay = document.createElement("div");
  overlay.id = "global-error-overlay";
  overlay.setAttribute("data-testid", "global-error-overlay");
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    max-width: 380px; width: 90%; padding: 32px 28px;
    background: #fff; border-radius: 12px; text-align: center;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
  `;

  const title = document.createElement("h2");
  title.textContent = "Something went wrong";
  title.style.cssText = "margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #1a1a1a;";

  const msg = document.createElement("p");
  msg.textContent = "The app ran into an unexpected problem. Please try reloading.";
  msg.style.cssText = "margin: 0 0 22px; font-size: 14px; color: #666; line-height: 1.5;";

  const btn = document.createElement("button");
  btn.textContent = "Reload App";
  btn.setAttribute("data-testid", "button-global-error-reload");
  btn.style.cssText = `
    padding: 10px 28px; font-size: 14px; font-weight: 500;
    border: 1px solid #ddd; border-radius: 6px;
    background: #f5f5f5; color: #1a1a1a; cursor: pointer;
  `;
  btn.addEventListener("mouseenter", () => { btn.style.background = "#e8e8e8"; });
  btn.addEventListener("mouseleave", () => { btn.style.background = "#f5f5f5"; });
  btn.addEventListener("click", () => { window.location.reload(); });

  card.appendChild(title);
  card.appendChild(msg);
  card.appendChild(btn);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function captureToSentry(err: unknown) {
  try {
    const sentry = (window as unknown as Record<string, unknown>).Sentry as
      | { captureException?: (e: unknown) => void }
      | undefined;
    if (sentry?.captureException) {
      sentry.captureException(err instanceof Error ? err : new Error(String(err)));
    }
  } catch {
    // Sentry not available or failed — silently continue
  }
}

function safeLog(prefix: string, err: unknown) {
  try {
    if (import.meta.env.DEV) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${prefix}]`, message);
    }
    captureToSentry(err);
  } catch {
    // Never throw from the error handler itself
  }
}

export function initGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.onerror = (
    _message: string | Event,
    _source?: string,
    _lineno?: number,
    _colno?: number,
    error?: Error,
  ) => {
    safeLog("GlobalError", error || _message);
    showRecoveryOverlay();
    return true;
  };

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    event.preventDefault();
    safeLog("UnhandledRejection", event.reason);
    showRecoveryOverlay();
  });
}

export function showGlobalRecoveryUI() {
  showRecoveryOverlay();
}
