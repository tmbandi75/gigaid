import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Copy, Send, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/authToken";

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

async function track(pageId: string, type: "link_copied" | "link_shared") {
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

  const bookingUrl = useMemo(() => {
    if (!pageId) return "";
    return `${window.location.origin}/book/${pageId}`;
  }, [pageId]);

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
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, setLocation]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
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
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-slate-900" data-testid="text-first-booking-headline">
            Send this to your next customer
          </h1>
          <p className="text-base text-slate-600" data-testid="text-first-booking-microcopy">
            Instead of texting back and forth, just send this and they can book + pay a deposit.
          </p>
        </div>

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
        </div>
      </div>
    </div>
  );
}
