import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  MapPin, 
  Clock, 
  Briefcase, 
  ChevronRight, 
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Filter,
  CircleDollarSign,
  XCircle,
  Shield,
  Play,
  Navigation,
  Loader2,
  LayoutGrid,
  List,
  Search,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import type { Job, AiNudge, Invoice } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { useApiMutation } from "@/hooks/useApiMutation";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { NudgeActionSheet } from "@/components/nudges/NudgeActionSheet";
import { JobsTableView } from "@/components/jobs/JobsTableView";
import { PriorityBadge, inferJobPriority } from "@/components/priority/PriorityBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { CoachingRenderer } from "@/coaching/CoachingRenderer";
import { ActivationChecklist } from "@/components/activation/ActivationChecklist";
import { FreeSetupCta } from "@/components/growth/FreeSetupCta";
import { JobResolutionModal } from "@/components/jobs/JobResolutionModal";
import { JobsCalendar } from "@/components/calendar/JobsCalendar";
import { BookingLinkShare } from "@/components/booking-link";
import { JobQuotaMeter } from "@/components/upgrade/JobQuotaMeter";
import { HelpLink } from "@/components/HelpLink";
import { SwipeableCard, type SwipeAction as SwipeCardAction } from "@/components/ui/swipeable-card";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { getJobActionEligibility, getSwipeActions, type SwipeAction as RulesSwipeAction } from "@shared/archive-delete-rules";

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function hasDepositRequest(job: Job): boolean {
  if (!job.notes) return false;
  try {
    const match = job.notes.match(/\[DEPOSIT_META:([^\]]+)\]/);
    if (match) {
      const meta = JSON.parse(match[1]);
      return meta.depositRequestedCents > 0;
    }
  } catch {}
  return false;
}

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  scheduled: { color: "text-blue-600", bg: "bg-blue-500/10", icon: Calendar },
  in_progress: { color: "text-amber-600", bg: "bg-amber-500/10", icon: AlertCircle },
  completed: { color: "text-emerald-600", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  cancelled: { color: "text-gray-500", bg: "bg-gray-500/10", icon: AlertCircle },
};

const statusLabels: Record<string, string> = {
  scheduled: "Coming Up",
  in_progress: "Working On",
  completed: "Done",
  cancelled: "Cancelled",
};

const filters = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Coming Up" },
  { value: "in_progress", label: "Working On" },
  { value: "completed", label: "Done" },
];

interface JobCardProps {
  job: Job;
  nudges: AiNudge[];
  invoices: Invoice[];
  onNudgeClick?: (nudge: AiNudge) => void;
}

