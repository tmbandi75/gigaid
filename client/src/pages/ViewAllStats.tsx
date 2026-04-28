import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Briefcase,
  FileText,
  AlertTriangle,
  BarChart3,
  Percent,
  UserCheck,
  Zap,
} from "lucide-react";
import { StatsDesktopView } from "@/components/stats/StatsDesktopView";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DashboardSummary, Job, Lead, Invoice } from "@shared/schema";

interface MoneyDashboardData {
  weeklyRevenue: number;
  pendingRevenue: number;
  atRiskCount: number;
  hotLeadCount: number;
}


function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  gradient,
  testId,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subtext?: string;
  gradient: string;
  testId: string;
}) {
  return (
    <Card className="border-0 shadow-md" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`h-9 w-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}
          >
            <Icon className="h-4 w-4 text-white" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard({
  message,
  testId,
}: {
  message: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
      data-testid={testId}
    >
      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
    </div>
  );
}

export default function ViewAllStats() {
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();

  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<DashboardSummary>({
      queryKey: QUERY_KEYS.dashboardSummary(),
    });

  const { data: moneyDashboard, isLoading: isMoneyLoading } =
    useQuery<MoneyDashboardData>({
      queryKey: QUERY_KEYS.moneyDashboard(),
    });

  const { data: jobs, isLoading: isJobsLoading } = useQuery<Job[]>({
    queryKey: QUERY_KEYS.jobs(),
  });

  const { data: leads } = useQuery<Lead[]>({
    queryKey: QUERY_KEYS.leads(),
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: QUERY_KEYS.invoices(),
  });

  const isLoading = isSummaryLoading || isMoneyLoading || isJobsLoading;

  const stats = useMemo(() => {
    const allJobs = jobs ?? [];
    const allLeads = leads ?? [];
    const allInvoices = invoices ?? [];

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedJobs = allJobs.filter((j) => j.status === "completed");
    const cancelledJobs = allJobs.filter((j) => j.status === "cancelled");

    const revenueThisWeek = summary?.weeklyStats?.earningsThisWeek ?? moneyDashboard?.weeklyRevenue ?? 0;
    const revenueThisMonth = summary?.monthlyStats?.earningsThisMonth ?? 0;

    const paidJobs = completedJobs.filter((j) => j.price && j.price > 0);
    const avgJobValue =
      paidJobs.length > 0
        ? Math.round(
            paidJobs.reduce((sum, j) => sum + (j.price ?? 0), 0) /
              paidJobs.length
          )
        : 0;

    const jobsCompleted = summary?.completedJobs ?? completedJobs.length;

    const convertedLeads = allLeads.filter(
      (l) => l.status === "converted" || l.convertedAt
    ).length;
    const totalLeads = allLeads.length;
    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const totalJobCount = allJobs.length;
    const cancelledCount = cancelledJobs.length;
    const cancellationRate =
      totalJobCount > 0
        ? Math.round((cancelledCount / totalJobCount) * 100)
        : 0;

    const clientMap = new Map<string, number>();
    completedJobs.forEach((j) => {
      const key =
        j.clientEmail?.toLowerCase() ||
        j.clientPhone ||
        j.clientName?.toLowerCase() ||
        "";
      if (key) {
        clientMap.set(key, (clientMap.get(key) ?? 0) + 1);
      }
    });
    const totalClients = clientMap.size;
    const repeatClients = Array.from(clientMap.values()).filter(
      (count) => count > 1
    ).length;
    const repeatCustomerPct =
      totalClients > 0
        ? Math.round((repeatClients / totalClients) * 100)
        : 0;

    const unpaidInvoices = allInvoices.filter(
      (inv) =>
        inv.status !== "paid" && inv.status !== "confirmed" && inv.status !== "draft"
    ).length;

    const weeklyChartData: { week: string; revenue: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekJobs = completedJobs.filter((j) => {
        const d = j.paidAt ? new Date(j.paidAt) : j.completedAt ? new Date(j.completedAt) : null;
        return d && d >= weekStart && d < weekEnd;
      });
      const weekRevenue = weekJobs.reduce(
        (sum, j) => sum + (j.price ?? 0),
        0
      );

      const label = weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      weeklyChartData.push({ week: label, revenue: weekRevenue });
    }

    const hasEnoughData = allJobs.length >= 3 || allInvoices.length >= 1;

    return {
      revenueThisWeek,
      revenueThisMonth,
      avgJobValue,
      jobsCompleted,
      conversionRate,
      cancellationRate,
      repeatCustomerPct,
      unpaidInvoices,
      weeklyChartData,
      hasEnoughData,
    };
  }, [jobs, leads, invoices, summary, moneyDashboard]);

  const insights = useMemo(() => {
    const messages: { message: string; id: string }[] = [];
    if (stats.unpaidInvoices > 3) {
      messages.push({
        id: "unpaid",
        message:
          "You have unpaid invoices. Auto reminders available in Pro.",
      });
    }
    if (stats.cancellationRate > 15) {
      messages.push({
        id: "cancellation",
        message:
          "High cancellation rate. Deposits reduce cancellations.",
      });
    }
    if (stats.conversionRate < 40 && stats.conversionRate > 0) {
      messages.push({
        id: "conversion",
        message:
          "Automated follow-ups increase conversion.",
      });
    }
    return messages;
  }, [stats]);

  const paidJobsCount = (jobs ?? []).filter((j) => j.status === "completed" && j.price).length;

  if (isLoading) {
    return (
      <div
        className="flex flex-col min-h-full bg-background"
        data-testid="page-view-all-stats"
      >
        <div className="border-b bg-background sticky top-0 z-10">
          <div
            className={
              isMobile
                ? "px-4 py-3 flex items-center gap-3"
                : "max-w-6xl mx-auto px-6 lg:px-8 py-4 flex items-center gap-3"
            }
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/more")}
              aria-label="Go back"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              View All Stats
            </h1>
          </div>
        </div>
        <div className={isMobile ? "px-4 py-6 space-y-4" : "max-w-6xl mx-auto w-full px-6 lg:px-8 py-6 space-y-4"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isMobile) {
    return (
      <div
        className="flex flex-col min-h-full bg-background"
        data-testid="page-view-all-stats"
      >
        <div className="border-b bg-background sticky top-0 z-[999]">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-5">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/more")}
                aria-label="Go back"
                data-testid="desktop-button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground" data-testid="text-stats-title">Statistics</h1>
                  <p className="text-sm text-muted-foreground">Your business performance at a glance</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StatsDesktopView
          stats={stats}
          insights={insights}
          paidJobsCount={paidJobsCount}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-full bg-background"
      data-testid="page-view-all-stats"
    >
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/more")}
            aria-label="Go back"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            View All Stats
          </h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        {!stats.hasEnoughData ? (
          <Card className="border-0 shadow-md" data-testid="card-insufficient-data">
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                Complete more jobs to unlock detailed insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Earnings
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={DollarSign}
                  label="This Week"
                  value={formatCurrency(stats.revenueThisWeek)}
                  gradient="from-emerald-500 to-green-500"
                  testId="stat-revenue-week"
                />
                <StatCard
                  icon={TrendingUp}
                  label="This Month"
                  value={formatCurrency(stats.revenueThisMonth)}
                  gradient="from-blue-500 to-cyan-500"
                  testId="stat-revenue-month"
                />
                <StatCard
                  icon={DollarSign}
                  label="Avg Job Value"
                  value={formatCurrency(stats.avgJobValue)}
                  gradient="from-violet-500 to-purple-500"
                  testId="stat-avg-job"
                  subtext={`Based on ${paidJobsCount} paid jobs`}
                />
              </div>

              <Card className="border-0 shadow-md mt-3" data-testid="card-revenue-chart">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-3">
                    Weekly Revenue (Last 8 Weeks)
                  </p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.weeklyChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 10 }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            `$${Math.round(v / 100)}`
                          }
                          className="text-muted-foreground"
                          width={45}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatCurrency(value),
                            "Revenue",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Performance
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Briefcase}
                  label="Jobs Completed"
                  value={String(stats.jobsCompleted)}
                  gradient="from-amber-500 to-orange-500"
                  testId="stat-jobs-completed"
                />
                <StatCard
                  icon={Percent}
                  label="Conversion Rate"
                  value={`${stats.conversionRate}%`}
                  subtext="Inquiries → Bookings"
                  gradient="from-emerald-500 to-teal-500"
                  testId="stat-conversion"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Cancellation Rate"
                  value={`${stats.cancellationRate}%`}
                  gradient="from-red-500 to-rose-500"
                  testId="stat-cancellation"
                />
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                Customer Health
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={UserCheck}
                  label="Repeat Customers"
                  value={`${stats.repeatCustomerPct}%`}
                  gradient="from-indigo-500 to-blue-500"
                  testId="stat-repeat"
                />
                <StatCard
                  icon={FileText}
                  label="Unpaid Invoices"
                  value={String(stats.unpaidInvoices)}
                  gradient="from-orange-500 to-amber-500"
                  testId="stat-unpaid"
                />
              </div>
            </div>

            {insights.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
                  Insights
                </h2>
                <Card className="border-0 shadow-md" data-testid="card-insights">
                  <CardContent className="p-4 space-y-3">
                    {insights.map((insight) => (
                      <InsightCard
                        key={insight.id}
                        message={insight.message}
                        testId={`insight-${insight.id}`}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        <div className="h-20" />
      </div>
    </div>
  );
}
