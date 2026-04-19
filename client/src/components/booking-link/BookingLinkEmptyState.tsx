import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog) {
    (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog?.capture(eventName, properties);
  }
}

export function BookingLinkEmptyState() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery<{ bookingLink: string | null }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const bookingLink = data?.bookingLink;

  if (!bookingLink) return null;

  const handleCopy = async () => {
    const copiedOk = await copyTextToClipboard(bookingLink);
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: 'leads_empty' });
      toast({
        title: "Link copied",
        description: "Your booking link is ready to share",
      });
    } else {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="text-center mt-4">
      <p className="text-sm text-muted-foreground mb-3">
        New leads often come from sharing your booking link.
      </p>
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleCopy}
        data-testid="button-copy-booking-link-empty"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-1" />
            Copy Booking Link
          </>
        )}
      </Button>
    </div>
  );
}
