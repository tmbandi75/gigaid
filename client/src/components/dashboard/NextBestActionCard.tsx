import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Copy,
  DollarSign,
  Send,
  Share2,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/components/PostHogProvider";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { apiFetch } from "@/lib/apiFetch";
import { copyTextToClipboard } from "@/lib/clipboard";
import { canShareContent, shareContent } from "@/lib/share";
import { markBookingLinkShared } from "@/lib/bookingLinkShared";
import {
  deriveNBAState,
  type DashboardSummary,
} from "@/lib/nbaState";
import { shouldFireNBAShown } from "@/lib/nbaAnalytics";

export type { DashboardSummary } from "@/lib/nbaState";
export { deriveNBAState } from "@/lib/nbaState";


interface CtaInfo {
  label: string;
  icon: typeof DollarSign;
  onClick: () => void | Promise<void>;
}

interface NBAContent {
  title: string;
  subtitle: string;
  primary: CtaInfo;
  secondary?: CtaInfo;
  tone: "neutral" | "money";
}

interface NextBestActionCardProps {
  summary: DashboardSummary | undefined;
  variant?: "mobile" | "desktop";
  userId?: string;
}

export function NextBestActionCard({
  summary,
  variant = "mobile",
  userId,
}: NextBestActionCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookingData } = useQuery<{
    bookingLink: string | null;
    servicesCount: number;
  }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const state = deriveNBAState(summary, userId);
  const bookingLink = bookingData?.bookingLink ?? null;

  useEffect(() => {
    if (shouldFireNBAShown(userId, state)) {
      trackEvent("nba_shown", { state, userId });
    }
  }, [state, userId]);

  const recordShared = async (method: "copy" | "share") => {
    markBookingLinkShared(userId);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });
    try {
      await apiFetch("/api/track/booking-link-shared", {
        method: "POST",
        body: JSON.stringify({ method }),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });
    } catch {
      // best effort — the localStorage flag already flipped the NBA state
    }
  };

  const doCopy = async () => {
    if (!bookingLink) {
      toast({
        title: "Booking link not ready yet",
        description: "Add a service first to generate your booking link.",
      });
      navigate("/profile");
      return;
    }
    const ok = await copyTextToClipboard(bookingLink);
    if (ok) {
      toast({
        title: "Link copied",
        description: "Your booking link is ready to share",
      });
      void recordShared("copy");
    } else {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const doShare = async () => {
    if (!bookingLink) {
      toast({
        title: "Booking link not ready yet",
        description: "Add a service first to generate your booking link.",
      });
      navigate("/profile");
      return;
    }
    if (!canShareContent()) {
      await doCopy();
      return;
    }
    const sharedOk = await shareContent({
      title: "Book my services",
      text: "Schedule a job with me using this link:",
      url: bookingLink,
      dialogTitle: "Share booking link",
    });
    if (sharedOk) {
      void recordShared("share");
    }
  };

  const supportsNativeShare = canShareContent();

  const shareLinkPrimary: CtaInfo = {
    label: "Share Link",
    icon: Share2,
    onClick: supportsNativeShare ? doShare : doCopy,
  };
  const copyLinkSecondary: CtaInfo = {
    label: "Copy Link",
    icon: Copy,
    onClick: doCopy,
  };

  const content: NBAContent = (() => {
    switch (state) {
      case "NEW_USER":
        return {
          title: "Get your first client",
          subtitle: "Share your booking link to start getting jobs.",
          primary: shareLinkPrimary,
          secondary: copyLinkSecondary,
          tone: "neutral",
        };
      case "NO_JOBS_YET":
        return {
          title: "Share your link to get your first job",
          subtitle: "Most first jobs come from sharing by text.",
          primary: shareLinkPrimary,
          secondary: copyLinkSecondary,
          tone: "neutral",
        };
      case "IN_PROGRESS":
        return {
          title: "Finish your job to get paid",
          subtitle: "Mark jobs complete when you're done.",
          primary: {
            label: "View Jobs",
            icon: Briefcase,
            onClick: () => navigate("/jobs"),
          },
          secondary: {
            label: "Update Status",
            icon: CheckCircle2,
            onClick: () => navigate("/jobs"),
          },
          tone: "neutral",
        };
      case "READY_TO_INVOICE":
        return {
          title: "You're 1 step away from getting paid",
          subtitle: "Send your first invoice to get paid.",
          primary: {
            label: "Create Invoice",
            icon: Send,
            onClick: () => navigate("/invoices/new"),
          },
          tone: "money",
        };
      case "ACTIVE_USER":
        return {
          title: "Keep the momentum going",
          subtitle: "Follow up with leads or get your next job.",
          primary: {
            label: "Follow Up",
            icon: TrendingUp,
            onClick: () => navigate("/leads"),
          },
          secondary: {
            label: "Share Link",
            icon: Share2,
            onClick: supportsNativeShare ? doShare : doCopy,
          },
          tone: "neutral",
        };
    }
  })();

  const handlePrimary = async () => {
    trackEvent("nba_primary_clicked", { state, cta_label: content.primary.label });
    await content.primary.onClick();
  };

  const handleSecondary = async () => {
    if (!content.secondary) return;
    trackEvent("nba_secondary_clicked", {
      state,
      cta_label: content.secondary.label,
    });
    await content.secondary.onClick();
  };

  const PrimaryIcon = content.primary.icon;
  const SecondaryIcon = content.secondary?.icon;

  const isMoneyTone = content.tone === "money";
  const cardClass = isMoneyTone
    ? "border-0 shadow-md overflow-visible bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10"
    : "border-0 shadow-md overflow-visible";
  const iconWrapperClass = isMoneyTone
    ? "h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0"
    : "h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shrink-0";

  const contentPadding = variant === "desktop" ? "p-6" : "p-5";
  const titleClass = variant === "desktop"
    ? "font-semibold text-foreground text-lg mb-1"
    : "font-semibold text-foreground text-lg mb-1";

  return (
    <Card className={cardClass} data-testid={`card-nba-${state.toLowerCase()}`}>
      <CardContent className={contentPadding}>
        <div className="flex items-start gap-4">
          <div className={iconWrapperClass}>
            <PrimaryIcon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={titleClass} data-testid="text-nba-title">
              {content.title}
            </p>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-nba-subtitle">
              {content.subtitle}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                onClick={handlePrimary}
                data-testid="button-nba-primary"
              >
                <PrimaryIcon className="h-4 w-4 mr-2" />
                {content.primary.label}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {content.secondary && SecondaryIcon && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleSecondary}
                  data-testid="button-nba-secondary"
                >
                  <SecondaryIcon className="h-4 w-4 mr-2" />
                  {content.secondary.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
