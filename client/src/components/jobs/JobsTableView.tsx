import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  MapPin,
  MoreHorizontal,
  Play,
  CheckCircle2,
  Navigation,
  Edit,
  Trash2,
  DollarSign,
  Shield,
  CircleDollarSign,
  XCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Job } from "@shared/schema";

interface JobsTableViewProps {
  jobs: Job[];
  isLoading?: boolean;
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

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
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

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  scheduled: { color: "text-blue-600", bg: "bg-blue-500/10", label: "Scheduled" },
  in_progress: { color: "text-amber-600", bg: "bg-amber-500/10", label: "In Progress" },
  completed: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Completed" },
  cancelled: { color: "text-gray-500", bg: "bg-gray-500/10", label: "Cancelled" },
};

function JobTableRow({ job }: { job: Job }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const config = statusConfig[job.status] || statusConfig.scheduled;

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

  const completeJobMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/jobs/${job.id}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job completed!", description: "Don't forget to get paid." });
    },
    onError: () => {
      toast({ title: "Failed to complete job", variant: "destructive" });
    },
  });

  const handleNavigate = () => {
    if (job.location) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.location)}`;
      window.open(url, "_blank");
    }
  };

  return (
    <tr
      className="border-b last:border-b-0 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => navigate(`/jobs/${job.id}`)}
      data-testid={`table-row-job-${job.id}`}
    >
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{job.title}</span>
          {job.clientName && (
            <span className="text-sm text-muted-foreground">{job.clientName}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="text-sm text-muted-foreground capitalize">{job.serviceType}</span>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{formatDate(job.scheduledDate)}</span>
          <span className="text-xs text-muted-foreground">{formatTime(job.scheduledTime)}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        {job.location ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground max-w-[200px]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        ) : (
          <span className="text-muted-foreground/50 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        {job.price ? (
          <span className="font-semibold text-emerald-600">{formatCurrency(job.price)}</span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={`text-xs ${config.bg} ${config.color} border-0`}>
            {config.label}
          </Badge>
          {hasDepositRequest(job) && job.status !== "completed" && job.status !== "cancelled" && (
            <Badge variant="secondary" className="text-xs bg-teal-500/10 text-teal-600 border-0">
              <Shield className="h-3 w-3 mr-1" />
              Deposit
            </Badge>
          )}
          {job.status === "completed" && (
            <Badge
              variant="secondary"
              className={`text-xs border-0 ${
                job.paymentStatus === "paid"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}
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
      </td>
      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 justify-end">
          {job.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => startJobMutation.mutate()}
              disabled={startJobMutation.isPending}
              className="h-8"
            >
              {startJobMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </>
              )}
            </Button>
          )}
          {job.status === "in_progress" && (
            <Button
              size="sm"
              onClick={() => completeJobMutation.mutate()}
              disabled={completeJobMutation.isPending}
              className="h-8"
            >
              {completeJobMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </>
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/jobs/${job.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {job.location && (
                <DropdownMenuItem onClick={handleNavigate}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

export function JobsTableView({ jobs, isLoading }: JobsTableViewProps) {
  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <div className="animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
              <div className="h-4 bg-muted rounded flex-1" />
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Job
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Service
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Date
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Location
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Price
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobTableRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