function JobCard({ job, nudges, invoices, onNudgeClick }: JobCardProps) {
  const config = statusConfig[job.status] || statusConfig.scheduled;
  const StatusIcon = config.icon;
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<RulesSwipeAction | null>(null);
  const isMobile = useIsMobile();
  
  const jobNudges = nudges.filter(n => n.entityType === "job" && n.entityId === job.id);
  const priority = inferJobPriority({ status: job.status, date: job.scheduledDate, time: job.scheduledTime });
  
  const hasInvoice = invoices.some(inv => inv.jobId === job.id);
  const eligibility = getJobActionEligibility(job, hasInvoice);
  const swipeActions = getSwipeActions("job", eligibility);

  const startJobMutation = useApiMutation(
    () => apiFetch(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "in_progress" }) }),
    [QUERY_KEYS.jobs(), QUERY_KEYS.job(job.id), QUERY_KEYS.dashboardGamePlan(), QUERY_KEYS.nextActions()],
    {
      onSuccess: () => {
        toast({ title: "Job started!", description: "Good luck!" });
      },
      onError: () => {
        toast({ title: "Failed to start job", variant: "destructive" });
      },
    }
  );

  const cancelJobMutation = useApiMutation(
    () => apiFetch(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    [QUERY_KEYS.jobs(), QUERY_KEYS.job(job.id), QUERY_KEYS.dashboardGamePlan(), QUERY_KEYS.nextActions()],
    {
      onSuccess: () => {
        toast({ title: "Job cancelled" });
        setConfirmAction(null);
      },
      onError: () => {
        toast({ title: "Failed to cancel job", variant: "destructive" });
        setConfirmAction(null);
      },
    }
  );

  const archiveJobMutation = useApiMutation(
    () => apiFetch(`/api/jobs/${job.id}/archive`, { method: "POST" }),
    [QUERY_KEYS.jobs(), QUERY_KEYS.dashboardGamePlan()],
    {
      onSuccess: () => {
        toast({ title: "Job archived" });
        setConfirmAction(null);
      },
      onError: () => {
        toast({ title: "Failed to archive job", variant: "destructive" });
        setConfirmAction(null);
      },
    }
  );

  const deleteJobMutation = useApiMutation(
    () => apiFetch(`/api/jobs/${job.id}`, { method: "DELETE" }),
    [QUERY_KEYS.jobs(), QUERY_KEYS.dashboardGamePlan()],
    {
      onSuccess: () => {
        toast({ title: "Job deleted" });
        setConfirmAction(null);
      },
      onError: (error: any) => {
        toast({ 
          title: "Cannot delete job", 
          description: error?.message || "Try archiving instead.",
          variant: "destructive" 
        });
        setConfirmAction(null);
      },
    }
  );

  const handleSwipeAction = (action: RulesSwipeAction) => {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
    } else {
      executeAction(action.id);
    }
  };

  const executeAction = (actionId: string) => {
    if (actionId === "cancel") {
      cancelJobMutation.mutate();
    } else if (actionId === "archive") {
      archiveJobMutation.mutate();
    } else if (actionId === "delete") {
      deleteJobMutation.mutate();
    }
  };

  const swipeCardActions: SwipeCardAction[] = swipeActions.map(action => ({
    id: action.id,
    label: action.label,
    icon: action.icon as "Archive" | "Trash2" | "X",
    variant: action.variant,
    onClick: () => handleSwipeAction(action),
  }));

  const isPending = cancelJobMutation.isPending || archiveJobMutation.isPending || deleteJobMutation.isPending;

  const handleNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (job.location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`;
      window.open(url, "_blank");
    }
  };

  const handleStartJob = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startJobMutation.mutate();
  };

  const handleCompleteJob = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowResolutionModal(true);
  };
  
  const handleResolved = () => {
    setShowResolutionModal(false);
  };
  
  const handleOpenInvoiceCreate = () => {
    setShowResolutionModal(false);
    navigate(`/invoices/new?jobId=${job.id}`);
  };
  
  const cardContent = (
    <Card className="border-0 shadow-sm hover-elevate cursor-pointer overflow-hidden" data-testid={`job-card-${job.id}`}>
      <CardContent className="p-0">
        <div className="flex">
          <div className={`w-1 ${job.status === "in_progress" ? "bg-amber-500" : job.status === "completed" ? "bg-emerald-500" : "bg-primary"}`} />
          <div className="flex-1 p-3">
            <div className="flex items-start gap-3">
              <div className={`h-12 w-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <Briefcase className={`h-5 w-5 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
                    {priority && <PriorityBadge priority={priority} compact />}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] px-2 py-0.5 flex-shrink-0 ${config.bg} ${config.color} border-0`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusLabels[job.status]}
                  </Badge>
                </div>
                {job.clientName && (
                  <p className="text-sm text-muted-foreground mb-1">{job.clientName}</p>
                )}
                <p className="text-xs text-muted-foreground/70 mb-2 capitalize">{job.serviceType}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}
                  </span>
                  {job.price && (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <DollarSign className="h-3 w-3" />
                      {(job.price / 100).toFixed(0)}
                    </span>
                  )}
                  {hasDepositRequest(job) && job.status !== "completed" && job.status !== "cancelled" && (
                    <Badge 
                      variant="secondary" 
                      className="text-[10px] px-2 py-0.5 border-0 bg-teal-500/10 text-teal-600"
                      data-testid={`badge-deposit-${job.id}`}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Deposit
                    </Badge>
                  )}
                  {job.status === "completed" && (
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] px-2 py-0.5 border-0 ${
                        job.paymentStatus === "paid" 
                          ? "bg-emerald-500/10 text-emerald-600" 
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                      data-testid={`badge-payment-${job.id}`}
                    >
                      {job.paymentStatus === "paid" ? (
                        <>
                          <CircleDollarSign className="h-3 w-3 mr-1" />
                          Paid
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Unpaid
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                {job.location && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{job.location}</span>
                  </div>
                )}

                {jobNudges.length > 0 && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <NudgeChips nudges={jobNudges} onNudgeClick={onNudgeClick} />
                  </div>
                )}
                
                {(job.status === "scheduled" || job.status === "in_progress") && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {job.status === "scheduled" && (
                      <Button
                        size="sm"
                        onClick={handleStartJob}
                        disabled={startJobMutation.isPending}
                        data-testid={`button-start-job-${job.id}`}
                      >
                        {startJobMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3 mr-1" />
                        )}
                        Start
                      </Button>
                    )}
                    {job.status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={handleCompleteJob}
                        data-testid={`button-complete-job-${job.id}`}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Button>
                    )}
                    {job.location && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleNavigate}
                        data-testid={`button-navigate-${job.id}`}
                      >
                        <Navigation className="h-3 w-3 mr-1" />
                        Navigate
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0 mt-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <>
    {isMobile && swipeCardActions.length > 0 ? (
      <SwipeableCard 
        actions={swipeCardActions} 
        disabled={isPending}
        data-testid={`swipeable-job-${job.id}`}
      >
        <Link href={`/jobs/${job.id}`} data-testid={`link-job-${job.id}`}>
          {cardContent}
        </Link>
      </SwipeableCard>
    ) : (
      <Link href={`/jobs/${job.id}`} data-testid={`link-job-${job.id}`}>
        {cardContent}
      </Link>
    )}
    
    <JobResolutionModal
      open={showResolutionModal}
      job={job}
      onResolved={handleResolved}
      onOpenInvoiceCreate={handleOpenInvoiceCreate}
    />
    
    <ActionConfirmDialog
      open={confirmAction !== null}
      onOpenChange={(open) => !open && setConfirmAction(null)}
      title={confirmAction?.confirmTitle || "Confirm Action"}
      description={confirmAction?.confirmDescription || "Are you sure?"}
      confirmLabel={confirmAction?.label || "Confirm"}
      variant={confirmAction?.variant === "destructive" ? "destructive" : "default"}
      isPending={isPending}
      onConfirm={() => confirmAction && executeAction(confirmAction.id)}
    />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="w-full max-w-md mb-6">
        <ActivationChecklist />
      </div>
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-6">
        <Briefcase className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Jobs Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Start adding your jobs to keep track of your schedule and earnings
      </p>
      <CoachingRenderer screen="jobs" placement="empty_state" />
      <Link href="/jobs/new">
        <Button className="bg-gradient-to-r from-primary to-violet-600" data-testid="button-add-first-job">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Job
        </Button>
      </Link>
      <FreeSetupCta />
    </div>
  );
}

