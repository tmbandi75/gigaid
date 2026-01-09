import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, MapPin, Clock, Briefcase } from "lucide-react";
import { Link } from "wouter";
import type { Job } from "@shared/schema";

interface UpcomingJobsProps {
  jobs: Job[];
  isLoading?: boolean;
}

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

const serviceIcons: Record<string, string> = {
  plumbing: "wrench",
  electrical: "zap",
  cleaning: "sparkles",
  general: "hammer",
};

export function UpcomingJobs({ jobs, isLoading }: UpcomingJobsProps) {
  if (isLoading) {
    return (
      <Card data-testid="card-upcoming-loading">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card data-testid="card-upcoming-empty">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Upcoming Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-6 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">No upcoming jobs scheduled</p>
            <Link href="/jobs/new">
              <Button data-testid="button-add-first-job">Add Your First Job</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-upcoming-jobs">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg font-medium">Upcoming Jobs</CardTitle>
        <Link href="/jobs">
          <Button variant="ghost" size="sm" className="text-primary" data-testid="link-view-all-jobs">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.slice(0, 3).map((job) => (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <div 
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover-elevate active-elevate-2 cursor-pointer"
              data-testid={`job-card-${job.id}`}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{job.title}</p>
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
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
