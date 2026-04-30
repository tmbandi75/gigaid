/**
 * E2E-only harness that mounts the *actual* Settings, OwnerView,
 * LeadForm, and InvoiceForm page components so a Playwright spec can
 * drive viewport-driven layout assertions against the real DOM each
 * page renders — not a mirrored class string.
 *
 * The companion spec (`e2e/centered-tablet-layout.spec.ts`) navigates
 * to `?page=settings|ownerView|leadForm|invoiceForm`, stubs the API
 * surfaces these pages reach for, then asserts on the body container
 * the real page renders (queried by `data-testid="page-body-..."`).
 *
 * Mounted only when import.meta.env.DEV (matching the existing
 * NBA / booking-link-share harnesses).
 */

import Settings from "@/pages/Settings";
import OwnerView from "@/pages/OwnerView";
import LeadForm from "@/pages/LeadForm";
import InvoiceForm from "@/pages/InvoiceForm";

type Variant = "settings" | "ownerView" | "leadForm" | "invoiceForm";

const VARIANTS: readonly Variant[] = [
  "settings",
  "ownerView",
  "leadForm",
  "invoiceForm",
];

/**
 * The data-testid each variant's page component renders on the
 * centered body container. Exposed so the spec can query it without
 * duplicating the literal.
 */
export const PAGE_BODY_TEST_IDS: Record<Variant, string> = {
  settings: "page-body-settings",
  ownerView: "page-body-owner-view",
  leadForm: "page-body-lead-form",
  invoiceForm: "page-body-invoice-form",
};

function readVariant(): Variant {
  const search =
    typeof window !== "undefined" ? window.location.search : "";
  const raw = new URLSearchParams(search).get("page");
  return (VARIANTS as readonly string[]).includes(raw ?? "")
    ? (raw as Variant)
    : "settings";
}

export default function E2ECenteredTabletLayoutHarness() {
  const variant = readVariant();

  return (
    <div
      data-testid="page-e2e-centered-tablet-layout-harness"
      data-variant={variant}
    >
      {variant === "settings" && <Settings />}
      {variant === "ownerView" && <OwnerView />}
      {variant === "leadForm" && <LeadForm />}
      {variant === "invoiceForm" && <InvoiceForm />}
    </div>
  );
}
