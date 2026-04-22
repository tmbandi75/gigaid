import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
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

async function track(pageId: string, type: "page_viewed" | "link_copied" | "link_shared") {
  try {
    await fetch(`/api/booking-pages/${pageId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
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

  const title = dynamicTitle(page);

  useEffect(() => {
    document.title = `${title} | GigAid`;
    track(page.id, "page_viewed");
  }, [page.id, title]);

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
        <div className="text-center space-y-2 mb-10">
          <p className="text-sm font-medium text-indigo-600 uppercase tracking-wide" data-testid="text-page-title">
            {title}
          </p>
          <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-headline">
            This page was created for your business
          </h1>
          <p className="text-base text-slate-600" data-testid="text-page-subtext">
            Customers can book you and pay a deposit instead of texting back and forth.
          </p>
        </div>

        {step === "intro" && (
          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-xl"
              onClick={() => setStep("confirm")}
              data-testid="button-claim-page"
            >
              Claim this page
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500" data-testid="text-trust-line">
              <ShieldCheck className="h-4 w-4" />
              Contractors like you are using this to get booked faster
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
