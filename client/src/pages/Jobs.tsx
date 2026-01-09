import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, MapPin, Clock, Briefcase, ChevronRight, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import type { Job } from "@shared/schema";

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

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  in_progress: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  completed: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`job-card-${job.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">{job.title}</h3>
                <Badge 
                  variant="outline" 
                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${statusColors[job.status]}`}
                >
                  {statusLabels[job.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2 capitalize">{job.serviceType}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}
                </span>
                {job.price && (
                  <span className="flex items-center gap-1 text-chart-3">
                    <DollarSign className="h-3 w-3" />
                    {(job.price / 100).toFixed(0)}
                  </span>
                )}
              </div>
              {job.location && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{job.location}</span>
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12 text-center px-4">
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <Briefcase className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No Jobs Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Start adding your jobs to keep track of your schedule and earnings
      </p>
      <Link href="/jobs/new">
        <Button data-testid="button-add-first-job">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Job
        </Button>
      </Link>
    </div>
  );
}

export default function Jobs() {
  const [filter, setFilter] = useState<string>("all");
  
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filteredJobs = filter === "all" 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  const upcomingJobs = filteredJobs.filter(j => j.status === "scheduled" || j.status === "in_progress");
  const pastJobs = filteredJobs.filter(j => j.status === "completed" || j.status === "cancelled");

  return (
    <div className="flex flex-col min-h-full" data-testid="page-jobs">
      <TopBar title="Jobs" />
      
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-10">
              <TabsTrigger value="all" className="text-xs" data-testid="filter-all">All</TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs" data-testid="filter-scheduled">Scheduled</TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs" data-testid="filter-in-progress">Active</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs" data-testid="filter-completed">Done</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <Link href="/jobs/new">
          <Button className="w-full mb-6 h-12" data-testid="button-add-job">
            <Plus className="h-5 w-5 mr-2" />
            Add New Job
          </Button>
        </Link>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
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
        ) : filteredJobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {upcomingJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {upcomingJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
            
            {pastJobs.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Past Jobs
                </h2>
                <div className="space-y-3">
                  {pastJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
