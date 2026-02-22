import { useState, useRef, useMemo } from "react";
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
  FileText,
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
  Wrench,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  CircleDot,
  Send,
} from "lucide-react";
import { AddServiceDialog } from "@/components/settings/AddServiceDialog";
import { motion, AnimatePresence } from "framer-motion";
import { CoachingRenderer } from "@/coaching/CoachingRenderer";
import { BookingLinkShare } from "@/components/booking-link";
import { useUpgradeOrchestrator, useStallSignals, UpgradeNudgeModal } from "@/upgrade";
import { useAuth } from "@/hooks/use-auth";
import { getSubtitleMessage, type EncouragementData } from "@/encouragement/encouragementEngine";
import { ActivationChecklist } from "@/components/activation/ActivationChecklist";

interface ActionItem {
  id: string;
  type: "invoice" | "job" | "lead" | "reminder";
  priority: number;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionRoute: string;
  urgency: "critical" | "high" | "normal";
  amount?: number;
}

interface GamePlanStats {
  jobsToday: number;
  moneyCollectedToday: number;
  moneyWaiting: number;
  messagesToSend: number;
}

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
  dashboardSummary?: { totalJobs: number; completedJobs: number; totalLeads: number; totalInvoices: number; sentInvoices: number };
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
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

function getIconForType(type: string) {
  switch (type) {
    case "invoice":
      return DollarSign;
    case "job":
      return Briefcase;
    case "lead":
      return MessageSquare;
    case "reminder":
      return MessageSquare;
    case "invoice_paid":
      return DollarSign;
    case "job_completed":
      return CheckCircle2;
    default:
      return FileText;
  }
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

function getStickyCtaInfo(
  stats: GamePlanStats,
  priorityItem: ActionItem | null,
  firstTimeState: string,
): { label: string; route: string; icon: typeof DollarSign } | null {
  if (stats.moneyWaiting > 0) {
    return {
      label: `Collect ${formatCurrency(stats.moneyWaiting)}`,
      route: "/invoices",
      icon: DollarSign,
    };
  }
  if (priorityItem?.type === "invoice") {
    return {
      label: priorityItem.actionLabel,
      route: priorityItem.actionRoute,
      icon: DollarSign,
    };
  }
  if (firstTimeState === "no_invoices") {
    return {
      label: "Send Your First Invoice",
      route: "/invoices/new",
      icon: Send,
    };
  }
  if (priorityItem) {
    const Icon = getIconForType(priorityItem.type);
    return {
      label: priorityItem.actionLabel,
      route: priorityItem.actionRoute,
      icon: Icon,
    };
  }
  return null;
}

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

  const stickyCtaInfo = useMemo(
    () => getStickyCtaInfo(stats, priorityItem, firstTimeUserState),
    [stats, priorityItem, firstTimeUserState]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8 flex items-center justify-center">
        <PageSpinner message="Loading your game plan..." />
      </div>
    );
  }

  const stepsToGettingPaid = (() => {
    if (firstTimeUserState === "no_services") return 3;
    if (firstTimeUserState === "no_jobs") return 2;
    if (firstTimeUserState === "no_invoices") return 1;
    return 0;
  })();

  return (
    <div className="min-h-screen bg-background" data-testid="page-game-plan">
      {/* Header */}
      {isMobile ? (
        <div className="px-5 pt-6 pb-5 bg-background">
          <p className="text-sm text-muted-foreground mb-0.5" data-testid="text-greeting">{greeting}</p>
          <h1 className="text-xl font-bold text-foreground" data-testid="text-encouragement-subtitle">{subtitleText}</h1>
          <CoachingRenderer screen="dashboard" />
        </div>
      ) : (
        <div className="border-b bg-background sticky top-0 z-[999]">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-5">
            <p className="text-sm text-muted-foreground mb-0.5" data-testid="text-greeting">{greeting}</p>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-encouragement-subtitle-desktop">{subtitleText}</h1>
            <CoachingRenderer screen="dashboard" />
          </div>
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`space-y-4 ${isMobile ? "px-4 py-4 pb-28" : "max-w-3xl mx-auto px-6 lg:px-8 py-6"}`}
      >

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

        <motion.div variants={itemVariants}>
          <BookingLinkShare variant="primary" context="plan" />
        </motion.div>

        {/* Progress momentum for first-time users */}
        {stepsToGettingPaid > 0 && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 px-1">
              <CircleDot className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                {stepsToGettingPaid === 1
                  ? "You're 1 step away from getting paid"
                  : `${stepsToGettingPaid} steps to your first payment`}
              </p>
            </div>
          </motion.div>
        )}

        {/* CARD 1 — Payment Card (Money First) */}
        {firstTimeUserState === "normal" && stats.moneyWaiting > 0 && (
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

        {/* CARD 2 — Primary Action / First-time CTA */}
        <motion.section variants={itemVariants}>
          <AnimatePresence mode="wait">
            {firstTimeUserState === "no_services" ? (
              <motion.div
                key="add-service"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="border-0 shadow-md overflow-visible" data-testid="card-add-first-service">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                        <Wrench className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-lg mb-1">Add your first service</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Tell us what kind of work you do so we can help you book jobs and get paid.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => setShowAddService(true)}
                          data-testid="button-add-first-service"
                        >
                          Add a Service
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : firstTimeUserState === "no_jobs" ? (
              <motion.div
                key="add-job"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card className="border-0 shadow-md overflow-visible" data-testid="card-add-first-job">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0">
                        <Briefcase className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-lg mb-1">Create your first job</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add a job to start tracking your work and getting paid.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => navigate("/jobs/new")}
                          data-testid="button-add-first-job"
                        >
                          Create a Job
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : firstTimeUserState === "no_invoices" ? (
              <motion.div
                key="add-invoice"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <Card
                  className="border-0 shadow-md overflow-visible bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10"
                  data-testid="card-add-first-invoice"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
                        <DollarSign className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground text-lg mb-1">Send your first invoice</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Get paid for the work you've done.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => navigate("/invoices/new")}
                          data-testid="button-add-first-invoice"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Create Invoice
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : priorityItem && !(priorityItem.type === "invoice" && stats.moneyWaiting > 0) ? (
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
                <Card className="border-0 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20" data-testid="card-all-caught-up">
                  <CardContent className="p-5 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">You're all caught up</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Great time to follow up on leads or send an invoice.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/leads")}
                        data-testid="button-get-ahead"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Follow Up
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate("/invoices/new")}
                        data-testid="button-send-invoice-caught-up"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Send Invoice
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Up Next</h2>
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-2">
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
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Today at a Glance</h2>
            <div className="grid grid-cols-2 gap-2">
              <Card className="border shadow-sm" data-testid="stat-jobs-today">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-tight">{stats.jobsToday}</p>
                    <p className="text-xs text-muted-foreground">jobs today</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border shadow-sm" data-testid="stat-messages">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-tight">{stats.messagesToSend}</p>
                    <p className="text-xs text-muted-foreground">to send</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.section>
        )}

        {/* Quick Actions - thumb-friendly grid */}
        <motion.section variants={itemVariants}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/jobs/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[96px] rounded-xl bg-card shadow-sm hover-elevate border"
              data-testid="button-add-job"
            >
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-foreground">New Job</span>
              <span className="text-[11px] text-muted-foreground -mt-1">Create a job</span>
            </button>
            <button
              onClick={() => navigate("/invoices/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[96px] rounded-xl bg-card shadow-sm hover-elevate border"
              data-testid="button-ask-payment"
            >
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-foreground">Invoice</span>
              <span className="text-[11px] text-muted-foreground -mt-1">Send & get paid</span>
            </button>
            <button
              onClick={() => navigate("/reminders")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[96px] rounded-xl bg-card shadow-sm hover-elevate border"
              data-testid="button-message-client"
            >
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-xs font-semibold text-foreground">Message</span>
              <span className="text-[11px] text-muted-foreground -mt-1">Text clients</span>
            </button>
            <button
              onClick={() => setShowVoiceNotes(true)}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[96px] rounded-xl bg-card shadow-sm hover-elevate border"
              data-testid="button-talk-it-in"
            >
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-foreground">Voice</span>
              <span className="text-[11px] text-muted-foreground -mt-1">Speak notes</span>
            </button>
          </div>
        </motion.section>

        {/* Done Recently */}
        {recentlyCompleted.length > 0 && (
          <motion.section variants={itemVariants}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Done Recently</h2>
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

      {/* Sticky bottom CTA (mobile only) — only show for money-waiting since other actions already have prominent cards */}
      {isMobile && stickyCtaInfo && stats.moneyWaiting > 0 && (
        <div className="fixed bottom-16 left-0 right-0 p-3 z-50" data-testid="sticky-cta-wrapper">
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
