import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  Briefcase,
  Percent,
  AlertTriangle,
  UserCheck,
  FileText,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StatsDesktopViewProps {
  stats: {
    revenueThisWeek: number;
    revenueThisMonth: number;
    avgJobValue: number;
    jobsCompleted: number;
    conversionRate: number;
    cancellationRate: number;
    repeatCustomerPct: number;
    unpaidInvoices: number;
    weeklyChartData: { week: string; revenue: number }[];
    hasEnoughData: boolean;
  };
  insights: { message: string; id: string }[];
  paidJobsCount: number;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function DesktopStatCard({
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
    <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4 mb-3">
          <div
            className={`h-11 w-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
        </div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsDesktopView({ stats, insights, paidJobsCount }: StatsDesktopViewProps) {
  if (!stats.hasEnoughData) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6 lg:px-8" data-testid="desktop-stats">
        <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" data-testid="card-insufficient-data">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Complete more jobs to unlock detailed insights.
            </p>
            <p className="text-sm text-muted-foreground/60 mt-2">
              Once you have at least 3 jobs or 1 invoice, your statistics dashboard will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 lg:px-8" data-testid="desktop-stats">
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN — Revenue + Performance (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Revenue Chart — full width, prominent */}
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" data-testid="desktop-card-revenue-chart">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Weekly Revenue</p>
                  <p className="text-xs text-muted-foreground">Last 8 weeks</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.revenueThisMonth)}</p>
                  <p className="text-xs text-muted-foreground">this month</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.weeklyChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${Math.round(v / 100)}`}
                      className="text-muted-foreground"
                      width={50}
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
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Earnings stat cards — 3 across */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Earnings
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <DesktopStatCard
                icon={DollarSign}
                label="This Week"
                value={formatCurrency(stats.revenueThisWeek)}
                gradient="from-emerald-500 to-green-500"
                testId="desktop-stat-revenue-week"
              />
              <DesktopStatCard
                icon={TrendingUp}
                label="This Month"
                value={formatCurrency(stats.revenueThisMonth)}
                gradient="from-blue-500 to-cyan-500"
                testId="desktop-stat-revenue-month"
              />
              <DesktopStatCard
                icon={DollarSign}
                label="Avg Job Value"
                value={formatCurrency(stats.avgJobValue)}
                gradient="from-violet-500 to-purple-500"
                testId="desktop-stat-avg-job"
                subtext={`Based on ${paidJobsCount} paid jobs`}
              />
            </div>
          </section>

          {/* Performance stat cards — 3 across */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Performance
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <DesktopStatCard
                icon={Briefcase}
                label="Jobs Completed"
                value={String(stats.jobsCompleted)}
                gradient="from-amber-500 to-orange-500"
                testId="desktop-stat-jobs-completed"
              />
              <DesktopStatCard
                icon={Percent}
                label="Conversion Rate"
                value={`${stats.conversionRate}%`}
                subtext="Inquiries to Bookings"
                gradient="from-emerald-500 to-teal-500"
                testId="desktop-stat-conversion"
              />
              <DesktopStatCard
                icon={AlertTriangle}
                label="Cancellation Rate"
                value={`${stats.cancellationRate}%`}
                gradient="from-red-500 to-rose-500"
                testId="desktop-stat-cancellation"
              />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN — Customer Health + Insights (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Customer Health */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Customer Health
            </h2>
            <div className="space-y-4">
              <DesktopStatCard
                icon={UserCheck}
                label="Repeat Customers"
                value={`${stats.repeatCustomerPct}%`}
                gradient="from-indigo-500 to-blue-500"
                testId="desktop-stat-repeat"
              />
              <DesktopStatCard
                icon={FileText}
                label="Unpaid Invoices"
                value={String(stats.unpaidInvoices)}
                gradient="from-orange-500 to-amber-500"
                testId="desktop-stat-unpaid"
              />
            </div>
          </section>

          {/* Insights */}
          {insights.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Insights
              </h2>
              <Card className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" data-testid="desktop-card-insights">
                <CardContent className="p-5 space-y-3">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      data-testid={`desktop-insight-${insight.id}`}
                    >
                      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">{insight.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