export default function Jobs() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table" | "calendar">("table");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: QUERY_KEYS.jobs(),
  });

  const { data: nudges = [] } = useQuery<AiNudge[]>({
    queryKey: QUERY_KEYS.nudges(),
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: QUERY_KEYS.invoices(),
  });

  const { data: profile } = useQuery<{ services: string[] | null }>({
    queryKey: QUERY_KEYS.profile(),
  });

  const handleNudgeClick = (nudge: AiNudge) => {
    setSelectedNudge(nudge);
  };

  const statusFilteredJobs = filter === "all" 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  const filteredJobs = searchQuery.trim()
    ? statusFilteredJobs.filter(job => {
        const q = searchQuery.toLowerCase();
        return (
          (job.title && job.title.toLowerCase().includes(q)) ||
          (job.clientName && job.clientName.toLowerCase().includes(q)) ||
          (job.serviceType && job.serviceType.toLowerCase().includes(q)) ||
          (job.location && job.location.toLowerCase().includes(q))
        );
      })
    : statusFilteredJobs;

  const upcomingJobs = filteredJobs.filter(j => j.status === "scheduled" || j.status === "in_progress");
  const pastJobs = filteredJobs.filter(j => j.status === "completed" || j.status === "cancelled");

  const totalEarnings = jobs.filter(j => j.status === "completed").reduce((sum, j) => sum + (j.price || 0), 0);
  const activeCount = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").length;
  const completedCount = jobs.filter(j => j.status === "completed").length;

  const showTableView = !isMobile && viewMode === "table";
  const showCalendarView = viewMode === "calendar";

  const renderMobileLayout = () => (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-jobs">
      <div 
        className="relative overflow-hidden text-white px-4 pt-6 pb-8"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(180deg, #0F2A4A 0%, #132E52 100%)'
            : 'linear-gradient(180deg, #1F6FD6 0%, #2A5FCC 45%, #3A4F9F 100%)',
          boxShadow: 'inset 0 -16px 24px rgba(0, 0, 0, 0.08)'
        }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-2xl font-bold">Jobs</h1>
                <HelpLink slug="jobs" label="Help with Jobs" className="text-white/80 hover:text-white hover:bg-white/10" />
              </div>
              <p className="text-sm text-primary-foreground/80">Manage your work schedule</p>
              <CoachingRenderer screen="jobs" />
            </div>
            <Link href="/jobs/new">
              <Button size="icon" className="bg-white/20 hover:bg-white/30 text-white" aria-label="Add new job" data-testid="button-add-job-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Active</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-active-count">{activeCount}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Earned</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-earned">{formatCurrency(totalEarnings)}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 py-6 -mt-4">
        <div className="flex flex-col gap-4 mb-6">
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-1">
              <div className="flex gap-1">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      filter === f.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    data-testid={`filter-${f.value}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="flex-1 h-9"
              data-testid="view-mode-calendar"
            >
              <Calendar className="h-4 w-4 mr-1" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="flex-1 h-9"
              data-testid="view-mode-cards"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Cards
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/jobs/new" className="flex-1">
              <Button className="w-full h-12 bg-gradient-to-r from-primary to-violet-600 shadow-lg" data-testid="button-add-job">
                <Plus className="h-5 w-5 mr-2" />
                Add New Job
              </Button>
            </Link>
            <BookingLinkShare variant="compact" context="jobs" />
          </div>

          <JobQuotaMeter />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : showCalendarView ? (
          <JobsCalendar jobs={filteredJobs} />
        ) : filteredJobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} nudges={nudges} invoices={invoices} onNudgeClick={handleNudgeClick} />
            ))}
          </div>
        )}
        
        <div className="h-6" />
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-jobs">
      <div className="border-b bg-background sticky top-0 z-[999]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Jobs</h1>
                  <HelpLink slug="jobs" label="Help with Jobs" />
                </div>
                <p className="text-sm text-muted-foreground">Manage your work schedule</p>
                <CoachingRenderer screen="jobs" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-8 pr-6 border-r">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-active-count">{activeCount}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-earned">{formatCurrency(totalEarnings)}</p>
                  <p className="text-xs text-muted-foreground">Earned</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-completed-count">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-jobs">{jobs.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>

              <Link href="/jobs/new">
                <Button className="bg-gradient-to-r from-primary to-violet-600 shadow-md" data-testid="button-add-job-header-desktop">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Job
                </Button>
              </Link>
            </div>
          </div>
          <JobQuotaMeter className="mt-4" />
        </div>
      </div>
      
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(f.value)}
                className="h-9"
                data-testid={`filter-${f.value}`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-9"
                data-testid="input-job-search"
                aria-label="Search jobs"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  data-testid="button-clear-job-search"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="h-9"
                data-testid="view-mode-calendar"
              >
                <Calendar className="h-4 w-4 mr-1" />
                Calendar
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className="h-9"
                data-testid="view-mode-cards"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Cards
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-9"
                data-testid="view-mode-table"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          showTableView ? (
            <JobsTableView jobs={[]} isLoading={true} />
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 bg-muted animate-pulse rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : showCalendarView ? (
          <JobsCalendar jobs={filteredJobs} />
        ) : filteredJobs.length === 0 ? (
          <EmptyState />
        ) : showTableView ? (
          <div className="space-y-8">
            {upcomingJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({upcomingJobs.length})
                </h2>
                <JobsTableView jobs={upcomingJobs} />
              </div>
            )}
            {pastJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Past Jobs ({pastJobs.length})
                </h2>
                <JobsTableView jobs={pastJobs} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {upcomingJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({upcomingJobs.length})
                </h2>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {upcomingJobs.map((job) => (
                    <JobCard key={job.id} job={job} nudges={nudges} invoices={invoices} onNudgeClick={handleNudgeClick} />
                  ))}
                </div>
              </div>
            )}
            
            {pastJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Past Jobs ({pastJobs.length})
                </h2>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {pastJobs.map((job) => (
                    <JobCard key={job.id} job={job} nudges={nudges} invoices={invoices} onNudgeClick={handleNudgeClick} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={!!selectedNudge}
        onClose={() => setSelectedNudge(null)}
      />
    </div>
  );

  return (
    <>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
      {isMobile && (
        <NudgeActionSheet
          nudge={selectedNudge}
          open={!!selectedNudge}
          onClose={() => setSelectedNudge(null)}
        />
      )}
    </>
  );
}
