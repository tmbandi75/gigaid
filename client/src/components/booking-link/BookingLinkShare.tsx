import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, Link2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { getPostActionMessage } from "@/encouragement/encouragementToast";
import { canShareContent } from "@/lib/share";
import {
  attemptShareBookingLink,
  copyBookingLinkToClipboard,
} from "@/lib/bookingLinkShareFlow";
import { recordCopy, recordShareTap } from "@/lib/bookingLinkAnalytics";
import { trackEvent } from "@/components/PostHogProvider";
import { useAuth } from "@/hooks/use-auth";

type BookingLinkShareProps = {
  variant: "primary" | "inline" | "compact" | "hero";
  context: "plan" | "leads" | "jobs" | "bookings";
  /**
   * When true (hero variant only), the primary "Copy & Send" CTA is
   * rendered as an outline button so it doesn't compete with another
   * primary CTA elsewhere on the screen (e.g. the green Collect Payment
   * card or the NBA card's own primary action). The booking link still
   * remains visible — only the button visual weight is reduced.
   */
  demoted?: boolean;
};

export function BookingLinkShare({ variant, context, demoted = false }: BookingLinkShareProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const [copied, setCopied] = useState(false);

  const { data } = useQuery<{ bookingLink: string | null; servicesCount: number }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const bookingLink = data?.bookingLink;
  const hasServices = (data?.servicesCount || 0) > 0;

  // Only show booking link if user has services set up and a booking link
  if (!hasServices || !bookingLink) return null;

  const invalidateGamePlan = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });

  const handleCopy = async (): Promise<boolean> => {
    if (!bookingLink) return false;

    const { copied: copiedOk } = await copyBookingLinkToClipboard({
      bookingLink,
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('booking_link_copied', { screen: context });
      void recordCopy(context);
      const encouragement = getPostActionMessage("link_shared");
      toast({
        title: "Link copied",
        description: encouragement || "Your booking link is ready to share",
      });
      return true;
    }
    toast({
      title: "Couldn't copy",
      description: "Please copy the link manually",
      variant: "destructive",
    });
    return false;
  };

  const handleShare = async () => {
    if (!bookingLink) return;

    trackEvent('booking_link_share_opened', { screen: context });
    void recordShareTap(context);

    if (!canShareContent()) {
      const copiedOk = await handleCopy();
      if (copiedOk) {
        trackEvent('booking_link_shared', { screen: context, method: 'copy' });
      }
      return;
    }

    const { shared, target } = await attemptShareBookingLink({
      bookingLink,
      shareTitle: variant === "primary" ? "Book my services" : "Book with me",
      shareText: variant === "primary"
        ? "Schedule a job with me using this link:"
        : "Book a job with me using this link",
      dialogTitle: "Share booking link",
      userId,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (shared) {
      trackEvent('booking_link_shared', { screen: context, method: 'share', target });
    }
  };

  const supportsShare = canShareContent();

  if (variant === "hero") {
    // Single primary action does both: trigger native share sheet
    // (with copy fallback on platforms without share). The secondary
    // text-link is a quieter copy-only escape hatch so the surface
    // never carries two competing solid buttons.
    return (
      <Card
        className="border border-primary/15 shadow-md bg-primary/5 dark:bg-primary/10"
        data-testid="card-booking-link-hero"
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                data-testid="text-hero-booking-link-label"
              >
                Your booking link
              </p>
              <p
                className="text-sm font-medium text-foreground truncate"
                data-testid="text-hero-booking-link-url"
              >
                {bookingLink}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            variant={demoted ? "outline" : "default"}
            className="w-full"
            onClick={handleShare}
            data-testid="button-hero-copy-send-booking-link"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Link copied — paste it in a text
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Copy &amp; Send My Booking Link
              </>
            )}
          </Button>
          <p
            className="text-xs text-muted-foreground text-center mt-3"
            data-testid="text-hero-social-proof"
          >
            Most users get their first booking within 24 hours
          </p>
          <div className="flex justify-center mt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-xs text-muted-foreground hover:text-foreground h-auto py-1 px-2 font-normal underline-offset-2 hover:underline"
              data-testid="button-hero-copy-only"
            >
              <Copy className="h-3 w-3 mr-1" />
              {copied ? "Copied" : "Just copy the link"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "primary") {
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
              <div className="mt-3 flex flex-col gap-2 xl:flex-row">
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={handleCopy}
                  className="w-full xl:w-auto"
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
                  className="w-full xl:w-auto"
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

  if (variant === "inline") {
    return (
      <div 
        className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/50 rounded-lg mb-4"
        data-testid="booking-link-inline-leads"
      >
        <span className="text-sm text-muted-foreground">
          Turn interest into scheduled jobs faster.
        </span>
        <div className="flex gap-2 flex-shrink-0">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleCopy}
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
                Copy
              </>
            )}
          </Button>
          {supportsShare && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={handleShare}
              data-testid="button-share-booking-link-leads"
            >
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
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

  return null;
}
