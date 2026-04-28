import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatCurrency as baseFormatCurrency } from "@/lib/formatCurrency";
import { safePrice, safePriceExact } from "@/lib/safePrice";
import { TrendingUp, Users, DollarSign, BarChart3, Target, Loader2, Sparkles, ArrowUpRight, ArrowLeft, Share2, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RevenueSummary {
  mrr: number;
  payingCustomers: number;
  netChurnPct: number;
  revenueAtRisk: number;
}

interface RevenueData {
  summary: RevenueSummary;
  dailyMetrics: Array<{
    date: string;
    mrr: number;
    payingCustomers: number;
    newUsers: number;
    churnedUsers: number;
  }>;
  planDistribution: Array<{
    plan: string;
    count: number;
  }>;
  mrrByPlan: Array<{
    plan: string;
    customers: number;
    mrr: number;
  }>;
}

interface CohortRow {
  cohort_month: string;
  total_signups: number;
  converted_to_paid: number;
  received_payment: number;
  conversion_rate: number;
}

interface FunnelData {
  signupToPayment: {
    signups: number;
    enabledProfile: number;
    createdBookingLink: number;
    sharedBookingLink: number;
    receivedBooking: number;
    receivedPayment: number;
    subscribed: number;
  };
  leadToJob: {
    totalLeads: number;
    contacted: number;
    quoted: number;
    converted: number;
  };
  jobToPayment: {
    totalJobs: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    invoiced: number;
    paid: number;
  };
  period: string;
}

interface LtvData {
  ltvByPlan: Array<{
    plan: string;
    customers: number;
    avgLifetimeMonths: string;
    avgLtv: string;
  }>;
}

interface ShareFunnelSeriesPoint {
  date: string;
  taps: number;
  completions: number;
  copies: number;
}

interface ShareFunnelData {
  period: string;
  totals: {
    taps: number;
    completions: number;
    copies: number;
    tapToCompletionRate: number;
  };
  surfaces: Array<{
    screen: string;
    taps: number;
    completions: number;
    copies: number;
    tapToCompletionRate: number;
  }>;
  platforms: Array<{
    platform: string;
    taps: number;
    completions: number;
    copies: number;
    tapToCompletionRate: number;
  }>;
  targets: Array<{
    target: string;
    completions: number;
    copies: number;
    shareOfCompletions: number;
  }>;
  series: ShareFunnelSeriesPoint[];
  platformSeries: Record<string, ShareFunnelSeriesPoint[]>;
  notes: {
    taps: string;
    completions: string;
    copies: string;
    platforms: string;
    targets?: string;
    series?: string;
    historical?: string;
  };
}

const SURFACE_LABELS: Record<string, string> = {
  plan: "Plan (dashboard)",
  leads: "Leads",
  leads_empty: "Leads (empty state)",
  jobs: "Jobs",
  bookings: "Bookings",
  nba: "NBA card",
  other: "Other",
  unknown: "Unknown",
};

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  ios: "iOS",
  android: "Android",
  unknown: "Unknown",
};

const TARGET_LABELS: Record<string, string> = {
  messages: "Messages",
  mail: "Mail",
  whatsapp: "WhatsApp",
  airdrop: "AirDrop",
  copy: "Copy fallback",
  facebook: "Facebook",
  facebook_messenger: "Messenger",
  twitter: "Twitter / X",
  instagram: "Instagram",
  snapchat: "Snapchat",
  slack: "Slack",
  gmail: "Gmail",
  google: "Google",
  linkedin: "LinkedIn",
  discord: "Discord",
  telegram: "Telegram",
  notes: "Apple Notes",
  reminders: "Reminders",
  unknown: "Unknown",
};

function formatTargetLabel(target: string): string {
  if (TARGET_LABELS[target]) return TARGET_LABELS[target];
  // Strip Apple's reverse-DNS prefix and any extension suffix so the
  // long-tail still reads reasonably (e.g.
  // "com.acme.MyApp.ShareExtension" → "MyApp").
  const segments = target.split(".");
  const cleaned = segments
    .filter((s) => s && !/^share/i.test(s) && !/^extension/i.test(s))
    .pop();
  return cleaned || target;
}

