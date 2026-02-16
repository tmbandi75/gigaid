import { Component, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (import.meta.env.DEV) {
      logger.error("[AppErrorBoundary] Caught error:", error);
      logger.error("[AppErrorBoundary] Component stack:", info.componentStack);
    }
    try {
      const sentry = (window as unknown as Record<string, unknown>).Sentry as
        | { captureException?: (e: unknown) => void }
        | undefined;
      if (sentry?.captureException) {
        sentry.captureException(error);
      }
    } catch {
      // Sentry not available
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#fafafa",
            color: "#333",
          }}
          data-testid="error-boundary-fallback"
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px", lineHeight: 1.5 }}>
              The app ran into a problem. This usually fixes itself — try refreshing.
            </p>
            <button
              onClick={() => {
                if ("caches" in window) {
                  caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name));
                  });
                }
                window.location.reload();
              }}
              style={{
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 500,
                border: "1px solid #ddd",
                borderRadius: "6px",
                background: "#fff",
                cursor: "pointer",
              }}
              data-testid="button-reload-app"
            >
              Refresh App
            </button>
            {import.meta.env.DEV && this.state.error && (
              <details style={{ marginTop: "20px", textAlign: "left", fontSize: "12px", color: "#999" }}>
                <summary style={{ cursor: "pointer" }}>Technical details (dev only)</summary>
                <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
