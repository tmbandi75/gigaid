import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Link2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookingLinkCardProps {
  bookingLink: string | null;
  servicesCount: number;
}

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog) {
    (window as { posthog?: { capture: (event: string, props?: Record<string, unknown>) => void } }).posthog?.capture(eventName, properties);
  }
}

export function BookingLinkCard({ bookingLink, servicesCount }: BookingLinkCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const hasServices = servicesCount > 0;

  if (!hasServices || !bookingLink) return null;

  const handleCopy = async () => {
    if (!bookingLink) return;
    
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: 'dashboard' });
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

  const handleShare = async () => {
    if (!bookingLink) return;

    trackEvent('booking_link_shared', { screen: 'dashboard' });

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Book my services",
          text: "Schedule a job with me using this link:",
          url: bookingLink,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="border shadow-sm" data-testid="card-booking-link">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Your Booking Link</p>
            
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {bookingLink}
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                variant="default"
                onClick={handleCopy}
                data-testid="button-copy-booking-link"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleShare}
                data-testid="button-share-booking-link"
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Most first jobs come from sharing this link by text.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
