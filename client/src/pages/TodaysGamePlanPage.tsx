import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceNoteSummarizer } from "@/components/ai/VoiceNoteSummarizer";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function TodaysGamePlanPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showVoiceNotes, setShowVoiceNotes] = useState(false);

  const { data, isLoading } = useQuery<GamePlanData>({
    queryKey: ["/api/dashboard/game-plan"],
  });

  const { data: nextActions = [] } = useQuery<NextAction[]>({
    queryKey: ["/api/next-actions"],
    refetchInterval: 60000,
  });

  const actMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/next-actions/${id}/act`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/next-actions"] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/next-actions/${id}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/next-actions"] }),
  });

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

  return (
    <div className="min-h-screen bg-background" data-testid="page-game-plan">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 lg:p-8 lg:max-w-2xl lg:mx-auto space-y-6"
      >
        <motion.div variants={itemVariants} className="mb-4">
          <h1 className="text-xl font-bold text-foreground" data-testid="heading-game-plan">
            Today's Game Plan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Do these things to stay on track and get paid
          </p>
        </motion.div>

        <motion.section variants={itemVariants} aria-labelledby="do-this-first">
          <h2 id="do-this-first" className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Do This First
          </h2>
          <AnimatePresence mode="wait">
            {priorityItem ? (
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
                          onClick={() => navigate(priorityItem.actionRoute)}
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
                          You're on track today
                        </p>
                        <p className="text-sm text-emerald-600/80 dark:text-emerald-500/80 mb-3">
                          No urgent actions right now. Want to get ahead?
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
    </div>
  );
}
