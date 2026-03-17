import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingLinkShare } from "@/components/booking-link";
import {
  DollarSign,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
  Users,
  Briefcase,
  FileText,
  Sparkles,
  TrendingUp,
  Lock,
} from "lucide-react";
import type { ActionQueueItem } from "@shared/schema";

interface MoneyPlanDesktopViewProps {
  openItems: ActionQueueItem[];
  doneItems: ActionQueueItem[];
  isLoading: boolean;
  showCapabilityHint: boolean;
  onOpenUpgradeModal: () => void;
  onGenerate: () => void;
  onMarkDone: (id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (params: { id: string; hours: number }) => void;
  onAction: (item: ActionQueueItem) => void;
  generatePending: boolean;
  markDonePending: boolean;
  dismissPending: boolean;
  snoozePending: boolean;
}

function getSourceIcon(sourceType: string) {
  switch (sourceType) {
    case "lead":
      return Users;
    case "job":
      return Briefcase;
    case "invoice":
      return FileText;
    default:
      return DollarSign;
  }
}

function getSourceLabel(sourceType: string): string {
  switch (sourceType) {
    case "lead":
      return "Lead";
    case "job":
      return "Job";
    case "invoice":
      return "Invoice";
    default:
      return "Action";
  }
}

function getPriorityColor(priority: number): string {
  if (priority >= 90) return "bg-destructive/10 border-destructive/20";
  if (priority >= 75) return "bg-amber-500/10 border-amber-500/20";
  return "bg-muted/50 border-muted";
}

function getPriorityBadge(priority: number) {
  if (priority >= 90) return { label: "Urgent", variant: "destructive" as const };
  if (priority >= 75) return { label: "Important", variant: "default" as const };
  return { label: "Normal", variant: "secondary" as const };
}

export function MoneyPlanDesktopView({
  openItems,
  doneItems,
  isLoading,
  showCapabilityHint,
  onOpenUpgradeModal,
  onGenerate,
  onMarkDone,
  onDismiss,
  onSnooze,
  onAction,
  generatePending,
  markDonePending,
  dismissPending,
  snoozePending,
}: MoneyPlanDesktopViewProps) {
  const invoiceItems = openItems.filter(i => i.sourceType === "invoice");
  const leadItems = openItems.filter(i => i.sourceType === "lead");
  const jobItems = openItems.filter(i => i.sourceType === "job");

  const outstandingCount = invoiceItems.length;
  const unpaidJobCount = jobItems.length;
  const followUpCount = leadItems.length;

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-8 py-6" data-testid="money-plan-desktop-content">
      {showCapabilityHint && (
        <div
          className="relative cursor-pointer mb-6"
          role="button"
          tabIndex={0}
          onClick={onOpenUpgradeModal}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenUpgradeModal(); }}
          aria-label="Unlock Today's Money Plan"
          data-testid="card-money-plan-upgrade-hint"
        >
          <Card className="opacity-60 pointer-events-none select-none">
            <CardContent className="flex items-center gap-3 py-3 px-4">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Full Money Plan</p>
                <p className="text-xs text-muted-foreground">AI-prioritized daily actions to maximize your revenue</p>
              </div>
            </CardContent>
          </Card>
          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-muted/80 flex items-center justify-center z-10" aria-hidden="true">
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="col-span-8 space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="col-span-4">
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 grid grid-cols-3 gap-4" data-testid="revenue-snapshot-row">
            <Card className="rounded-xl border shadow-sm" data-testid="card-outstanding-revenue">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="text-outstanding-count">{outstandingCount}</p>
                  <p className="text-sm text-muted-foreground">Outstanding Revenue</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border shadow-sm" data-testid="card-unpaid-jobs">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="text-unpaid-count">{unpaidJobCount}</p>
                  <p className="text-sm text-muted-foreground">Unpaid Jobs</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border shadow-sm" data-testid="card-followups-needed">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="text-followup-count">{followUpCount}</p>
                  <p className="text-sm text-muted-foreground">Follow-Ups Needed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-8 space-y-4" data-testid="panel-actions-list">
          {openItems.length === 0 ? (
            <Card className="rounded-xl border shadow-sm" data-testid="panel-todays-opportunities">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold mb-2" data-testid="text-quiet-day">Quiet day</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Great time to follow up or send invoices.
                </p>
                <Button
                  variant="outline"
                  onClick={onGenerate}
                  disabled={generatePending}
                  aria-label="Check for new actions"
                  data-testid="button-check-actions"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${generatePending ? "animate-spin" : ""}`} />
                  Check for new actions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-xl border shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      Actions to Make Money Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {openItems.map((item, index) => {
                      const Icon = getSourceIcon(item.sourceType);
                      const priorityBadge = getPriorityBadge(item.priorityScore);
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-xl overflow-hidden ${getPriorityColor(item.priorityScore)}`}
                          data-testid={`action-card-${item.id}`}
                        >
                          <div
                            className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                            onClick={() => onAction(item)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                                {index + 1}
                              </span>
                              <div className="h-12 w-12 rounded-xl bg-background border flex items-center justify-center">
                                <Icon className="h-6 w-6" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold truncate" data-testid={`text-action-title-${item.id}`}>{item.title}</p>
                                  <p className="text-sm text-muted-foreground truncate" data-testid={`text-action-subtitle-${item.id}`}>{item.subtitle}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <Badge variant={priorityBadge.variant} data-testid={`badge-priority-${item.id}`}>
                                    {priorityBadge.label}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]" data-testid={`badge-source-${item.id}`}>
                                    {getSourceLabel(item.sourceType)}
                                  </Badge>
                                </div>
                              </div>
                              {item.explainText && (
                                <p className="text-sm text-muted-foreground mt-2" data-testid={`text-action-explain-${item.id}`}>
                                  {item.explainText}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/30">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => onSnooze({ id: item.id, hours: 4 })}
                              disabled={snoozePending}
                              aria-label={`Snooze ${item.title}`}
                              data-testid={`button-snooze-${item.id}`}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Later
                            </Button>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={() => onDismiss(item.id)}
                                disabled={dismissPending}
                                aria-label={`Skip ${item.title}`}
                                data-testid={`button-dismiss-${item.id}`}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Skip
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => onMarkDone(item.id)}
                                disabled={markDonePending}
                                aria-label={`Mark ${item.title} as done`}
                                data-testid={`button-done-${item.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Done
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
              </Card>

              {doneItems.length > 0 && (
                <Card className="rounded-xl border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Completed Today ({doneItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {doneItems.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60"
                        data-testid={`done-item-${item.id}`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-through truncate">{item.title}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {getSourceLabel(item.sourceType)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
          </div>

          <div className="col-span-4 space-y-4" data-testid="panel-sidebar">
            <BookingLinkShare variant="primary" context="plan" />
          </div>
        </div>
      )}
    </div>
  );
}
