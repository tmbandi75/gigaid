import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSpinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/apiFetch";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
import { CampaignSuggestionBanner } from "@/components/CampaignSuggestionBanner";
import {
  DollarSign,
  Briefcase,
  MessageSquare,
  CheckCircle2,
  Plus,
  Mic,
  Clock,
  ChevronRight,
  Sparkles,
  X,
  Zap,
  Target,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Share2,
} from "lucide-react";
import {
  formatCurrency,
  getIconForType,
  getStickyCtaInfo,
  type ActionItem,
  type GamePlanStats,
} from "@/lib/stickyCta";
import { AddServiceDialog } from "@/components/settings/AddServiceDialog";
import { motion, AnimatePresence } from "framer-motion";
import { CoachingRenderer } from "@/coaching/CoachingRenderer";
import { BookingLinkShare } from "@/components/booking-link";
import { useUpgradeOrchestrator, useStallSignals, UpgradeNudgeModal } from "@/upgrade";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { canShareContent } from "@/lib/share";
import {
  attemptShareBookingLink,
  copyBookingLinkToClipboard,
} from "@/lib/bookingLinkShareFlow";
import { trackEvent } from "@/components/PostHogProvider";
import { recordCopy, recordShareTap } from "@/lib/bookingLinkAnalytics";
import { getSubtitleMessage, type EncouragementData } from "@/encouragement/encouragementEngine";
import { ActivationChecklist } from "@/components/activation/ActivationChecklist";
import { GamePlanDesktopView } from "@/components/game-plan/GamePlanDesktopView";
import { NextBestActionCard, deriveNBAState } from "@/components/dashboard/NextBestActionCard";
import type { NBAState } from "@/lib/nbaState";
import { shouldDemoteNBAMoneyTone, shouldSuppressBookingLinkPrimary } from "@/lib/nbaStyling";

interface RecentItem {
  id: string;
  type: string;
  title: string;
  completedAt: string;
}

interface GamePlanData {
  priorityItem: ActionItem | null;
  upNextItems: ActionItem[];
  stats: GamePlanStats;
  recentlyCompleted: RecentItem[];
  encouragementData?: EncouragementData;
  dashboardSummary?: {
    totalJobs: number;
    completedJobs: number;
    totalLeads: number;
    totalInvoices: number;
    sentInvoices: number;
    hasClients?: boolean;
    hasUninvoicedCompletedJobs?: boolean;
    hasLinkShared?: boolean;
  };
}

