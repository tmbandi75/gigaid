import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingLinkInlineProps {
  bookingLink: string | null;
  servicesCount: number;
}

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog) {
    (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog?.capture(eventName, properties);
  }
}

export function BookingLinkInline({ bookingLink, servicesCount }: BookingLinkInlineProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (servicesCount === 0 || !bookingLink) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: 'leads' });
      toast({
        title: "Link copied",
        description: "Your booking link is ready to share",
      });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div 
      className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/50 rounded-lg mb-4"
      data-testid="booking-link-inline-leads"
    >
      <span className="text-sm text-muted-foreground">
        Turn interest into scheduled jobs faster.
      </span>
      <Button 
        size="sm" 
        variant="ghost"
        onClick={handleCopy}
        className="flex-shrink-0"
        data-testid="button-copy-booking-link-leads"
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

export function BookingLinkEmptyState({ bookingLink, servicesCount = 0 }: { bookingLink: string | null; servicesCount?: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!bookingLink || servicesCount === 0) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: 'leads_empty' });
      toast({
        title: "Link copied",
        description: "Your booking link is ready to share",
      });
    } catch {
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
