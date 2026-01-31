import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingLinkSecondaryProps {
  bookingLink: string | null;
  servicesCount: number;
}

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog) {
    (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog?.capture(eventName, properties);
  }
}

export function BookingLinkSecondary({ bookingLink, servicesCount }: BookingLinkSecondaryProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (servicesCount === 0 || !bookingLink) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: 'jobs' });
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
    <Button 
      size="sm" 
      variant="ghost"
      onClick={handleCopy}
      className="text-primary"
      data-testid="button-share-booking-link-jobs"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 mr-1" />
          Share booking link
        </>
      )}
    </Button>
  );
}
