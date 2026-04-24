import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ShieldCheck, Send, Calendar, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken } from "@/lib/authToken";

export interface UnclaimedBookingPageData {
  id: string;
  phone?: string | null;
  category?: string | null;
  location?: string | null;
}

interface Props {
  page: UnclaimedBookingPageData;
}

function capitalize(value?: string | null): string {
  if (!value) return "";
  return value
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function dynamicTitle(page: UnclaimedBookingPageData): string {
  const loc = capitalize(page.location);
  const cat = capitalize(page.category);
  if (loc && cat) return `${loc} ${cat} Service`;
  if (cat) return `${cat} Service`;
  if (loc) return `${loc} Local Service`;
  return "Your Local Service";
}

type HeadlineVariant = "back_and_forth" | "deposit_first" | "speed_first" | "social_proof";

const HEADLINE_VARIANTS: HeadlineVariant[] = [
  "back_and_forth",
  "deposit_first",
  "speed_first",
  "social_proof",
];

interface VariantCopy {
  headline: string;
  subtext: string;
  secondary: string;
}

const VARIANT_COPY: Record<HeadlineVariant, VariantCopy> = {
  back_and_forth: {
    headline: "Get booked without going back and forth with customers",
    subtext: "Send this to your next customer — they can pick a time and lock in the job.",
    secondary: "You can also require a deposit if you want.",
  },
  deposit_first: {
    headline: "Stop showing up to no-shows — collect a deposit before the job",
    subtext: "Send your link, customer picks a time and pays a deposit to lock it in.",
    secondary: "You set the deposit amount. No deposit, no booking.",
  },
  speed_first: {
    headline: "Book your next job in under 60 seconds",
    subtext: "Share one link. Your customer picks a time and you're booked — no calls, no texting back and forth.",
    secondary: "Add a deposit too if you want to filter out no-shows.",
  },
  social_proof: {
    headline: "How local contractors are booking jobs without lifting a finger",
    subtext: "Share one link with your next customer — they pick a time and you're confirmed.",
    secondary: "Used by movers, cleaners, handymen, and more.",
  },
};

const VARIANT_STORAGE_PREFIX = "gigaid:unclaimed-variant:";

function pickVariant(pageId: string): HeadlineVariant {
  if (typeof window === "undefined") return HEADLINE_VARIANTS[0];
  const key = `${VARIANT_STORAGE_PREFIX}${pageId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && (HEADLINE_VARIANTS as string[]).includes(existing)) {
      return existing as HeadlineVariant;
    }
  } catch {
    // ignore storage errors (private mode, etc.)
  }
  // Deterministic-ish pick using a random index, persisted per page.
  const idx = Math.floor(Math.random() * HEADLINE_VARIANTS.length);
  const chosen = HEADLINE_VARIANTS[idx];
  try {
    window.localStorage.setItem(key, chosen);
  } catch {
    // ignore
  }
  return chosen;
}

async function track(
  pageId: string,
  type: "page_viewed" | "link_copied" | "link_shared",
  variant?: HeadlineVariant,
) {
  try {
    await fetch(`/api/booking-pages/${pageId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, variant }),
    });
  } catch {
    // tracking failures are non-fatal
  }
}

export default function UnclaimedBookingPage({ page }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"intro" | "confirm" | "form">("intro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(page.phone || "");
  const [serviceType, setServiceType] = useState(capitalize(page.category) || "");
  const [submitting, setSubmitting] = useState(false);
  const [variant] = useState<HeadlineVariant>(() => pickVariant(page.id));

  const title = dynamicTitle(page);
  const copy = VARIANT_COPY[variant];

  useEffect(() => {
    document.title = `${title} | GigAid`;
    track(page.id, "page_viewed", variant);
  }, [page.id, title, variant]);

  const handleClaim = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/claim-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          name: name || undefined,
          phone: phone || undefined,
          serviceType: serviceType || undefined,
          variant,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Could not claim this page");
      }
      if (data.token) {
        setAuthToken(data.token);
      }
      setLocation(data.redirect || `/first-booking/${page.id}`);
    } catch (err: any) {
      toast({
        title: "Couldn't claim the page",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="page-unclaimed-booking">
      <div className="mx-auto max-w-md px-6 pt-16 pb-12">
        <div className="text-center space-y-3 mb-8">
          <p className="text-sm font-medium text-indigo-600 uppercase tracking-wide" data-testid="text-page-title">
            {title}
          </p>
          <h1
            className="text-3xl font-bold text-slate-900 leading-tight"
            data-testid="text-page-headline"
            data-variant={variant}
          >
            {copy.headline}
          </h1>
          <p className="text-base text-slate-600" data-testid="text-page-subtext">
            {copy.subtext}
          </p>
          <p className="text-xs text-slate-500" data-testid="text-page-secondary">
            {copy.secondary}
          </p>
          <p className="text-sm font-semibold text-slate-800 pt-1" data-testid="text-page-urgency">
            Use this for your next job today
          </p>
        </div>

        {step === "intro" && (
          <div className="space-y-6">
            <div>
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold rounded-xl"
                onClick={() => setStep("confirm")}
                data-testid="button-claim-page"
              >
                Claim this page and start using it
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-sm text-slate-500 text-center mt-2" data-testid="text-claim-free-note">
                Free to start. No signup required.
              </p>
            </div>

            <div
              className="flex items-center justify-between gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:gap-2 sm:px-4"
              data-testid="section-three-steps"
            >
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" data-testid="step-send-link">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Send className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-medium leading-tight text-slate-700">Send link</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 sm:h-4 sm:w-4" />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" data-testid="step-customer-books">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-medium leading-tight text-slate-700">Customer books</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 sm:h-4 sm:w-4" />
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" data-testid="step-confirmed">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-medium leading-tight text-slate-700">You're confirmed</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-slate-500" data-testid="text-trust-line">
              <ShieldCheck className="h-4 w-4" />
              Used by local contractors to get booked faster
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Is this your business?</h2>
            <p className="text-sm text-slate-600">
              We'll set up your booking link in a few seconds. No password needed yet.
            </p>
            <Button
              size="lg"
              className="w-full h-12 rounded-xl"
              onClick={() => setStep("form")}
              data-testid="button-confirm-claim"
            >
              Yes, claim it
            </Button>
            <button
              type="button"
              className="w-full text-sm text-slate-500 hover:text-slate-700"
              onClick={() => setStep("intro")}
              data-testid="button-cancel-claim"
            >
              Not mine
            </button>
          </div>
        )}

        {step === "form" && (
          <form
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) handleClaim();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="claim-name">Your name (optional)</Label>
              <Input
                id="claim-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                autoComplete="name"
                data-testid="input-claim-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-phone">Phone</Label>
              <Input
                id="claim-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-1234"
                autoComplete="tel"
                data-testid="input-claim-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-service">Service</Label>
              <Input
                id="claim-service"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="Moving, cleaning, handyman..."
                data-testid="input-claim-service"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full h-12 rounded-xl"
              disabled={submitting}
              data-testid="button-claim-continue"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