interface NextAction {
  id: string;
  userId: string;
  entityType: "lead" | "job" | "invoice";
  entityId: string;
  stallType: string;
  action: string;
  reason: string;
  priority: number;
  status: "active" | "acted" | "dismissed" | "expired" | "auto_executed";
  autoExecutable: boolean;
  createdAt: string;
  expiresAt: string;
  actedAt: string | null;
  autoExecutedAt: string | null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function getEntityLabel(entityType: string): string {
  switch (entityType) {
    case "lead": return "Lead";
    case "job": return "Job";
    case "invoice": return "Invoice";
    default: return "Item";
  }
}

function getEntityRoute(entityType: string, entityId: string): string {
  switch (entityType) {
    case "lead": return `/leads/${entityId}`;
    case "job": return `/jobs/${entityId}`;
    case "invoice": return `/invoices/${entityId}`;
    default: return "/";
  }
}

function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${firstName}`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function TodaysGamePlanPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showVoiceNotes, setShowVoiceNotes] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const isMobile = useIsMobile();
  const stallSignals = useStallSignals();
  const stallOrchestrator = useUpgradeOrchestrator({ capabilityKey: 'sms.auto_followups', surface: 'game_plan' });
  const { user } = useAuth();
  const firstName = user?.firstName || user?.name?.split(" ")[0] || user?.username || "there";
  const greeting = getGreeting(firstName);
  const { data, isLoading } = useQuery<GamePlanData>({
    queryKey: QUERY_KEYS.dashboardGamePlan(),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const encouragementData = data?.encouragementData;
  const subtitleRef = useRef<string | null>(null);
  if (encouragementData && subtitleRef.current === null) {
    subtitleRef.current = getSubtitleMessage(encouragementData);
  }
  const subtitleText = subtitleRef.current || "Let's get you paid today";

  const dashboardSummary = data?.dashboardSummary;

  const { data: nextActions = [] } = useQuery<NextAction[]>({
    queryKey: QUERY_KEYS.nextActions(),
    queryFn: () => apiFetch<NextAction[]>("/api/next-actions?limit=10"),
    staleTime: 60000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const { data: profile } = useQuery<{ services: string[] | null; servicesCount: number }>({
    queryKey: QUERY_KEYS.profile(),
    staleTime: 300000,
  });

  // Reads from the same react-query cache that BookingLinkShare populates,
  // so the empty-state "Send Booking Link" button can trigger the same
  // share flow without any extra network round-trips.
  const { data: bookingLinkData } = useQuery<{
    bookingLink: string | null;
    servicesCount: number;
  }>({
    queryKey: QUERY_KEYS.bookingLink(),
  });

  const { toast } = useToast();

  const triggerBookingLinkShare = async (screen: "plan_empty"): Promise<void> => {
    const bookingLink = bookingLinkData?.bookingLink ?? null;
    if (!bookingLink) {
      toast({
        title: "Booking link not ready yet",
        description: "Add a service first to generate your booking link.",
      });
      navigate("/profile");
      return;
    }
    const invalidateGamePlan = () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });

    trackEvent("booking_link_share_opened", { screen });
    void recordShareTap("plan");

    if (!canShareContent()) {
      const { copied: ok } = await copyBookingLinkToClipboard({
        bookingLink,
        userId: user?.id,
        onLocalMark: invalidateGamePlan,
        onApiSuccess: invalidateGamePlan,
      });
      if (ok) {
        trackEvent("booking_link_copied", { screen });
        void recordCopy("plan");
        toast({
          title: "Link copied",
          description: "Your booking link is ready to share",
        });
        trackEvent("booking_link_shared", { screen, method: "copy" });
      } else {
        toast({
          title: "Couldn't copy",
          description: "Please copy the link manually",
          variant: "destructive",
        });
      }
      return;
    }

    const { shared, target } = await attemptShareBookingLink({
      bookingLink,
      shareTitle: "Book my services",
      shareText: "Schedule a job with me using this link:",
      dialogTitle: "Share booking link",
      userId: user?.id,
      onLocalMark: invalidateGamePlan,
      onApiSuccess: invalidateGamePlan,
    });
    if (shared) {
      trackEvent("booking_link_shared", { screen, method: "share", target });
    }
  };

  const handleEmptyStateSendBookingLink = () => {
    void triggerBookingLinkShare("plan_empty");
  };

  const actMutation = useApiMutation(
    (id: string) => apiFetch(`/api/next-actions/${id}/act`, { method: "POST" }),
    [QUERY_KEYS.nextActions()]
  );

  const dismissMutation = useApiMutation(
    (id: string) => apiFetch(`/api/next-actions/${id}/dismiss`, { method: "POST" }),
    [QUERY_KEYS.nextActions()]
  );

  const { priorityItem, upNextItems, stats, recentlyCompleted } = data || {
    priorityItem: null,
    upNextItems: [],
    stats: { jobsToday: 0, moneyCollectedToday: 0, moneyWaiting: 0, messagesToSend: 0 },
    recentlyCompleted: [],
  };

  const servicesCount = profile?.servicesCount || 0;
  const totalJobs = dashboardSummary?.totalJobs || 0;
  const totalInvoices = dashboardSummary?.totalInvoices || 0;

  type FirstTimeUserState = "no_services" | "no_jobs" | "no_invoices" | "normal";

  const getFirstTimeUserState = (): FirstTimeUserState => {
    if (servicesCount === 0 && totalJobs === 0 && totalInvoices === 0) return "no_services";
    if (servicesCount > 0 && totalJobs === 0) return "no_jobs";
    if (totalJobs > 0 && totalInvoices === 0) return "no_invoices";
    return "normal";
  };

  const firstTimeUserState = getFirstTimeUserState();
  const nbaState = deriveNBAState(dashboardSummary, user?.id);
  // NBA card is the single dynamic activation card — always rendered.
  const showNBACard = true;
  // Suppress competing standalone Share Link primary only when NBA's primary
  // CTA is itself Share Link (NEW_USER, NO_JOBS_YET) or Create Invoice
  // (READY_TO_INVOICE — spec requires nearby Share Link to be demoted).
  const suppressBookingLinkPrimary = shouldSuppressBookingLinkPrimary(nbaState);

  const stickyCtaInfo = useMemo(
    () => getStickyCtaInfo(stats, priorityItem, nbaState),
    [stats, priorityItem, nbaState]
  );

  const stickyCtaActive = isMobile && !!stickyCtaInfo;
  useEffect(() => {
    if (!stickyCtaActive) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--sticky-cta-offset");
    root.style.setProperty("--sticky-cta-offset", "4.5rem");
    return () => {
      if (previous) {
        root.style.setProperty("--sticky-cta-offset", previous);
      } else {
        root.style.removeProperty("--sticky-cta-offset");
      }
    };
  }, [stickyCtaActive]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8 flex items-center justify-center">
        <PageSpinner message="Loading your game plan..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-game-plan">
      {/* Header */}
      {isMobile ? (
        <div className="px-5 pt-5 pb-4 bg-background">
          <p
            className="text-t-meta font-regular text-muted-foreground mb-1"
            data-testid="text-greeting"
          >
            {greeting}
          </p>
          <h1
            className="text-t-hero font-bold text-foreground leading-tight"
            data-testid="text-mobile-hero-title"
          >
            Get your next paid job today
          </h1>
          <p
            className="text-sm text-muted-foreground mt-2"
            data-testid="text-mobile-hero-subtitle"
          >
            Most pros get booked after sharing their link 3–5 times.
          </p>
          {/*
            STATIC PLACEHOLDER — not wired to a real share counter yet.
            Replace `0` with the user's actual share count when the
            booking-link share-funnel data becomes available on the
            client (see /api/track/booking-link-shared).
          */}
          <p
            className="text-xs font-medium text-muted-foreground mt-2"
            data-testid="text-mobile-hero-progress"
          >
            Today's progress: 0 / 5 shares
          </p>
          <CoachingRenderer screen="dashboard" />
        </div>
      ) : (
        <div className="border-b bg-background sticky top-0 z-[999]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
            <p className="text-t-meta font-regular text-muted-foreground mb-0.5" data-testid="text-greeting">{greeting}</p>
            <h1 className="text-t-hero font-bold text-foreground" data-testid="text-encouragement-subtitle-desktop">{subtitleText}</h1>
            <CoachingRenderer screen="dashboard" />
          </div>
        </div>
      )}

      {/* Desktop layout */}
      <div className="hidden md:block">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <GamePlanDesktopView
            priorityItem={priorityItem}
            upNextItems={upNextItems}
            stats={stats}
            recentlyCompleted={recentlyCompleted}
            nextActions={nextActions}
            firstTimeUserState={firstTimeUserState}
            stepsToGettingPaid={0}
            dashboardSummary={dashboardSummary}
            userId={user?.id}
            navigate={navigate}
            onShowVoiceNotes={() => setShowVoiceNotes(true)}
            onShowAddService={() => setShowAddService(true)}
            onActMutation={(id) => actMutation.mutate(id)}
            onDismissMutation={(id) => dismissMutation.mutate(id)}
            onStallClick={() => stallOrchestrator.maybeShowStallPrompt(
              stallSignals.topStall!.stallType,
              stallSignals.topStall!.count,
              stallSignals.topStall!.totalMoneyAtRisk
            )}
            hasActionableStall={stallSignals.hasActionableStall}
            topStall={stallSignals.topStall}
            invalidateGamePlan={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() })}
          />
        </div>
      </div>

      {/* Mobile layout */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="block md:hidden space-y-5 px-4 py-4 pb-28"
      >

        {/*
          Hero booking-link card sits directly beneath the page header
          (title + subtitle + static progress) so the booking link is
          the first interactive surface on the screen — the new top-of-
          funnel CTA. The card auto-hides itself when the user has no
          services / no booking link yet (handled inside BookingLinkShare).
          When another primary CTA is competing for attention (money
          waiting OR an NBA state whose own primary IS this same Share
          Link / Create Invoice action), the hero CTA demotes to outline
          so we never render two primary buttons above the fold.
        */}
        <motion.div variants={itemVariants}>
          <BookingLinkShare
            variant="hero"
            context="plan"
            demoted={stats.moneyWaiting > 0 || suppressBookingLinkPrimary}
          />
        </motion.div>

        <ActivationChecklist />

        {/* Money-at-a-glance strip */}
        {firstTimeUserState === "normal" && (stats.moneyWaiting > 0 || stats.moneyCollectedToday > 0) && (
          <motion.div variants={itemVariants}>
            <div className="flex items-stretch gap-3">
              {stats.moneyWaiting > 0 && (
                <Card
                  className="flex-1 border-0 shadow-sm cursor-pointer hover-elevate bg-amber-50 dark:bg-amber-950/20"
                  onClick={() => navigate("/invoices")}
                  data-testid="stat-money-waiting"
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground leading-tight">{formatCurrency(stats.moneyWaiting)}</p>
                      <p className="text-xs text-muted-foreground">waiting</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {stats.moneyCollectedToday > 0 && (
                <Card
                  className="flex-1 border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/20"
                  data-testid="stat-money-collected"
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground leading-tight">{formatCurrency(stats.moneyCollectedToday)}</p>
                      <p className="text-xs text-muted-foreground">collected today</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {/* Stall upgrade banner */}
        {stallSignals.hasActionableStall && stallSignals.topStall && (
          <motion.div variants={itemVariants}>
            <Card
              className="border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover-elevate"
              onClick={() => stallOrchestrator.maybeShowStallPrompt(
                stallSignals.topStall!.stallType,
                stallSignals.topStall!.count,
                stallSignals.topStall!.totalMoneyAtRisk
              )}
              data-testid="card-stall-upgrade-banner"
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {stallSignals.topStall.totalMoneyAtRisk > 0
                        ? `${formatCurrency(stallSignals.topStall.totalMoneyAtRisk)} at risk`
                        : `${stallSignals.topStall.count} items need attention`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Tap to see how upgrading can help</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <CampaignSuggestionBanner />

        {/*
          Note: the standalone BookingLinkShare(variant="primary") block
          that used to live here has been replaced by the hero booking-
          link card rendered at the top of this container. Keeping it
          here would render the booking-link surface twice on mobile.
        */}

        {showNBACard && (
          <motion.div variants={itemVariants}>
            {/*
              When money is waiting, the standalone Collect Payment card below
              owns the green money tone (it carries the concrete dollar figure).
              Demote NBA so we never render two money-toned primary cards at once.
            */}
            <NextBestActionCard
              summary={dashboardSummary}
              variant="mobile"
              userId={user?.id}
              demoteMoneyTone={shouldDemoteNBAMoneyTone(stats)}
            />
          </motion.div>
        )}

        {/* CARD 1 — Payment Card (Money First) */}
        {stats.moneyWaiting > 0 && (
          <motion.div variants={itemVariants}>
            <Card
              className="border-0 shadow-md overflow-visible bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10"
              data-testid="card-payment"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Collect Payment</span>
                </div>
                <p className="text-3xl font-bold text-foreground mb-1">
                  {formatCurrency(stats.moneyWaiting)}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  waiting to be collected
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate("/invoices")}
                  data-testid="button-collect-payment"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Collect Payment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* CARD 2 — Priority Action (only for active users; first-timers are served by NBA above) */}
        <motion.section variants={itemVariants}>
          <AnimatePresence mode="wait">
            {priorityItem && !(priorityItem.type === "invoice" && stats.moneyWaiting > 0) ? (
              <motion.div
                key="priority"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="border-0 shadow-md overflow-visible" data-testid="card-priority-item">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">Do This First</span>
                      {priorityItem.urgency === "critical" && (
                        <Badge variant="destructive" className="text-xs">Urgent</Badge>
                      )}
                    </div>
                    <div className="flex items-start gap-4">
                      {(() => {
                        const Icon = getIconForType(priorityItem.type);
                        return (
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            priorityItem.urgency === "critical" ? "bg-red-500" :
                            priorityItem.urgency === "high" ? "bg-orange-500" : "bg-primary"
                          }`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                        );
                      })()}
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-lg mb-1">{priorityItem.title}</p>
                        <p className="text-sm text-muted-foreground mb-4">{priorityItem.subtitle}</p>
                        <Button
                          className="w-full"
                          onClick={() => {
                            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });
                            navigate(priorityItem.actionRoute);
                          }}
                          data-testid="button-priority-action"
                        >
                          {priorityItem.actionLabel}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : !priorityItem && stats.moneyWaiting === 0 ? (
              <motion.div
                key="caught-up"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="border shadow-sm" data-testid="card-all-caught-up">
                  <CardContent className="p-4 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Briefcase className="h-6 w-6 text-primary" />
                    </div>
                    <p
                      className="text-t-primary font-semibold text-foreground mb-1"
                      data-testid="text-empty-state-title"
                    >
                      No active jobs — let's get you booked
                    </p>
                    <p
                      className="text-t-body font-regular text-muted-foreground mb-4"
                      data-testid="text-empty-state-subtitle"
                    >
                      Send your link to a few people and land your next job.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Button
                        size="sm"
                        onClick={handleEmptyStateSendBookingLink}
                        data-testid="button-empty-state-send-booking-link"
                        className="w-full sm:w-auto"
                      >
                        <Share2 className="h-4 w-4 mr-1" />
                        Send Booking Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/jobs/new")}
                        data-testid="button-empty-state-create-job"
                        className="w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create a Job
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.section>

        {/* CARD 3 — Up Next (secondary actions) */}
        {upNextItems.length > 0 && (
          <motion.section variants={itemVariants}>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-2 px-1">Up Next</h2>
            <div className="space-y-2">
              {upNextItems.slice(0, 3).map((item) => {
                const Icon = getIconForType(item.type);
                return (
                  <Card
                    key={item.id}
                    className="border shadow-sm hover-elevate cursor-pointer"
                    onClick={() => navigate(item.actionRoute)}
                    data-testid={`card-upnext-${item.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        <Button size="sm" variant="ghost" data-testid={`button-upnext-action-${item.id}`}>
                          {item.actionLabel}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* CARD 4 — Smart Suggestions */}
        {nextActions.length > 0 && (
          <motion.section variants={itemVariants}>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-2 px-1 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Smart Suggestions
            </h2>
            <div className="space-y-2">
              {nextActions.slice(0, 4).map((action) => {
                const Icon = getIconForType(action.entityType);
                return (
                  <Card
                    key={action.id}
                    className="border shadow-sm"
                    data-testid={`card-suggestion-${action.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {getEntityLabel(action.entityType)}
                            </Badge>
                            {action.autoExecutable && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Zap className="h-3 w-3" />
                                Auto
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground text-sm">{action.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 mb-2">{action.reason}</p>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                actMutation.mutate(action.id);
                                navigate(getEntityRoute(action.entityType, action.entityId));
                              }}
                              data-testid={`button-act-${action.id}`}
                            >
                              Do It
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => dismissMutation.mutate(action.id)}
                              data-testid={`button-dismiss-${action.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Stats grid - compact */}
        {firstTimeUserState === "normal" && (
          <motion.section variants={itemVariants}>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-2 px-1">Today at a Glance</h2>
            <div className="grid grid-cols-2 gap-2">
              <Card className="border shadow-sm" data-testid="stat-jobs-today">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-t-hero font-bold text-foreground leading-tight">{stats.jobsToday}</p>
                    <p className="text-t-meta font-regular text-muted-foreground">jobs today</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm" data-testid="stat-messages">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-t-hero font-bold text-foreground leading-tight">{stats.messagesToSend}</p>
                    <p className="text-t-meta font-regular text-muted-foreground">to send</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.section>
        )}

        {/* Quick Actions — visually de-emphasized vs. the hero booking-link
            card so the grid clearly recedes (no border, muted bg, smaller
            icon container). Testids preserved. */}
        <motion.section variants={itemVariants}>
          <h2 className="text-t-primary font-semibold text-muted-foreground mb-2 px-1">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/jobs/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-muted/40 hover-elevate"
              data-testid="button-add-job"
            >
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">New Job</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Create a job</span>
            </button>
            <button
              onClick={() => navigate("/invoices/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-muted/40 hover-elevate"
              data-testid="button-ask-payment"
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Invoice</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Send & get paid</span>
            </button>
            <button
              onClick={() => navigate("/reminders")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-muted/40 hover-elevate"
              data-testid="button-message-client"
            >
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Message</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Text clients</span>
            </button>
            <button
              onClick={() => setShowVoiceNotes(true)}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-muted/40 hover-elevate"
              data-testid="button-talk-it-in"
            >
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Mic className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Voice</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Speak notes</span>
            </button>
          </div>
        </motion.section>

        {/* Done Recently */}
        {recentlyCompleted.length > 0 && (
          <motion.section variants={itemVariants}>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-2 px-1">Done Recently</h2>
            <div className="space-y-1">
              {recentlyCompleted.map((item) => {
                const Icon = getIconForType(item.type);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg"
                    data-testid={`recent-${item.id}`}
                  >
                    <div className="h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="flex-1 text-sm text-muted-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground/60 shrink-0">{formatRelativeTime(item.completedAt)}</p>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </motion.div>

      {/* Sticky bottom CTA (mobile only) — driven by money-waiting, invoice priority, or NBA primary */}
      {isMobile && stickyCtaInfo && (
        <div
          className="fixed left-0 right-0 p-3 z-50"
          style={{ bottom: "calc(4rem + var(--safe-area-inset-bottom))" }}
          data-testid="sticky-cta-wrapper"
        >
          <div className="max-w-lg mx-auto">
            <Button
              size="lg"
              className="w-full shadow-lg rounded-xl h-12 text-base font-semibold"
              onClick={() => navigate(stickyCtaInfo.route)}
              data-testid="button-sticky-cta"
            >
              <stickyCtaInfo.icon className="h-5 w-5 mr-2" />
              {stickyCtaInfo.label}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {showVoiceNotes && (
        <Dialog open={showVoiceNotes} onOpenChange={setShowVoiceNotes}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Talk It In
                </DialogTitle>
                <Button
                  variant="ghost"
                  onClick={() => { setShowVoiceNotes(false); navigate("/voice-notes"); }}
                  data-testid="link-view-voice-history"
                >
                  View History
                </Button>
              </div>
            </DialogHeader>
            <VoiceNoteSummarizer
              onNoteSaved={() => setShowVoiceNotes(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <AddServiceDialog
        open={showAddService}
        onOpenChange={setShowAddService}
      />

      {stallOrchestrator.modalPayload && (
        <UpgradeNudgeModal
          open={stallOrchestrator.showModal}
          onOpenChange={stallOrchestrator.dismissModal}
          title={stallOrchestrator.modalPayload.title}
          subtitle={stallOrchestrator.modalPayload.subtitle}
          bullets={stallOrchestrator.modalPayload.bullets}
          primaryCta={stallOrchestrator.modalPayload.primaryCta}
          secondaryCta={stallOrchestrator.modalPayload.secondaryCta}
          variant={stallOrchestrator.variant}
          triggerType={stallOrchestrator.modalPayload.triggerType}
          capabilityKey={stallOrchestrator.modalPayload.capabilityKey}
          surface="game_plan"
          plan={stallOrchestrator.modalPayload.plan}
          current={stallOrchestrator.modalPayload.current}
          limit={stallOrchestrator.modalPayload.limit}
          remaining={stallOrchestrator.modalPayload.remaining}
          recommendedPlan={stallOrchestrator.modalPayload.recommendedPlan}
        />
      )}
    </div>
  );
}
