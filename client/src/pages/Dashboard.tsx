import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { RevenueCard } from "@/components/dashboard/RevenueCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UpcomingJobs } from "@/components/dashboard/UpcomingJobs";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import type { DashboardSummary } from "@shared/schema";

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  return (
    <div className="flex flex-col min-h-full" data-testid="page-dashboard">
      <TopBar title="Gig Aid" />
      
      <div className="px-4 py-6 space-y-6">
        <SummaryCard
          totalJobs={summary?.totalJobs ?? 0}
          completedJobs={summary?.completedJobs ?? 0}
          totalLeads={summary?.totalLeads ?? 0}
          newLeads={summary?.newLeads ?? 0}
          isLoading={isLoading}
        />
        
        <RevenueCard
          totalEarnings={summary?.totalEarnings ?? 0}
          isLoading={isLoading}
        />
        
        <QuickActions />
        
        <UpcomingJobs 
          jobs={summary?.upcomingJobs ?? []} 
          isLoading={isLoading}
        />
        
        <RecentLeads 
          leads={summary?.recentLeads ?? []} 
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
