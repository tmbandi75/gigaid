import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { getAuthToken } from "@/lib/authToken";

interface BannerState {
  shouldShow: boolean;
  pageId: string | null;
  bookingUrl: string | null;
}

const BANNER_QUERY_KEY = ["/api/first-booking/banner-state"] as const;

async function postLinkCopiedEvent(pageId: string): Promise<void> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api/booking-pages/${pageId}/events`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ type: "link_copied" }),
  });
  if (!res.ok && res.status !== 403) {
    // 403 just means we couldn't attribute the event server-side; the copy
    // still happened. Anything else is unexpected and worth surfacing.
    throw new Error(`Failed to record link_copied (${res.status})`);
  }
}

export function FirstBookingBanner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [justCopied, setJustCopied] = useState(false);

  const { data, isLoading } = useQuery<BannerState>({
    queryKey: BANNER_QUERY_KEY,
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!data?.pageId || !data.bookingUrl) throw new Error("missing_page");
      const ok = await copyTextToClipboard(data.bookingUrl);
      if (!ok) throw new Error("clipboard_failed");
      await postLinkCopiedEvent(data.pageId);
    },
    onSuccess: () => {
      setJustCopied(true);
      toast({ title: "Link copied", description: "Send it to your next customer." });
      queryClient.invalidateQueries({ queryKey: BANNER_QUERY_KEY });
    },
    onError: (err: Error) => {
      if (err.message === "clipboard_failed" && data?.bookingUrl) {
        toast({
          title: "Couldn't copy automatically",
          description: data.bookingUrl,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  if (isLoading || !data?.shouldShow || !data.bookingUrl) return null;

  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 sm:p-5 shadow-sm"
      data-testid="banner-first-booking"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3
            className="text-base sm:text-lg font-semibold text-amber-900 dark:text-amber-100"
            data-testid="text-banner-headline"
          >
            You're 1 step away from your first booking
          </h3>
          <p
            className="text-sm text-amber-800 dark:text-amber-200"
            data-testid="text-banner-microcopy"
          >
            Send this to any customer and let them book instantly
          </p>
          <p
            className="break-all text-xs font-mono text-amber-900/70 dark:text-amber-100/70"
            data-testid="text-banner-booking-url"
          >
            {data.bookingUrl}
          </p>
          <div className="pt-1">
            <Button
              size="sm"
              onClick={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
              className="h-10 rounded-lg font-semibold"
              data-testid="button-copy-booking-link"
            >
              {justCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copy your booking link
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
