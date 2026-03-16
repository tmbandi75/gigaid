import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Briefcase,
  MessageSquare,
  DollarSign,
  Copy,
  Share2,
  ExternalLink,
  Plus,
  UserPlus,
  FileText,
  Zap,
  Mic,
  ChevronRight,
  Clock,
  MapPin,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Calendar,
  Users,
} from "lucide-react";
import type { Job, Lead } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface GamePlanStats {
  jobsToday: number;
  moneyCollectedToday: number;
  moneyWaiting: number;
  messagesToSend: number;
}

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

interface RecentlyCompleted {
  id: string;
  type: string;
  title: string;
  completedAt: string;
}

interface DashboardDesktopViewProps {
  gamePlanStats: GamePlanStats | null;
  upNextItems: ActionItem[];
  recentlyCompleted: RecentlyCompleted[];
  bookingSlug: string | undefined;
  pendingRevenue: number;
  pendingInvoiceCount: number;
  upcomingJobs: Job[];
  recentLeads: Lead[];
  navigate: (path: string) => void;
  isLoading: boolean;
  aiNudges: ActionItem[];
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case "critical": return "text-red-600 bg-red-500/10";
    case "high": return "text-amber-600 bg-amber-500/10";
    default: return "text-blue-600 bg-blue-500/10";
  }
}

function getActionIcon(type: string) {
  switch (type) {
    case "invoice": return FileText;
    case "job": return Briefcase;
    case "lead": return Users;
    case "reminder": return MessageSquare;
    default: return Briefcase;
  }
}

function getRecentIcon(type: string) {
  switch (type) {
    case "invoice_paid": return DollarSign;
    case "job_completed": return CheckCircle2;
    default: return CheckCircle2;
  }
}

function getRecentColor(type: string) {
  switch (type) {
    case "invoice_paid": return "text-emerald-600 bg-emerald-500/10";
    case "job_completed": return "text-blue-600 bg-blue-500/10";
    default: return "text-slate-600 bg-slate-500/10";
  }
}

