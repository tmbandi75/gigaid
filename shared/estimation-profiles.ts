export type EstimationFlow = "INSTANT_ESTIMATE" | "PROVIDER_REVIEW_REQUIRED" | "NO_PREBOOK_ESTIMATE";
export type PricingType = "range" | "tiered" | "flat" | "flat_range";
export type MeasurementType = "area" | "linear";

export interface EstimationProfile {
  enabled: boolean;
  measurement?: MeasurementType[];
  photo?: boolean;
  pricing?: PricingType;
  flow?: EstimationFlow;
  manualOnly?: boolean;
}

export const CATEGORY_ESTIMATION_PROFILES: Record<string, EstimationProfile> = {
  "cleaning": {
    enabled: true,
    measurement: ["area"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "interior-care": {
    enabled: true,
    measurement: ["area"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "lawn-outdoor": {
    enabled: true,
    measurement: ["area", "linear"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "windows-exterior": {
    enabled: true,
    measurement: ["area", "linear"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "flooring": {
    enabled: true,
    measurement: ["area"],
    photo: true,
    pricing: "range",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "carpentry": {
    enabled: true,
    measurement: ["linear"],
    photo: true,
    pricing: "range",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "moving": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "specialty-cleaning": {
    enabled: true,
    measurement: ["area"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "seasonal": {
    enabled: true,
    measurement: ["area", "linear"],
    photo: true,
    pricing: "range",
    flow: "INSTANT_ESTIMATE",
  },
  "handyman": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "tiered",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "plumbing": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "flat_range",
    flow: "NO_PREBOOK_ESTIMATE",
  },
  "hvac": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "flat_range",
    flow: "NO_PREBOOK_ESTIMATE",
  },
  "security": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "tiered",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "tech-help": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "flat",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "auto": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "flat",
    flow: "PROVIDER_REVIEW_REQUIRED",
  },
  "inspection": {
    enabled: true,
    measurement: [],
    photo: true,
    pricing: "flat",
    flow: "NO_PREBOOK_ESTIMATE",
  },
  "electrical": {
    enabled: false,
  },
  "hair-beauty": {
    enabled: false,
  },
  "child-care": {
    enabled: false,
  },
  "pet-care": {
    enabled: false,
  },
  "house-care": {
    enabled: false,
  },
  "wellness": {
    enabled: false,
  },
  "creative": {
    enabled: false,
  },
  "events": {
    enabled: false,
  },
  "education": {
    enabled: false,
  },
  "professional": {
    enabled: false,
  },
  "concierge": {
    enabled: false,
  },
  "other": {
    enabled: false,
    manualOnly: true,
  },
};

export function getEstimationProfile(categoryId: string): EstimationProfile {
  return CATEGORY_ESTIMATION_PROFILES[categoryId] || { enabled: false };
}

export function isPublicEstimationAllowed(
  categoryId: string,
  providerPublicEstimationEnabled: boolean
): boolean {
  const profile = getEstimationProfile(categoryId);
  if (!profile.enabled) return false;
  if (!providerPublicEstimationEnabled) return false;
  return profile.flow === "INSTANT_ESTIMATE";
}

export function shouldShowInstantEstimate(
  categoryId: string,
  providerPublicEstimationEnabled: boolean
): boolean {
  const profile = getEstimationProfile(categoryId);
  return (
    profile.enabled &&
    providerPublicEstimationEnabled &&
    profile.flow === "INSTANT_ESTIMATE"
  );
}

export function requiresProviderReview(categoryId: string): boolean {
  const profile = getEstimationProfile(categoryId);
  return profile.enabled && profile.flow === "PROVIDER_REVIEW_REQUIRED";
}

export function hasNoPreBookEstimate(categoryId: string): boolean {
  const profile = getEstimationProfile(categoryId);
  return profile.enabled && profile.flow === "NO_PREBOOK_ESTIMATE";
}

export function getAllowedMeasurements(categoryId: string): MeasurementType[] {
  const profile = getEstimationProfile(categoryId);
  return profile.measurement || [];
}

export function supportsPhotoEstimation(categoryId: string): boolean {
  const profile = getEstimationProfile(categoryId);
  return profile.enabled && profile.photo === true;
}

export interface AIEstimateOutput {
  lowEstimate: number;
  highEstimate: number;
  confidence: "Low" | "Medium" | "High";
  basedOn: string[];
  disclaimer: string;
}

export function formatAIEstimate(estimate: AIEstimateOutput): string {
  const basedOnList = estimate.basedOn.map((item) => `• ${item}`).join("\n");
  return `Suggested Estimate:
$${estimate.lowEstimate} – $${estimate.highEstimate}

Confidence:
${estimate.confidence}

Based on:
${basedOnList}

Final price confirmed onsite.`;
}

export const AI_ESTIMATION_DISCLAIMER =
  "Photo-based estimates are approximate and used only to assist pricing.";
