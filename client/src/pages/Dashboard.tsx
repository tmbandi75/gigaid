import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import FollowUpCheckIn from "@/components/FollowUpCheckIn";
import {
  Briefcase,
  Users,
  FileText,
  DollarSign,
  Plus,
  UserPlus,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Bell,
  CheckCircle2,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import type { DashboardSummary, Job, Lead } from "@shared/schema";

interface OnboardingStatus {
  completed: boolean;
  step: number;
}

interface UserProfile {
  id: string;
  name: string;
  publicProfileSlug?: string;
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
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
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
  const completionRate = stats?.completionRate ?? 0;
  const periodJobs = period === "weekly" 
    ? (summary?.weeklyStats?.jobsThisWeek ?? 0)
    : (summary?.monthlyStats?.jobsThisMonth ?? 0);
  const upcomingJobs = summary?.upcomingJobs ?? [];
  const recentLeads = summary?.recentLeads ?? [];

  const quickActions = [
    { icon: Plus, label: "New Job", href: "/jobs/new", gradient: "from-violet-500 to-purple-600" },
    { icon: UserPlus, label: "New Lead", href: "/leads/new", gradient: "from-emerald-500 to-teal-500" },
    { icon: FileText, label: "Invoice", href: "/invoices/new", gradient: "from-blue-500 to-cyan-500" },
    { icon: Sparkles, label: "AI Tools", href: "/ai-tools", gradient: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background" data-testid="page-dashboard">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 pt-6 pb-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-primary-foreground/80 text-sm">{getGreeting()}</p>
              <h1 className="text-2xl font-bold">GigAid</h1>
            </div>
            <Link href="/reminders">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-white/20 relative"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5" />
                {(summary?.pendingReminders ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center">
                    {summary?.pendingReminders}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPeriod("weekly")}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                period === "weekly"
                  ? "bg-white/25 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
              data-testid="tab-weekly"
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                period === "monthly"
                  ? "bg-white/25 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
              data-testid="tab-monthly"
            >
              Monthly
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">{periodLabel}</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-period-earnings">
                {isLoading ? "..." : formatCurrency(period === "weekly" ? (summary?.weeklyStats?.earningsThisWeek ?? 0) : (summary?.monthlyStats?.earningsThisMonth ?? 0))}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-primary-foreground/80">
                <TrendingUp className="h-3 w-3" />
                <span>{period === "weekly" ? (summary?.weeklyStats?.jobsThisWeek ?? 0) : (summary?.monthlyStats?.jobsThisMonth ?? 0)} jobs</span>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary-foreground/80" />
                <span className="text-xs text-primary-foreground/80">Leads</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-period-leads">
                {isLoading ? "..." : (period === "weekly" ? (summary?.weeklyStats?.leadsThisWeek ?? 0) : (summary?.monthlyStats?.leadsThisMonth ?? 0))}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-primary-foreground/80">
                <ArrowUpRight className="h-3 w-3" />
                <span>{summary?.newLeads ?? 0} new</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 -mt-4">
        {!onboarding?.completed && onboarding?.step !== undefined && (
          <OnboardingChecklist
            currentStep={onboarding.step}
            onStepClick={handleOnboardingStepClick}
            onComplete={handleOnboardingComplete}
            bookingSlug={profile?.publicProfileSlug}
          />
        )}

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} data-testid={`link-quick-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover-elevate cursor-pointer" data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-center">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Follow-up check-ins for leads */}
        <FollowUpCheckIn />

        {periodJobs > 0 && (
          <Card className="overflow-hidden border-0 shadow-sm" data-testid="card-progress">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{periodLabel} Progress</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(periodJobs * completionRate / 100)} of {periodJobs} jobs done
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming Jobs
            </h2>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="text-primary h-8 px-2" data-testid="link-view-all-jobs">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex gap-3 animate-pulse">
                      <div className="h-12 w-12 rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : upcomingJobs.length === 0 ? (
            <Card className="border-0 shadow-sm" data-testid="card-no-jobs">
              <CardContent className="py-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">No upcoming jobs</p>
                <p className="text-sm text-muted-foreground mb-4">Schedule your first job to get started</p>
                <Link href="/jobs/new">
                  <Button data-testid="button-add-first-job">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Job
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.slice(0, 3).map((job: Job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} data-testid={`link-job-${job.id}`}>
                  <Card className="border-0 shadow-sm hover-elevate cursor-pointer overflow-hidden" data-testid={`job-card-${job.id}`}>
                    <CardContent className="p-0">
                      <div className="flex">
                        <div className={`w-1 ${job.status === "in_progress" ? "bg-amber-500" : "bg-primary"}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-start gap-3">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${job.status === "in_progress" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                              <Briefcase className={`h-5 w-5 ${job.status === "in_progress" ? "text-amber-500" : "text-primary"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold truncate">{job.title}</p>
                                {job.status === "in_progress" && (
                                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5">
                                    In Progress
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}
                                </span>
                              </div>
                              {job.location && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{job.location}</span>
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {recentLeads.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recent Leads
              </h2>
              <Link href="/leads">
                <Button variant="ghost" size="sm" className="text-primary h-8 px-2" data-testid="link-view-all-leads">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {recentLeads.slice(0, 5).map((lead: Lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} data-testid={`link-lead-${lead.id}`}>
                    <Card className="border-0 shadow-sm hover-elevate cursor-pointer min-w-[200px]" data-testid={`lead-card-${lead.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${lead.status === "new" ? "bg-emerald-500/10" : "bg-blue-500/10"}`}>
                            <Users className={`h-4 w-4 ${lead.status === "new" ? "text-emerald-500" : "text-blue-500"}`} />
                          </div>
                          <Badge variant="secondary" className={`text-[10px] px-1.5 ${lead.status === "new" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                            {lead.status === "new" ? "New" : "Contacted"}
                          </Badge>
                        </div>
                        <p className="font-semibold text-sm truncate">{lead.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.serviceType}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5 border-primary/20" data-testid="card-ai-tip">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1">AI Assistant Ready</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Use voice commands to create jobs, send invoices, and manage your business hands-free.
                </p>
                <Link href="/ai-tools">
                  <Button size="sm" variant="outline" className="h-8" data-testid="button-try-ai">
                    <Sparkles className="h-3 w-3 mr-2" />
                    Explore AI Tools
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-20" />
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
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{summary.pendingReminders} pending reminder{summary.pendingReminders > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">You have reminders waiting to be sent</p>
                </div>
              </div>
            )}
            {(summary?.newLeads ?? 0) > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{summary?.newLeads} new lead{(summary?.newLeads ?? 0) > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">Don't forget to follow up!</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInactivityModal(false)} className="w-full" data-testid="button-dismiss-inactivity">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