export function DashboardDesktopView({
  gamePlanStats,
  upNextItems,
  recentlyCompleted,
  bookingSlug,
  pendingRevenue,
  pendingInvoiceCount,
  upcomingJobs,
  recentLeads,
  navigate,
  isLoading,
  aiNudges,
}: DashboardDesktopViewProps) {
  const { toast } = useToast();
  const stats = gamePlanStats;
  const bookingUrl = bookingSlug
    ? `${window.location.origin}/book/${bookingSlug}`
    : null;

  const handleCopyLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({ title: "Copied!", description: "Booking link copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!bookingUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Book with me", url: bookingUrl });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const quickActions = [
    { icon: Plus, label: "New Job", description: "Schedule work", href: "/jobs/new", gradient: "from-violet-500 to-purple-600" },
    { icon: FileText, label: "Invoice", description: "Send & get paid", href: "/invoices/new", gradient: "from-blue-500 to-cyan-500" },
    { icon: MessageSquare, label: "Message", description: "Reach a client", href: "/notify", gradient: "from-emerald-500 to-teal-500" },
    { icon: Mic, label: "Voice Note", description: "Quick capture", href: "/share-capture", gradient: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-desktop-view">
      <div className="grid grid-cols-6 lg:grid-cols-12 gap-6">
        <Card
          className="col-span-2 lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer"
          onClick={() => navigate("/jobs")}
          data-testid="card-overview-jobs-today"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-violet-600" />
              </div>
              <span className="text-sm text-muted-foreground">Jobs Today</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-jobs-today-count">
              {isLoading ? "..." : (stats?.jobsToday ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card
          className="col-span-2 lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer"
          onClick={() => navigate("/reminders")}
          data-testid="card-overview-messages"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm text-muted-foreground">Messages To Send</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-messages-count">
              {isLoading ? "..." : (stats?.messagesToSend ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card
          className="col-span-2 lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer"
          onClick={() => navigate("/invoices")}
          data-testid="card-overview-payments"
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm text-muted-foreground">Payments Waiting</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-payments-waiting">
              {isLoading ? "..." : formatCurrency(stats?.moneyWaiting ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-6 lg:grid-cols-12 gap-6">
        {bookingUrl && (
          <Card className="col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-booking-link">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Your Booking Link
              </h3>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 mb-4">
                <span className="text-sm font-medium truncate flex-1" data-testid="text-booking-url">
                  {bookingUrl}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  aria-label="Copy booking link"
                  data-testid="button-copy-booking-link"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  aria-label="Share booking link"
                  data-testid="button-share-booking-link"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Link href={`/book/${bookingSlug}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Preview booking page"
                    data-testid="button-preview-booking"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          className={`${bookingUrl ? "col-span-6" : "col-span-6 lg:col-span-12"} rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition`}
          data-testid="card-payments-panel"
        >
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              Payments Waiting
            </h3>
            <p className="text-3xl font-bold mb-1" data-testid="text-payments-panel-amount">
              {formatCurrency(pendingRevenue)} <span className="text-base font-normal text-muted-foreground">waiting to be collected</span>
            </p>
            {pendingInvoiceCount > 0 && (
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-overdue-invoices">
                {pendingInvoiceCount} invoice{pendingInvoiceCount !== 1 ? "s" : ""} outstanding
              </p>
            )}
            <Button
              onClick={() => navigate("/invoices")}
              aria-label="Collect payment"
              data-testid="button-collect-payment"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Collect Payment
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} data-testid={`link-desktop-quick-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <Card
                className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition cursor-pointer"
                data-testid={`card-quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 lg:grid-cols-12 gap-6">
        <div className="col-span-6 lg:col-span-7 space-y-6">
          {aiNudges.length > 0 && (
            <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-smart-suggestions">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Smart Suggestions
                  </h3>
                </div>
                <div className="space-y-3">
                  {aiNudges.slice(0, 3).map((nudge) => {
                    const Icon = getActionIcon(nudge.type);
                    return (
                      <div
                        key={nudge.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(nudge.actionRoute)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(nudge.actionRoute); } }}
                        data-testid={`suggestion-${nudge.id}`}
                      >
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getUrgencyColor(nudge.urgency)}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{nudge.title}</p>
                          <p className="text-xs text-muted-foreground">{nudge.subtitle}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 h-8"
                          onClick={(e) => { e.stopPropagation(); navigate(nudge.actionRoute); }}
                          aria-label={nudge.actionLabel}
                          data-testid={`button-suggestion-${nudge.id}`}
                        >
                          {nudge.actionLabel}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {upcomingJobs.length > 0 && (
            <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-upcoming-jobs-desktop">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Upcoming Jobs
                  </h3>
                  <Link href="/jobs">
                    <Button variant="ghost" size="sm" className="text-primary h-8 px-2" data-testid="link-view-all-jobs-desktop">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2">
                  {upcomingJobs.slice(0, 4).map((job: Job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/jobs/${job.id}`); } }}
                      data-testid={`desktop-job-${job.id}`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${job.status === "in_progress" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                        <Briefcase className={`h-4 w-4 ${job.status === "in_progress" ? "text-amber-500" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          {job.status === "in_progress" && (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5">Active</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentLeads.length > 0 && (
            <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-recent-leads-desktop">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Leads
                  </h3>
                  <Link href="/leads">
                    <Button variant="ghost" size="sm" className="text-primary h-8 px-2" data-testid="link-view-all-leads-desktop">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2">
                  {recentLeads.slice(0, 4).map((lead: Lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/leads/${lead.id}`); } }}
                      data-testid={`desktop-lead-${lead.id}`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${lead.status === "new" ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                        <Users className={`h-4 w-4 ${lead.status === "new" ? "text-emerald-500" : "text-blue-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{lead.clientName}</p>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 ${lead.status === "new" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                            {lead.status === "new" ? "New" : "Contacted"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{lead.serviceType}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="col-span-6 lg:col-span-5 space-y-6">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-up-next">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Up Next
              </h3>
              {upNextItems.length === 0 ? (
                <div className="text-center py-6">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No pending tasks right now</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {upNextItems.map((item) => {
                    const Icon = getActionIcon(item.type);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-sm transition cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(item.actionRoute)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(item.actionRoute); } }}
                        data-testid={`upnext-${item.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${getUrgencyColor(item.urgency)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                            {item.amount && item.amount > 0 && (
                              <p className="text-xs font-semibold mt-1">{formatCurrency(item.amount)}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 ml-12">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); navigate(item.actionRoute); }}
                            aria-label={item.actionLabel}
                            data-testid={`button-upnext-${item.id}`}
                          >
                            {item.actionLabel}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition" data-testid="card-recent-activity">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Recent Activity
              </h3>
              {recentlyCompleted.length === 0 ? (
                <div className="text-center py-6">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentlyCompleted.map((item, idx) => {
                    const Icon = getRecentIcon(item.type);
                    const colorClass = getRecentColor(item.type);
                    return (
                      <div key={`${item.id}-${idx}`} className="flex items-center gap-3" data-testid={`activity-${item.id}`}>
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTimeAgo(item.completedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
