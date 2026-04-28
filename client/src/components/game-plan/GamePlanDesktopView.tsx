import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingLinkShare } from "@/components/booking-link";
import { ActivationChecklist } from "@/components/activation/ActivationChecklist";
import { CampaignSuggestionBanner } from "@/components/CampaignSuggestionBanner";
import { NextBestActionCard, deriveNBAState, type DashboardSummary } from "@/components/dashboard/NextBestActionCard";
import { shouldDemoteNBAMoneyTone, shouldSuppressBookingLinkPrimary } from "@/lib/nbaStyling";
import { formatCurrency } from "@/lib/formatCurrency";
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
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

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

interface StallInfo {
  stallType: string;
  count: number;
  totalMoneyAtRisk: number;
}

interface GamePlanDesktopViewProps {
  priorityItem: ActionItem | null;
  upNextItems: ActionItem[];
  stats: GamePlanStats;
  recentlyCompleted: RecentItem[];
  nextActions: NextAction[];
  firstTimeUserState: "no_services" | "no_jobs" | "no_invoices" | "normal";
  stepsToGettingPaid: number;
  dashboardSummary: DashboardSummary | undefined;
  navigate: (path: string) => void;
  onShowVoiceNotes: () => void;
  onShowAddService: () => void;
  onActMutation: (id: string) => void;
  onDismissMutation: (id: string) => void;
  onStallClick: () => void;
  hasActionableStall: boolean;
  topStall: StallInfo | null;
  invalidateGamePlan: () => void;
  userId?: string;
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
    case "invoice": return DollarSign;
    case "job": return Briefcase;
    case "lead": return MessageSquare;
    case "reminder": return MessageSquare;
    case "invoice_paid": return DollarSign;
    case "job_completed": return CheckCircle2;
    default: return FileText;
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

export function GamePlanDesktopView({
  priorityItem,
  upNextItems,
  stats,
  recentlyCompleted,
  nextActions,
  firstTimeUserState,
  stepsToGettingPaid,
  navigate,
  onShowVoiceNotes,
  onShowAddService,
  onActMutation,
  onDismissMutation,
  onStallClick,
  hasActionableStall,
  topStall,
  invalidateGamePlan,
  dashboardSummary,
  userId,
}: GamePlanDesktopViewProps) {
  const nbaState = deriveNBAState(dashboardSummary, userId);
  // NBA card is the single dynamic activation card — always rendered.
  const showNBACard = true;
  // Suppress competing standalone Share Link primary only when NBA's primary
  // CTA is itself Share Link (NEW_USER, NO_JOBS_YET) or Create Invoice
  // (READY_TO_INVOICE — spec requires nearby Share Link to be demoted).
  const suppressBookingLinkPrimary = shouldSuppressBookingLinkPrimary(nbaState);
  return (
    <div className="grid grid-cols-12 gap-6" data-testid="desktop-game-plan">
      {/* LEFT COLUMN — Primary content (8 cols) */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <ActivationChecklist />

        {/* Money-at-a-glance row */}
        {firstTimeUserState === "normal" && (
          <div className="grid grid-cols-4 gap-4">
            {stats.moneyWaiting > 0 && (
              <Card
                className="col-span-2 border-0 shadow-sm cursor-pointer hover:shadow-md transition bg-amber-50 dark:bg-amber-950/20"
                role="button"
                tabIndex={0}
                onClick={() => navigate("/invoices")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/invoices"); } }}
                data-testid="desktop-stat-money-waiting"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-t-hero font-bold text-foreground leading-tight">{formatCurrency(stats.moneyWaiting)}</p>
                    <p className="text-t-meta font-regular text-muted-foreground">waiting to collect</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.moneyCollectedToday > 0 && (
              <Card
                className="col-span-2 border-0 shadow-sm bg-emerald-50 dark:bg-emerald-950/20"
                data-testid="desktop-stat-money-collected"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-t-hero font-bold text-foreground leading-tight">{formatCurrency(stats.moneyCollectedToday)}</p>
                    <p className="text-t-meta font-regular text-muted-foreground">collected today</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="border shadow-sm" data-testid="desktop-stat-jobs-today">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-t-hero font-bold text-foreground leading-tight">{stats.jobsToday}</p>
                  <p className="text-t-meta font-regular text-muted-foreground">jobs today</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm" data-testid="desktop-stat-messages">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-t-hero font-bold text-foreground leading-tight">{stats.messagesToSend}</p>
                  <p className="text-t-meta font-regular text-muted-foreground">to send</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stall upgrade banner */}
        {hasActionableStall && topStall && (
          <Card
            className="border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:shadow-md transition"
            role="button"
            tabIndex={0}
            onClick={onStallClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStallClick(); } }}
            data-testid="desktop-card-stall-upgrade-banner"
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {topStall.totalMoneyAtRisk > 0
                      ? `${formatCurrency(topStall.totalMoneyAtRisk)} at risk`
                      : `${topStall.count} items need attention`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Click to see how upgrading can help</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        <CampaignSuggestionBanner />

        {showNBACard && (
          // When money is waiting, the standalone Collect Payment card below
          // owns the green money tone (it carries the concrete dollar figure).
          // Demote NBA so we never render two money-toned primary cards at once.
          <NextBestActionCard
            summary={dashboardSummary}
            variant="desktop"
            userId={userId}
            demoteMoneyTone={shouldDemoteNBAMoneyTone(stats)}
          />
        )}

        {/* Primary Action Card (active users only — first-timers are served by NBA above) */}
        {stats.moneyWaiting > 0 ? (
          <Card
            className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10"
            data-testid="desktop-card-payment"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Collect Payment</span>
              </div>
              <p className="text-3xl font-bold text-foreground mb-1">{formatCurrency(stats.moneyWaiting)}</p>
              <p className="text-sm text-muted-foreground mb-4">waiting to be collected</p>
              <Button size="lg" onClick={() => navigate("/invoices")} data-testid="desktop-button-collect-payment">
                <DollarSign className="h-4 w-4 mr-2" />
                Collect Payment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ) : priorityItem && !(priorityItem.type === "invoice" && stats.moneyWaiting > 0) ? (
          <Card className="border-0 shadow-md" data-testid="desktop-card-priority-item">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Do This First</span>
                {priorityItem.urgency === "critical" && (
                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                )}
              </div>
              <div className="flex items-start gap-5">
                {(() => {
                  const Icon = getIconForType(priorityItem.type);
                  return (
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      priorityItem.urgency === "critical" ? "bg-red-500" :
                      priorityItem.urgency === "high" ? "bg-orange-500" : "bg-primary"
                    }`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-lg mb-1">{priorityItem.title}</p>
                  <p className="text-sm text-muted-foreground mb-4">{priorityItem.subtitle}</p>
                  <Button
                    onClick={() => {
                      invalidateGamePlan();
                      navigate(priorityItem.actionRoute);
                    }}
                    data-testid="desktop-button-priority-action"
                  >
                    {priorityItem.actionLabel}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : !priorityItem && stats.moneyWaiting === 0 ? (
          <Card className="border-0 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/20" data-testid="desktop-card-all-caught-up">
            <CardContent className="p-6 text-center">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-t-primary font-semibold text-foreground mb-1">You're all caught up</p>
              <p className="text-t-body font-regular text-muted-foreground mb-4">Great time to follow up on leads or send an invoice.</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/leads")} data-testid="desktop-button-get-ahead" className="text-t-secondary font-semibold">
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Follow Up
                </Button>
                <Button onClick={() => navigate("/invoices/new")} data-testid="desktop-button-send-invoice-caught-up" className="text-base text-white font-semibold">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Send Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Up Next */}
        {upNextItems.length > 0 && (
          <section>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-3 px-1">Up Next</h2>
            <div className="space-y-2">
              {upNextItems.slice(0, 5).map((item) => {
                const Icon = getIconForType(item.type);
                return (
                  <Card
                    key={item.id}
                    className="border shadow-sm hover:shadow-md transition cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(item.actionRoute)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(item.actionRoute); } }}
                    data-testid={`desktop-card-upnext-${item.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        {item.amount && item.amount > 0 && (
                          <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(item.amount)}</p>
                        )}
                        <Button size="sm" variant="ghost" tabIndex={-1} data-testid={`desktop-button-upnext-action-${item.id}`}>
                          {item.actionLabel}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Smart Suggestions */}
        {nextActions.length > 0 && (
          <section>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-3 px-1 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Smart Suggestions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nextActions.slice(0, 6).map((action) => {
                const Icon = getIconForType(action.entityType);
                return (
                  <Card key={action.id} className="border shadow-sm" data-testid={`desktop-card-suggestion-${action.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="secondary" className="text-xs">{getEntityLabel(action.entityType)}</Badge>
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
                                onActMutation(action.id);
                                navigate(getEntityRoute(action.entityType, action.entityId));
                              }}
                              data-testid={`desktop-button-act-${action.id}`}
                            >
                              Do It
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onDismissMutation(action.id)}
                              aria-label="Dismiss suggestion"
                              data-testid={`desktop-button-dismiss-${action.id}`}
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
          </section>
        )}
      </div>

      {/* RIGHT COLUMN — Sidebar (4 cols) */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Booking Link — suppressed when NBA primary already drives Share Link */}
        {!suppressBookingLinkPrimary && (
          <BookingLinkShare variant="primary" context="plan" />
        )}

        {/* Quick Actions */}
        <section>
          <h2 className="text-t-primary font-semibold text-muted-foreground mb-3 px-1">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/jobs/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-card shadow-sm hover:shadow-md transition border"
              data-testid="desktop-button-add-job"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">New Job</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Create a job</span>
            </button>
            <button
              onClick={() => navigate("/invoices/new")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-card shadow-sm hover:shadow-md transition border"
              data-testid="desktop-button-ask-payment"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Invoice</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Send & get paid</span>
            </button>
            <button
              onClick={() => navigate("/reminders")}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-card shadow-sm hover:shadow-md transition border"
              data-testid="desktop-button-message-client"
            >
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Message</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Text clients</span>
            </button>
            <button
              onClick={onShowVoiceNotes}
              className="flex flex-col items-center justify-center gap-1.5 p-4 min-h-[88px] rounded-xl bg-card shadow-sm hover:shadow-md transition border"
              data-testid="desktop-button-talk-it-in"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-t-secondary font-semibold text-foreground">Voice</span>
              <span className="text-t-meta font-regular text-muted-foreground -mt-1">Speak notes</span>
            </button>
          </div>
        </section>

        {/* Done Recently */}
        {recentlyCompleted.length > 0 && (
          <section>
            <h2 className="text-t-primary font-semibold text-muted-foreground mb-3 px-1">Done Recently</h2>
            <Card className="border shadow-sm">
              <CardContent className="p-3">
                <div className="space-y-1">
                  {recentlyCompleted.map((item) => {
                    const Icon = getIconForType(item.type);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg"
                        data-testid={`desktop-recent-${item.id}`}
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
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
