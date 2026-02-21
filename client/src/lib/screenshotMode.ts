const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const isScreenshotMode = params.get("ss") === "1";
