export const isAppleReviewMode: boolean =
  String(import.meta.env.VITE_APPLE_REVIEW_MODE ?? "").toLowerCase() === "true";
