import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function getUrgencyStyles(urgency: "critical" | "high" | "normal") {
  switch (urgency) {
    case "critical":
      return {
        border: "border-l-4 border-l-red-500",
        iconBg: "bg-red-500",
        iconColor: "text-white",
      };
    case "high":
      return {
        border: "border-l-4 border-l-orange-500",
        iconBg: "bg-orange-500",
        iconColor: "text-white",
      };
    default:
      return {
        border: "border-l-4 border-l-emerald-500",
        iconBg: "bg-emerald-500",
        iconColor: "text-white",
      };
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

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

function getGreeting(firstName: string): { emoji: string; text: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { emoji: "\u2600\uFE0F", text: `Good Morning, ${firstName}` };
  } else if (hour >= 12 && hour < 17) {
    return { emoji: "\uD83C\uDF24\uFE0F", text: `Good Afternoon, ${firstName}` };
  } else {
    return { emoji: "\uD83C\uDF19", text: `Good Evening, ${firstName}` };
  }
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
  const subtitleText = subtitleRef.current || "Do these things to stay on track and get paid";

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8 flex items-center justify-center">
        <PageSpinner message="Loading your game plan..." />
      </div>
    );
  }

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
    if (servicesCount === 0 && totalJobs === 0 && totalInvoices === 0) {
      return "no_services";
    }
    if (servicesCount > 0 && totalJobs === 0) {
      return "no_jobs";
    }
    if (totalJobs > 0 && totalInvoices === 0) {
      return "no_invoices";
    }
    return "normal";
  };

  const firstTimeUserState = getFirstTimeUserState();

  function renderMobileHeader() {
    return (
      <div className="px-4 py-5 bg-background border-b">
        <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-greeting">
          {greeting.emoji} {greeting.text}
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-encouragement-subtitle">{subtitleText}</p>
        <CoachingRenderer screen="dashboard" />
      </div>
    );
  }

  function renderDesktopHeader() {
    return (
      <div className="border-b bg-background sticky top-0 z-[999]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-greeting">
                {greeting.emoji} {greeting.text}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-encouragement-subtitle-desktop">{subtitleText}</p>
              <CoachingRenderer screen="dashboard" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-game-plan">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}
      
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`space-y-6 ${isMobile ? "px-4 py-6 pb-24" : "max-w-7xl mx-auto px-6 lg:px-8 py-6"}`}
      >

        <ActivationChecklist />

        {stallSignals.hasActionableStall && stallSignals.topStall && (
          <Card
            className="border-amber-500/20 bg-amber-500/5 cursor-pointer hover-elevate"
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
                      ? `$${(stallSignals.topStall.totalMoneyAtRisk / 100).toFixed(0)} at risk`
                      : `${stallSignals.topStall.count} items need attention`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tap to see how upgrading can help</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        <CampaignSuggestionBanner />

        <motion.div variants={itemVariants}>
          <BookingLinkShare variant="primary" context="plan" />
        </motion.div>

        <motion.section variants={itemVariants} aria-labelledby="do-this-first">
          <h2 id="do-this-first" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {firstTimeUserState === "no_services" ? "Start here" : "Do This First"}
          </h2>
          <AnimatePresence mode="wait">
            {firstTimeUserState === "no_services" ? (
              <motion.div
                key="add-service"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card
                  className="border-0 shadow-md overflow-hidden border-l-4 border-l-primary"
                  data-testid="card-add-first-service"
                >
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary">
                        <Wrench className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-lg">
                          Add your first service
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Tell GigAid what kind of work you do so we can help you book jobs and get paid.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => setShowAddService(true)}
                          data-testid="button-add-first-service"
                        >
                          Add a service
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : firstTimeUserState === "no_jobs" ? (
              <motion.div
                key="add-job"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card
                  className="border-0 shadow-md overflow-hidden border-l-4 border-l-blue-500"
                  data-testid="card-add-first-job"
                >
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500">
                        <Briefcase className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-lg">
                          Create your first job
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add a job to start tracking your work and getting paid.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => navigate("/jobs/new")}
                          data-testid="button-add-first-job"
                        >
                          Create a job
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : firstTimeUserState === "no_invoices" ? (
              <motion.div
                key="add-invoice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card
                  className="border-0 shadow-md overflow-hidden border-l-4 border-l-emerald-500"
                  data-testid="card-add-first-invoice"
                >
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500">
                        <DollarSign className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-lg">
                          Create your first invoice
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Send an invoice to get paid for your work.
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => navigate("/invoices/new")}
                          data-testid="button-add-first-invoice"
                        >
                          Create invoice
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : priorityItem ? (
              <motion.div
                key="priority"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card
                  className={`border-0 shadow-md overflow-hidden ${getUrgencyStyles(priorityItem.urgency).border}`}
                  data-testid="card-priority-item"
                >
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          getUrgencyStyles(priorityItem.urgency).iconBg
                        }`}
                      >
                        {(() => {
                          const Icon = getIconForType(priorityItem.type);
                          return (
                            <Icon
                              className={`h-6 w-6 ${getUrgencyStyles(priorityItem.urgency).iconColor}`}
                            />
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-lg">
                          {priorityItem.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {priorityItem.subtitle}
                        </p>
                        <Button
                          className="mt-4"
                          onClick={() => {
                            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardGamePlan() });
                            navigate(priorityItem.actionRoute);
                          }}
                          data-testid="button-priority-action"
                        >
                          {priorityItem.actionLabel}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="caught-up"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card className="border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/30" data-testid="card-all-caught-up">
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Quiet day
                        </p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80 mb-3">
                          Great time to follow up or send invoices.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                          onClick={() => navigate("/leads")}
                          data-testid="button-get-ahead"
                        >
                          Follow up on leads
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {upNextItems.length > 0 && (
          <motion.section variants={itemVariants} aria-labelledby="up-next">
            <h2 id="up-next" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Up Next
            </h2>
            <div className="space-y-3">
              {upNextItems.slice(0, 3).map((item) => {
                const Icon = getIconForType(item.type);
                return (
                  <Card
                    key={item.id}
                    className="border-0 shadow-sm hover-elevate cursor-pointer"
                    onClick={() => navigate(item.actionRoute)}
                    data-testid={`card-upnext-${item.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
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

        {nextActions.length > 0 && (
          <motion.section variants={itemVariants} aria-labelledby="smart-suggestions">
            <h2 id="smart-suggestions" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              What To Do Next
            </h2>
            <div className="space-y-3">
              {nextActions.slice(0, 5).map((action) => {
                const Icon = getIconForType(action.entityType);
                return (
                  <Card
                    key={action.id}
                    className="border-0 shadow-md bg-gradient-to-r from-purple-500/5 via-transparent to-transparent"
                    data-testid={`card-suggestion-${action.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400">
                              {getEntityLabel(action.entityType)}
                            </span>
                            {action.autoExecutable && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Auto-send eligible
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {action.action}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {action.reason}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => {
                                actMutation.mutate(action.id);
                                navigate(getEntityRoute(action.entityType, action.entityId));
                              }}
                              data-testid={`button-act-${action.id}`}
                            >
                              Do It Now
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                            <Button
                              size="sm"
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

        <motion.section variants={itemVariants} aria-labelledby="today-glance">
          <h2 id="today-glance" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Today at a Glance
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-transparent" data-testid="stat-jobs-today">
              <CardContent className="p-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center mx-auto mb-2">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.jobsToday}</p>
                <p className="text-xs text-muted-foreground">Jobs today</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-transparent" data-testid="stat-money-collected">
              <CardContent className="p-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.moneyCollectedToday)}
                </p>
                <p className="text-xs text-muted-foreground">Collected today</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500/10 to-transparent" data-testid="stat-money-waiting">
              <CardContent className="p-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-2">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.moneyWaiting)}
                </p>
                <p className="text-xs text-muted-foreground">Money waiting</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500/10 to-transparent" data-testid="stat-messages">
              <CardContent className="p-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-violet-500 flex items-center justify-center mx-auto mb-2">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.messagesToSend}</p>
                <p className="text-xs text-muted-foreground">Messages to send</p>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} aria-labelledby="quick-actions">
          <h2 id="quick-actions" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="border shadow-sm hover-elevate cursor-pointer"
              onClick={() => navigate("/jobs/new")}
              data-testid="button-add-job"
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium text-sm text-foreground">Add a Job</span>
              </CardContent>
            </Card>
            <Card
              className="border shadow-sm hover-elevate cursor-pointer"
              onClick={() => navigate("/invoices/new")}
              data-testid="button-ask-payment"
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="font-medium text-sm text-foreground">Ask for Payment</span>
              </CardContent>
            </Card>
            <Card
              className="border shadow-sm hover-elevate cursor-pointer"
              onClick={() => navigate("/reminders")}
              data-testid="button-message-client"
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-violet-600" />
                </div>
                <span className="font-medium text-sm text-foreground">Message a Client</span>
              </CardContent>
            </Card>
            <Card
              className="border shadow-sm hover-elevate cursor-pointer"
              onClick={() => setShowVoiceNotes(true)}
              data-testid="button-talk-it-in"
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Mic className="h-5 w-5 text-amber-600" />
                </div>
                <span className="font-medium text-sm text-foreground">Talk It In</span>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {recentlyCompleted.length > 0 && (
          <motion.section variants={itemVariants} aria-labelledby="done-recently">
            <h2 id="done-recently" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Done Recently
            </h2>
            <div className="space-y-2">
              {recentlyCompleted.map((item) => {
                const Icon = getIconForType(item.type);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30"
                    data-testid={`recent-${item.id}`}
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground/70">
                      {formatRelativeTime(item.completedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </motion.div>

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
