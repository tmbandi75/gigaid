import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Users, Clock } from "lucide-react";
import { useState } from "react";

interface SummaryCardProps {
  totalJobs: number;
  completedJobs: number;
  totalLeads: number;
  newLeads: number;
  isLoading?: boolean;
}

export function SummaryCard({ 
  totalJobs, 
  completedJobs, 
  totalLeads, 
  newLeads,
  isLoading 
}: SummaryCardProps) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const pendingJobs = totalJobs - completedJobs;

  if (isLoading) {
    return (
      <Card data-testid="card-summary-loading">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full mb-2" />
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-summary">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg font-medium">Summary</CardTitle>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
          <TabsList className="h-8">
            <TabsTrigger value="week" className="text-xs px-3" data-testid="tab-week">
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="text-xs px-3" data-testid="tab-month">
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-foreground" data-testid="text-total-jobs">
              {totalJobs}
            </span>
            <span className="text-xs text-muted-foreground">Jobs</span>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-chart-3/10 flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-chart-3" />
            </div>
            <span className="text-2xl font-semibold text-foreground" data-testid="text-new-leads">
              {newLeads}
            </span>
            <span className="text-xs text-muted-foreground">New Leads</span>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-chart-4/10 flex items-center justify-center mb-2">
              <Clock className="h-5 w-5 text-chart-4" />
            </div>
            <span className="text-2xl font-semibold text-foreground" data-testid="text-pending-jobs">
              {pendingJobs}
            </span>
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
