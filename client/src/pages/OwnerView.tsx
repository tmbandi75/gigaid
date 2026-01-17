import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Briefcase,
  Users,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowLeft,
  Crown,
  Lock,
  ChevronRight,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OwnerMetrics {
  isPro: boolean;
  weeklyRevenue: number;
  monthlyRevenue: number;
  revenueChange: number;
  jobsCompletedThisWeek: number;
  jobsCompletedLastWeek: number;
  newLeadsThisWeek: number;
  newLeadsLastWeek: number;
  outstandingInvoices: { count: number; totalCents: number };
  upcomingJobs: Array<{
    id: string;
    clientName: string;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    priceCents: number;
  }>;
  recentCompletedJobs: Array<{
    id: string;
    clientName: string;
    serviceType: string;
    completedAt: string;
    priceCents: number;
  }>;
  jobsWithDepositThisWeek?: number;
  depositsCollectedThisWeek?: number;
}

function UpgradeGate() {
  const [, navigate] = useLocation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4" data-testid="page-upgrade-gate">
      <Card className="max-w-lg w-full border-0 shadow-xl" data-testid="card-upgrade-gate">
        <CardContent className="pt-12 pb-8 text-center">
          <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
            <Lock className="h-10 w-10 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2" data-testid="text-upgrade-title">Owner View is a Pro Feature</h1>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto" data-testid="text-upgrade-description">
            Get a bird's eye view of your business with powerful insights and analytics
          </p>
          
          <div className="text-left space-y-4 mb-8 p-6 bg-muted/50 rounded-xl" data-testid="list-features">
            <div className="flex items-center gap-3" data-testid="feature-revenue">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm">See weekly & monthly revenue trends</span>
            </div>
            <div className="flex items-center gap-3" data-testid="feature-invoices">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm">Track unpaid invoices at a glance</span>
            </div>
            <div className="flex items-center gap-3" data-testid="feature-upcoming">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm">Know what jobs are coming up</span>
            </div>
            <div className="flex items-center gap-3" data-testid="feature-email">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm">Weekly email business summaries</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button 
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
              onClick={() => navigate("/settings")}
              data-testid="button-upgrade-pro"
            >
              <Crown className="h-5 w-5 mr-2" />
              Upgrade to Pro
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => navigate("/jobs")}
              data-testid="button-back-jobs"
            >
              Back to Jobs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendLabel,
  color = "primary" 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: any;
  trend?: number;
  trendLabel?: string;
  color?: "primary" | "green" | "blue" | "amber" | "red";
}) {
  const colorClasses = {
    primary: "from-primary to-violet-500",
    green: "from-green-500 to-emerald-500",
    blue: "from-blue-500 to-cyan-500",
    amber: "from-amber-500 to-yellow-500",
    red: "from-red-500 to-rose-500",
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{trend >= 0 ? "+" : ""}{trend}%</span>
                {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerView() {
  const [, navigate] = useLocation();

  const { data: metrics, isLoading, error } = useQuery<OwnerMetrics>({
    queryKey: ["/api/owner/metrics"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Owner View is now available to all users
  if (!metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
        <p className="text-muted-foreground">Unable to load metrics</p>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950" data-testid="page-owner-view">
      <header className="bg-white dark:bg-slate-900 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/more")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Owner View</h1>
                <p className="text-sm text-muted-foreground">Business snapshot</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Weekly Revenue"
            value={formatCurrency(metrics.weeklyRevenue)}
            trend={metrics.revenueChange}
            trendLabel="vs last week"
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title="Monthly Revenue"
            value={formatCurrency(metrics.monthlyRevenue)}
            icon={TrendingUp}
            color="blue"
          />
          <MetricCard
            title="Jobs Completed"
            value={`${metrics.jobsCompletedThisWeek}`}
            subtitle={`${metrics.jobsCompletedLastWeek} last week`}
            icon={Briefcase}
            color="primary"
          />
          <MetricCard
            title="New Leads"
            value={`${metrics.newLeadsThisWeek}`}
            subtitle={`${metrics.newLeadsLastWeek} last week`}
            icon={Users}
            color="amber"
          />
        </div>

        {(metrics.jobsWithDepositThisWeek || 0) > 0 || (metrics.depositsCollectedThisWeek || 0) > 0 ? (
          <Card className="border-0 shadow-md mb-8 border-l-4 border-l-teal-500" data-testid="card-deposit-metrics">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Deposit-Secured Jobs</h3>
                    <p className="text-sm text-muted-foreground">
                      {metrics.jobsWithDepositThisWeek || 0} job{(metrics.jobsWithDepositThisWeek || 0) !== 1 ? "s" : ""} secured with deposits this week
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400" data-testid="text-deposits-collected">
                    {formatCurrency(metrics.depositsCollectedThisWeek || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">collected this week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {metrics.outstandingInvoices.count > 0 && (
          <Card className="border-0 shadow-md mb-8 border-l-4 border-l-amber-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Outstanding Invoices</h3>
                    <p className="text-sm text-muted-foreground">
                      {metrics.outstandingInvoices.count} invoice{metrics.outstandingInvoices.count !== 1 ? "s" : ""} awaiting payment
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(metrics.outstandingInvoices.totalCents)}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate("/invoices")}
                    data-testid="button-view-invoices"
                  >
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Jobs
                </CardTitle>
                <Badge variant="secondary">{metrics.upcomingJobs.length} scheduled</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {metrics.upcomingJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No upcoming jobs scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.upcomingJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover-elevate cursor-pointer"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      data-testid={`job-upcoming-${job.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{job.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.serviceType} • {format(new Date(job.scheduledDate), "MMM d")} at {job.scheduledTime}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(job.priceCents)}</span>
                    </div>
                  ))}
                  {metrics.upcomingJobs.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full" 
                      onClick={() => navigate("/jobs")}
                    >
                      View all {metrics.upcomingJobs.length} jobs <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Recently Completed
                </CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  This week
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {metrics.recentCompletedJobs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No completed jobs this week</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.recentCompletedJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`job-completed-${job.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{job.clientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {job.serviceType} • {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(job.priceCents)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
