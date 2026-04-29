import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { AlertCircle, ArrowRight, Calendar, Check, CheckCircle2, Copy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/authToken";
import { buildBookingLink } from "@/lib/bookingBaseUrl";
import { SecureAccountCard } from "@/components/first-booking/SecureAccountCard";
import { SmsOptOutBanner } from "@/components/settings/SmsOptOutBanner";
import { buildSlugAdjustedNotice } from "@/lib/slugAdjustedNotice";

interface BookingPageDto {
  id: string;
  claimed: boolean;
  isOwner: boolean;
}

async function fetchPage(pageId: string): Promise<BookingPageDto | null> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`/api/booking-pages/${pageId}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.page as BookingPageDto;
  } catch {
    return null;
  }
}

async function track(pageId: string, type: "link_copied" | "link_shared" | "first_booking_viewed") {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    await fetch(`/api/booking-pages/${pageId}/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type }),
    });
  } catch {
    // tracking failures are non-fatal
  }
}

export default function FirstBookingPage() {
  const [, params] = useRoute("/first-booking/:pageId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const pageId = params?.pageId || "";

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopiedConfirmed, setLinkCopiedConfirmed] = useState(false);
  const viewedFiredRef = useRef(false);

  const bookingUrl = useMemo(() => {
    if (!pageId) return "";
    return buildBookingLink(pageId);
  }, [pageId]);

  // The claim flow tacks `requestedSlug` / `adjustedSlug` query params
  // onto the redirect URL only when a concurrent claim forced the new
  // user's slug to be auto-suffixed. Surfaces a small inline notice so
  // the new pro realises their saved slug isn't the bare name version.
  // Read once at mount via window.location — wouter's routing strips
  // the search portion before our route handler sees it.
  const slugAdjustedNotice = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return buildSlugAdjustedNotice(
      params.get("requestedSlug"),
      params.get("adjustedSlug"),
    );
  }, []);

  const smsBody = `Book me here and pay your deposit so we can lock it in: ${bookingUrl}`;

  useEffect(() => {
    document.title = "Send your first booking link | GigAid";
    let cancelled = false;
    (async () => {
      if (!pageId) return;
      const page = await fetchPage(pageId);
      if (cancelled) return;
      // Server-backed ownership check: only the user whose JWT matches
      // claimedByUserId is allowed on this screen. Non-owners get redirected.
      if (!page || !page.claimed || !page.isOwner) {
        setLocation("/");
        return;
      }
      setAllowed(true);
      setLoading(false);
      if (!viewedFiredRef.current) {
        viewedFiredRef.current = true;
        track(pageId, "first_booking_viewed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, setLocation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setLinkCopiedConfirmed(true);
      toast({ title: "Link copied", description: "Paste it to your next customer." });
      track(pageId, "link_copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy automatically",
        description: bookingUrl,
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    track(pageId, "link_shared");
    const nav: Navigator & { share?: (data: ShareData) => Promise<void> } =
      typeof navigator !== "undefined" ? navigator : ({} as Navigator);
    if (typeof nav.share === "function") {
      try {
        await nav.share({ text: smsBody, url: bookingUrl });
        return;
      } catch {
        // fall through to sms: link
      }
    }
    const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;
    window.location.href = smsHref;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white" data-testid="page-first-booking">
      <div className="mx-auto max-w-md px-6 pt-20 pb-12 space-y-8">
        <SmsOptOutBanner />
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-slate-900" data-testid="text-first-booking-headline">
            Send this to your next customer
          </h1>
          <p className="text-base text-slate-600" data-testid="text-first-booking-microcopy">
            Instead of texting back and forth, just send this and let them book the job.
          </p>
        </div>

        {slugAdjustedNotice && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
            data-testid="banner-slug-adjusted"
            role="status"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold" data-testid="text-slug-adjusted-title">
                {slugAdjustedNotice.title}
              </p>
              <p data-testid="text-slug-adjusted-description">
                {slugAdjustedNotice.description}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your booking link</p>
          <p className="mt-2 break-all text-sm font-mono text-slate-800" data-testid="text-booking-url">
            {bookingUrl}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-xl"
            onClick={handleCopy}
            data-testid="button-copy-link"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-5 w-5" /> Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-5 w-5" /> Copy your booking link
              </>
            )}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 text-base font-semibold rounded-xl"
            onClick={handleShare}
            data-testid="button-share-link"
          >
            <Send className="mr-2 h-5 w-5" /> Send via text
          </Button>
          {linkCopiedConfirmed && (
            <p
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-700"
              data-testid="text-link-copied-confirmed"
            >
              <Check className="h-4 w-4" />
              Link copied — send it to your next customer
            </p>
          )}
        </div>

        <SecureAccountCard />

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

        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-500" data-testid="text-first-booking-social-proof">
            Most people get their first booking within a day after sharing this.
          </p>
          <p className="text-sm font-semibold text-slate-800" data-testid="text-first-booking-urgency">
            Use this for your next job today
          </p>
        </div>
      </div>
    </div>
  );
}
