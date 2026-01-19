import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  List
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import type { Job, AiNudge } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NudgeChips } from "@/components/nudges/NudgeChip";
import { NudgeActionSheet } from "@/components/nudges/NudgeActionSheet";
import { JobsTableView } from "@/components/jobs/JobsTableView";
import { useIsMobile } from "@/hooks/use-mobile";
import { JobResolutionModal } from "@/components/jobs/JobResolutionModal";

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
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const filters = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Upcoming" },
  { value: "in_progress", label: "Active" },
  { value: "completed", label: "Done" },
];

function JobCard({ job, nudges, onNudgeClick }: { job: Job; nudges: AiNudge[]; onNudgeClick?: (nudge: AiNudge) => void }) {
  const config = statusConfig[job.status] || statusConfig.scheduled;
  const StatusIcon = config.icon;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  
  const jobNudges = nudges.filter(n => n.entityType === "job" && n.entityId === job.id);

  const startJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/jobs/${job.id}`, { status: "in_progress" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job started!", description: "Good luck!" });
    },
    onError: () => {
      toast({ title: "Failed to start job", variant: "destructive" });
    },
  });

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
  
  return (
    <>
    <Link href={`/jobs/${job.id}`} data-testid={`link-job-${job.id}`}>
      <Card className="border-0 shadow-sm hover-elevate cursor-pointer overflow-hidden" data-testid={`job-card-${job.id}`}>
        <CardContent className="p-0">
          <div className="flex">
            <div className={`w-1 ${job.status === "in_progress" ? "bg-amber-500" : job.status === "completed" ? "bg-emerald-500" : "bg-primary"}`} />
            <div className="flex-1 p-4">
              <div className="flex items-start gap-3">
                <div className={`h-12 w-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <Briefcase className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{job.title}</h3>
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
    </Link>
    
    <JobResolutionModal
      open={showResolutionModal}
      job={job}
      onResolved={handleResolved}
      onOpenInvoiceCreate={handleOpenInvoiceCreate}
    />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-6">
        <Briefcase className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No Jobs Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Start adding your jobs to keep track of your schedule and earnings
      </p>
      <Link href="/jobs/new">
        <Button className="bg-gradient-to-r from-primary to-violet-600" data-testid="button-add-first-job">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Job
        </Button>
      </Link>
    </div>
  );
}

export default function Jobs() {
  const [filter, setFilter] = useState<string>("all");
  const [selectedNudge, setSelectedNudge] = useState<AiNudge | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const isMobile = useIsMobile();
  
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: nudges = [] } = useQuery<AiNudge[]>({
    queryKey: ["/api/ai/nudges"],
  });

  const handleNudgeClick = (nudge: AiNudge) => {
    setSelectedNudge(nudge);
  };

  const filteredJobs = filter === "all" 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  const upcomingJobs = filteredJobs.filter(j => j.status === "scheduled" || j.status === "in_progress");
  const pastJobs = filteredJobs.filter(j => j.status === "completed" || j.status === "cancelled");

  const totalEarnings = jobs.filter(j => j.status === "completed").reduce((sum, j) => sum + (j.price || 0), 0);
  const activeCount = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").length;

  const showTableView = !isMobile && viewMode === "table";

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-jobs">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 md:px-6 lg:px-8 pt-6 pb-8 md:pb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Jobs</h1>
              <p className="text-sm text-primary-foreground/80">Manage your work schedule</p>
            </div>
            <Link href="/jobs/new">
              <Button className="bg-white/20 hover:bg-white/30 text-white hidden md:flex" data-testid="button-add-job-header-desktop">
                <Plus className="h-5 w-5 mr-2" />
                Add Job
              </Button>
              <Button size="icon" className="bg-white/20 hover:bg-white/30 text-white md:hidden" data-testid="button-add-job-header">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Active</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold" data-testid="text-active-count">{activeCount}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Earned</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold" data-testid="text-total-earned">{formatCurrency(totalEarnings)}</p>
            </div>
            <div className="hidden md:block bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Completed</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold" data-testid="text-completed-count">{jobs.filter(j => j.status === "completed").length}</p>
            </div>
            <div className="hidden md:block bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Total</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold" data-testid="text-total-jobs">{jobs.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 -mt-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Card className="border-0 shadow-md overflow-hidden flex-1">
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

          {!isMobile && (
            <div className="hidden md:flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-9"
                data-testid="view-mode-table"
              >
                <List className="h-4 w-4 mr-2" />
                Table
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className="h-9"
                data-testid="view-mode-cards"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Cards
              </Button>
            </div>
          )}

          <Link href="/jobs/new" className="md:hidden">
            <Button className="w-full h-12 bg-gradient-to-r from-primary to-violet-600 shadow-lg" data-testid="button-add-job">
              <Plus className="h-5 w-5 mr-2" />
              Add New Job
            </Button>
          </Link>
        </div>

        {isLoading ? (
          showTableView ? (
            <JobsTableView jobs={[]} isLoading={true} />
          ) : (
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
          )
        ) : filteredJobs.length === 0 ? (
          <EmptyState />
        ) : showTableView ? (
          <div className="space-y-6">
            {upcomingJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({upcomingJobs.length})
                </h2>
                <JobsTableView jobs={upcomingJobs} />
              </div>
            )}
            {pastJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Past Jobs ({pastJobs.length})
                </h2>
                <JobsTableView jobs={pastJobs} />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {upcomingJobs.length > 0 && (
              <div className={pastJobs.length === 0 ? "lg:col-span-2" : ""}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({upcomingJobs.length})
                </h2>
                <div className="space-y-3">
                  {upcomingJobs.map((job) => (
                    <JobCard key={job.id} job={job} nudges={nudges} onNudgeClick={handleNudgeClick} />
                  ))}
                </div>
              </div>
            )}
            
            {pastJobs.length > 0 && (
              <div className={upcomingJobs.length === 0 ? "lg:col-span-2" : ""}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Past Jobs ({pastJobs.length})
                </h2>
                <div className="space-y-3">
                  {pastJobs.map((job) => (
                    <JobCard key={job.id} job={job} nudges={nudges} onNudgeClick={handleNudgeClick} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="h-6" />
      </div>

      <NudgeActionSheet
        nudge={selectedNudge}
        open={!!selectedNudge}
        onClose={() => setSelectedNudge(null)}
      />
    </div>
  );
}