function formatCurrency(cents: number | null | undefined): string {
  return baseFormatCurrency(cents, { maximumFractionDigits: 2 });
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-2" data-testid={`funnel-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  iconColor,
  iconBg,
}: { 
  title: string; 
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card className="border-0 shadow-sm" data-testid={`card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SHARE_FUNNEL_PLATFORM_COLORS: Record<string, string> = {
  all: "hsl(var(--primary))",
  web: "#2563eb",
  ios: "#0ea5e9",
  android: "#16a34a",
  unknown: "#6b7280",
};

function formatChartDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const SHARE_DESTINATION_BAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

const SHARE_DESTINATION_TOP_N = 8;

interface ShareDestinationChartDatum {
  target: string;
  label: string;
  completions: number;
  copies: number;
  shareOfCompletions: number;
}

function ShareDestinationChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ShareDestinationChartDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-sm px-3 py-2 text-xs space-y-1"
      data-testid={`share-funnel-target-tooltip-${datum.target}`}
    >
      <p className="font-medium text-sm">{datum.label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Completions</span>
        <span className="tabular-nums">{datum.completions.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Copies</span>
        <span className="tabular-nums">{datum.copies.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">% of tagged completions</span>
        <span className="tabular-nums font-medium">
          {(datum.shareOfCompletions * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ShareDestinationChart({
  targets,
}: {
  targets: ShareFunnelData["targets"];
}) {
  const ranked = [...targets].sort((a, b) => {
    if (b.completions !== a.completions) return b.completions - a.completions;
    if (b.copies !== a.copies) return b.copies - a.copies;
    return a.target.localeCompare(b.target);
  });
  const top = ranked.slice(0, SHARE_DESTINATION_TOP_N);
  const data: ShareDestinationChartDatum[] = top.map((t) => ({
    target: t.target,
    label: formatTargetLabel(t.target),
    completions: t.completions,
    copies: t.copies,
    shareOfCompletions: t.shareOfCompletions,
  }));

  if (data.length === 0 || data.every((d) => d.completions === 0)) {
    return null;
  }

  const chartHeight = Math.max(180, data.length * 36 + 32);
  const remaining = ranked.length - top.length;

  return (
    <div className="mb-4" data-testid="chart-share-funnel-targets">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          Top {data.length} destinations by completions
        </p>
        {remaining > 0 && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="chart-share-funnel-targets-remaining"
          >
            +{remaining} more in table below
          </p>
        )}
      </div>
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              className="text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11 }}
              width={110}
              className="text-muted-foreground"
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              content={<ShareDestinationChartTooltip />}
            />
            <Bar dataKey="completions" name="Completions" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.target}
                  fill={SHARE_DESTINATION_BAR_COLORS[index % SHARE_DESTINATION_BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ShareFunnelTrendChart({
  series,
  platformSeries,
  selectedPlatform,
  onSelectPlatform,
}: {
  series: ShareFunnelSeriesPoint[];
  platformSeries: Record<string, ShareFunnelSeriesPoint[]>;
  selectedPlatform: string;
  onSelectPlatform: (value: string) => void;
}) {
  const platformKeys = Object.keys(platformSeries).sort();
  const platformOptions = ["all", ...platformKeys];

  // If a previously selected platform is no longer in the returned window
  // (e.g. the admin shrank the window and that platform stopped reporting),
  // fall back to "all" so the dropdown never shows a dangling value.
  useEffect(() => {
    if (selectedPlatform !== "all" && !platformKeys.includes(selectedPlatform)) {
      onSelectPlatform("all");
    }
  }, [selectedPlatform, platformKeys, onSelectPlatform]);

  const activeSeries =
    selectedPlatform === "all"
      ? series
      : platformSeries[selectedPlatform] ?? [];

  const hasAnyActivity = activeSeries.some(
    (p) => p.taps > 0 || p.completions > 0 || p.copies > 0,
  );

  const accentColor =
    SHARE_FUNNEL_PLATFORM_COLORS[selectedPlatform] ??
    SHARE_FUNNEL_PLATFORM_COLORS.all;

  return (
    <div data-testid="share-funnel-trend">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium">Trend over time</h3>
        <Select value={selectedPlatform} onValueChange={onSelectPlatform}>
          <SelectTrigger
            className="w-40 h-9 rounded-lg"
            data-testid="select-share-funnel-platform"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map((p) => (
              <SelectItem
                key={p}
                value={p}
                data-testid={`select-option-share-funnel-platform-${p}`}
              >
                {p === "all"
                  ? "All platforms"
                  : PLATFORM_LABELS[p] || p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {activeSeries.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="share-funnel-trend-empty"
        >
          No daily share activity to chart for this window.
        </p>
      ) : !hasAnyActivity ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="share-funnel-trend-empty"
        >
          No share activity recorded in this window
          {selectedPlatform === "all"
            ? "."
            : ` for ${PLATFORM_LABELS[selectedPlatform] || selectedPlatform}.`}
        </p>
      ) : (
        <div className="h-64 w-full" data-testid="chart-share-funnel-trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={formatChartDate}
                minTickGap={20}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                className="text-muted-foreground"
                width={36}
              />
              <Tooltip
                labelFormatter={(label: string) => formatChartDate(label)}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="taps"
                name="Taps"
                stroke={accentColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="completions"
                name="Completions"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="copies"
                name="Copies"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState("30");
  const [shareFunnelPlatform, setShareFunnelPlatform] = useState<string>("all");

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: QUERY_KEYS.adminAnalyticsRevenue(),
  });

  const { data: cohorts, isLoading: cohortsLoading } = useQuery<{ cohorts: CohortRow[] }>({
    queryKey: QUERY_KEYS.adminAnalyticsCohorts(),
  });

  const { data: funnels, isLoading: funnelsLoading } = useQuery<FunnelData>({
    queryKey: QUERY_KEYS.adminAnalyticsFunnels(days),
  });

  const { data: ltv, isLoading: ltvLoading } = useQuery<LtvData>({
    queryKey: QUERY_KEYS.adminAnalyticsLtv(),
  });

  const { data: shareFunnel, isLoading: shareFunnelLoading } = useQuery<ShareFunnelData>({
    queryKey: QUERY_KEYS.adminAnalyticsShareFunnel(days),
  });

  const isLoading = revenueLoading || cohortsLoading || funnelsLoading || ltvLoading || shareFunnelLoading;

  return (
    <div className="space-y-6" data-testid="page-admin-analytics">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-500" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Revenue, funnels, and cohort analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/admin/cockpit" data-testid="link-back-to-cockpit">
              <ArrowLeft className="h-4 w-4" />
              Back to Cockpit
            </Link>
          </Button>
          <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36 h-10 rounded-xl" data-testid="select-days">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7" data-testid="select-option-7">Last 7 days</SelectItem>
            <SelectItem value="30" data-testid="select-option-30">Last 30 days</SelectItem>
            <SelectItem value="90" data-testid="select-option-90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-muted-foreground mt-3">Loading analytics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="MRR" 
              value={formatCurrency(revenue?.summary?.mrr || 0)}
              icon={DollarSign}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-500/10"
            />
            <MetricCard 
              title="Paying Customers" 
              value={(revenue?.summary?.payingCustomers || 0).toString()}
              icon={Users}
              iconColor="text-blue-600"
              iconBg="bg-blue-500/10"
            />
            <MetricCard 
              title="Net Churn" 
              value={`${revenue?.summary?.netChurnPct?.toFixed(1) || 0}%`}
              icon={TrendingUp}
              iconColor="text-amber-600"
              iconBg="bg-amber-500/10"
            />
            <MetricCard 
              title="At Risk" 
              value={formatCurrency(revenue?.summary?.revenueAtRisk || 0)}
              icon={Target}
              iconColor="text-red-600"
              iconBg="bg-red-500/10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm" data-testid="card-plan-distribution">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-500" />
                  Plan Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenue?.planDistribution?.map((p) => (
                    <div key={p.plan} className="flex items-center justify-between p-3 rounded-xl bg-muted/30" data-testid={`plan-row-${p.plan}`}>
                      <Badge variant="outline">{p.plan}</Badge>
                      <span className="font-medium">{p.count.toLocaleString()} users</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" data-testid="card-mrr-by-plan">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                  MRR by Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenue?.mrrByPlan?.map((p) => (
                    <div key={p.plan} className="flex items-center justify-between p-3 rounded-xl bg-muted/30" data-testid={`mrr-row-${p.plan}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{p.plan}</Badge>
                        <span className="text-sm text-muted-foreground">({p.customers} customers)</span>
                      </div>
                      <span className="font-bold">{safePriceExact(p.mrr).replace(/\.00$/, "")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm" data-testid="card-signup-funnel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-violet-500" />
                Signup to Payment Funnel ({funnels?.period})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnels?.signupToPayment && (
                <>
                  <FunnelBar label="Signups" value={funnels.signupToPayment.signups} total={funnels.signupToPayment.signups} color="bg-blue-500" />
                  <FunnelBar label="Enabled Profile" value={funnels.signupToPayment.enabledProfile} total={funnels.signupToPayment.signups} color="bg-blue-400" />
                  <FunnelBar label="Created Booking Link" value={funnels.signupToPayment.createdBookingLink} total={funnels.signupToPayment.signups} color="bg-violet-400" />
                  <FunnelBar label="Shared Booking Link" value={funnels.signupToPayment.sharedBookingLink} total={funnels.signupToPayment.signups} color="bg-violet-500" />
                  <FunnelBar label="Received Booking" value={funnels.signupToPayment.receivedBooking} total={funnels.signupToPayment.signups} color="bg-emerald-400" />
                  <FunnelBar label="Received Payment" value={funnels.signupToPayment.receivedPayment} total={funnels.signupToPayment.signups} color="bg-emerald-500" />
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm" data-testid="card-lead-funnel">
              <CardHeader>
                <CardTitle>Lead to Job Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnels?.leadToJob && (
                  <>
                    <FunnelBar label="Total Leads" value={funnels.leadToJob.totalLeads} total={funnels.leadToJob.totalLeads} color="bg-purple-500" />
                    <FunnelBar label="Contacted" value={funnels.leadToJob.contacted} total={funnels.leadToJob.totalLeads} color="bg-purple-400" />
                    <FunnelBar label="Quoted" value={funnels.leadToJob.quoted} total={funnels.leadToJob.totalLeads} color="bg-purple-300" />
                    <FunnelBar label="Converted" value={funnels.leadToJob.converted} total={funnels.leadToJob.totalLeads} color="bg-emerald-500" />
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" data-testid="card-job-funnel">
              <CardHeader>
                <CardTitle>Job to Payment Funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnels?.jobToPayment && (
                  <>
                    <FunnelBar label="Total Jobs" value={funnels.jobToPayment.totalJobs} total={funnels.jobToPayment.totalJobs} color="bg-orange-500" />
                    <FunnelBar label="Scheduled" value={funnels.jobToPayment.scheduled} total={funnels.jobToPayment.totalJobs} color="bg-orange-400" />
                    <FunnelBar label="In Progress" value={funnels.jobToPayment.inProgress} total={funnels.jobToPayment.totalJobs} color="bg-amber-400" />
                    <FunnelBar label="Completed" value={funnels.jobToPayment.completed} total={funnels.jobToPayment.totalJobs} color="bg-emerald-400" />
                    <FunnelBar label="Invoiced" value={funnels.jobToPayment.invoiced} total={funnels.jobToPayment.totalJobs} color="bg-emerald-500" />
                    <FunnelBar label="Paid" value={funnels.jobToPayment.paid} total={funnels.jobToPayment.totalJobs} color="bg-emerald-600" />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm" data-testid="card-share-funnel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-violet-500" />
                Booking Link Share Funnel ({shareFunnel?.period})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {shareFunnel?.totals && (
                <>
                  <Alert
                    className="border-amber-500/30 bg-amber-500/10 text-foreground"
                    data-testid="share-funnel-semantic-banner"
                  >
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs leading-relaxed">
                      <strong>New completion definition (Task #98, April 2026):</strong>{" "}
                      A "share completion" now means the OS share sheet was{" "}
                      <em>confirmed</em> (or a successful copy fallback fired).
                      Cancelled share-sheet taps are no longer counted as
                      completions. This card already uses the corrected
                      server-side <code>booking_link_share_completed</code>{" "}
                      event, so the totals and conversion rate below are
                      accurate for the selected window. However, raw{" "}
                      <code>booking_link_shared</code> totals in PostHog from
                      <em> before</em> Task #98 are inflated because every
                      Share-button tap was logged as a completion — expect
                      post-Task-#98 numbers to be lower in any historical
                      comparison. PostHog dashboards/insights/alerts that
                      track top-of-funnel intent should be migrated to{" "}
                      <code>booking_link_share_opened</code>; conversion
                      reports keying off <code>booking_link_shared</code>{" "}
                      should be kept with a note about the semantic change.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-muted/30" data-testid="share-funnel-total-taps">
                      <p className="text-xs text-muted-foreground">Share taps</p>
                      <p className="text-2xl font-bold mt-1">{shareFunnel.totals.taps.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Every Share-button press (open <em>or</em> cancel).
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30" data-testid="share-funnel-total-completions">
                      <p className="text-xs text-muted-foreground">Share completions</p>
                      <p className="text-2xl font-bold mt-1">{shareFunnel.totals.completions.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Confirmed shares only — cancelled share sheets excluded
                        (Task #98).
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/30" data-testid="share-funnel-total-copies">
                      <p className="text-xs text-muted-foreground">Copy completions</p>
                      <p className="text-2xl font-bold mt-1">{shareFunnel.totals.copies.toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Successful copies of the booking link.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20" data-testid="share-funnel-tap-conversion">
                      <p className="text-xs text-muted-foreground">Tap → completion</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-600">
                        {(shareFunnel.totals.tapToCompletionRate * 100).toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Confirmed-share rate — taps that produced a completion.
                      </p>
                    </div>
                  </div>

                  <ShareFunnelTrendChart
                    series={shareFunnel.series ?? []}
                    platformSeries={shareFunnel.platformSeries ?? {}}
                    selectedPlatform={shareFunnelPlatform}
                    onSelectPlatform={setShareFunnelPlatform}
                  />

                  <div>
                    <h3 className="text-sm font-medium mb-3">Breakdown by surface</h3>
                    {shareFunnel.surfaces.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="share-funnel-empty">
                        No share activity recorded in this window yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-share-funnel-surfaces">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-4 font-medium">Surface</th>
                              <th className="py-2 pr-4 font-medium text-right">Taps</th>
                              <th className="py-2 pr-4 font-medium text-right">Completions</th>
                              <th className="py-2 pr-4 font-medium text-right">Copies</th>
                              <th className="py-2 font-medium text-right">Tap → completion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareFunnel.surfaces.map((s) => (
                              <tr
                                key={s.screen}
                                className="border-b last:border-b-0"
                                data-testid={`share-funnel-row-${s.screen}`}
                              >
                                <td className="py-2 pr-4">
                                  <Badge variant="outline" className="capitalize">
                                    {SURFACE_LABELS[s.screen] || s.screen}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">{s.taps.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{s.completions.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{s.copies.toLocaleString()}</td>
                                <td className="py-2 text-right tabular-nums">
                                  {s.taps > 0 ? `${(s.tapToCompletionRate * 100).toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Breakdown by device platform</h3>
                    {shareFunnel.platforms.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="share-funnel-platforms-empty">
                        No platform-tagged share activity recorded in this window yet.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-share-funnel-platforms">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-4 font-medium">Platform</th>
                              <th className="py-2 pr-4 font-medium text-right">Taps</th>
                              <th className="py-2 pr-4 font-medium text-right">Completions</th>
                              <th className="py-2 pr-4 font-medium text-right">Copies</th>
                              <th className="py-2 font-medium text-right">Tap → completion</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareFunnel.platforms.map((p) => (
                              <tr
                                key={p.platform}
                                className="border-b last:border-b-0"
                                data-testid={`share-funnel-platform-row-${p.platform}`}
                              >
                                <td className="py-2 pr-4">
                                  <Badge variant="outline">
                                    {PLATFORM_LABELS[p.platform] || p.platform}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.taps.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.completions.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.copies.toLocaleString()}</td>
                                <td className="py-2 text-right tabular-nums">
                                  {p.taps > 0 ? `${(p.tapToCompletionRate * 100).toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3">Breakdown by share destination</h3>
                    {shareFunnel.targets.length === 0 ? (
                      <p className="text-sm text-muted-foreground" data-testid="share-funnel-targets-empty">
                        No share destinations recorded in this window yet.
                      </p>
                    ) : (
                      <>
                        <ShareDestinationChart targets={shareFunnel.targets} />
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-share-funnel-targets">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b">
                              <th className="py-2 pr-4 font-medium">Destination</th>
                              <th className="py-2 pr-4 font-medium text-right">Completions</th>
                              <th className="py-2 pr-4 font-medium text-right">Copies</th>
                              <th className="py-2 font-medium text-right">% of tagged completions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shareFunnel.targets.map((t) => (
                              <tr
                                key={t.target}
                                className="border-b last:border-b-0"
                                data-testid={`share-funnel-target-row-${t.target}`}
                              >
                                <td className="py-2 pr-4">
                                  <Badge variant="outline">
                                    {formatTargetLabel(t.target)}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">{t.completions.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{t.copies.toLocaleString()}</td>
                                <td className="py-2 text-right tabular-nums">
                                  {`${(t.shareOfCompletions * 100).toFixed(1)}%`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1" data-testid="share-funnel-notes">
                    <p><strong>Taps:</strong> {shareFunnel.notes.taps}</p>
                    <p><strong>Completions:</strong> {shareFunnel.notes.completions}</p>
                    <p><strong>Copies:</strong> {shareFunnel.notes.copies}</p>
                    <p><strong>Platforms:</strong> {shareFunnel.notes.platforms}</p>
                    {shareFunnel.notes.targets && (
                      <p><strong>Destinations:</strong> {shareFunnel.notes.targets}</p>
                    )}
                    {shareFunnel.notes.series && (
                      <p><strong>Trend:</strong> {shareFunnel.notes.series}</p>
                    )}
                    {shareFunnel.notes.historical && (
                      <p data-testid="share-funnel-note-historical">
                        <strong>Historical PostHog data:</strong>{" "}
                        {shareFunnel.notes.historical}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm" data-testid="card-cohorts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                Monthly Cohorts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cohorts?.cohorts?.map((c, i) => (
                  <div 
                    key={c.cohort_month || i} 
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30"
                    data-testid={`cohort-row-${c.cohort_month}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-medium">{c.cohort_month}</span>
                      <span className="text-sm text-muted-foreground">
                        {Number(c.total_signups).toLocaleString()} signups
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {Number(c.converted_to_paid).toLocaleString()} paid
                      </span>
                      <Badge 
                        variant="outline"
                        className={cn(
                          Number(c.conversion_rate) > 5 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                            : ""
                        )}
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        {Number(c.conversion_rate).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm" data-testid="card-ltv">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-violet-500" />
                Lifetime Value by Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ltv?.ltvByPlan?.map((p) => (
                  <div 
                    key={p.plan} 
                    className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
                    data-testid={`ltv-card-${p.plan}`}
                  >
                    <h3 className="font-semibold text-lg capitalize">{p.plan}</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customers</span>
                        <span>{p.customers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Lifetime</span>
                        <span>{p.avgLifetimeMonths} months</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg LTV</span>
                        <span className="font-bold text-emerald-600">{safePrice(p.avgLtv)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
