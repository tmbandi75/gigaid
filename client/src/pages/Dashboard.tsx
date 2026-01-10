import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TopBar } from "@/components/layout/TopBar";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { RevenueCard } from "@/components/dashboard/RevenueCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UpcomingJobs } from "@/components/dashboard/UpcomingJobs";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardSummary } from "@shared/schema";

interface OnboardingStatus {
  completed: boolean;
  step: number;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);

  const { data: summary, isLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard/summary"],
  });

  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("gig-aid-welcome-seen");
    if (!hasSeenWelcome && !onboarding?.completed) {
      setShowWelcome(true);
    }
  }, [onboarding?.completed]);

  useEffect(() => {
    const lastActive = localStorage.getItem("gig-aid-last-active");
    if (lastActive) {
      const daysSinceActive = Math.floor((Date.now() - parseInt(lastActive)) / (1000 * 60 * 60 * 24));
      if (daysSinceActive >= 3) {
        setShowInactivityModal(true);
      }
    }
    localStorage.setItem("gig-aid-last-active", Date.now().toString());
  }, []);

  const handleWelcomeClose = () => {
    localStorage.setItem("gig-aid-welcome-seen", "true");
    setShowWelcome(false);
  };

  const handleOnboardingStepClick = (step: number, route: string) => {
    navigate(route);
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem("gig-aid-onboarding-complete", "true");
  };

  const stats = period === "weekly" ? summary?.weeklyStats : summary?.monthlyStats;
  const periodLabel = period === "weekly" ? "This Week" : "This Month";

  return (
    <div className="flex flex-col min-h-full" data-testid="page-dashboard">
      <TopBar title="Gig Aid" />
      
      <div className="px-4 py-6 space-y-6">
        {!onboarding?.completed && onboarding?.step !== undefined && onboarding.step < 4 && (
          <OnboardingChecklist
            currentStep={onboarding.step}
            onStepClick={handleOnboardingStepClick}
            onComplete={handleOnboardingComplete}
          />
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Summary</h2>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
            <TabsList className="h-8">
              <TabsTrigger value="weekly" className="text-xs px-3" data-testid="tab-weekly">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-3" data-testid="tab-monthly">
                Monthly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <SummaryCard
          totalJobs={stats?.jobsThisWeek ?? stats?.jobsThisMonth ?? summary?.totalJobs ?? 0}
          completedJobs={summary?.completedJobs ?? 0}
          totalLeads={stats?.leadsThisWeek ?? stats?.leadsThisMonth ?? summary?.totalLeads ?? 0}
          newLeads={summary?.newLeads ?? 0}
          isLoading={isLoading}
          periodLabel={periodLabel}
        />
        
        <RevenueCard
          totalEarnings={stats?.earningsThisWeek ?? stats?.earningsThisMonth ?? summary?.totalEarnings ?? 0}
          isLoading={isLoading}
          periodLabel={periodLabel}
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

      <WelcomeModal
        open={showWelcome}
        onClose={handleWelcomeClose}
        onStart={handleWelcomeClose}
      />

      <Dialog open={showInactivityModal} onOpenChange={setShowInactivityModal}>
        <DialogContent data-testid="dialog-inactivity">
          <DialogHeader>
            <DialogTitle>Welcome back!</DialogTitle>
            <DialogDescription>
              It's been a few days since you last used Gig Aid. Here's what you might have missed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {summary?.pendingReminders && summary.pendingReminders > 0 && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">{summary.pendingReminders} pending reminder{summary.pendingReminders > 1 ? 's' : ''}</p>
                <p className="text-sm text-muted-foreground">You have reminders waiting to be sent</p>
              </div>
            )}
            {(summary?.newLeads ?? 0) > 0 && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">{summary?.newLeads} new lead{(summary?.newLeads ?? 0) > 1 ? 's' : ''}</p>
                <p className="text-sm text-muted-foreground">Don't forget to follow up!</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInactivityModal(false)} data-testid="button-dismiss-inactivity">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
