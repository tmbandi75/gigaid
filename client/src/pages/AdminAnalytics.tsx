import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TrendingUp, Users, DollarSign, BarChart3, Target, Loader2, Sparkles, ArrowUpRight } from "lucide-react";

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

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
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

export default function AdminAnalytics() {
  const [days, setDays] = useState("30");

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: [`/api/admin/analytics/revenue?days=${days}`],
  });

  const { data: cohorts, isLoading: cohortsLoading } = useQuery<{ cohorts: CohortRow[] }>({
    queryKey: ["/api/admin/analytics/cohorts"],
  });

  const { data: funnels, isLoading: funnelsLoading } = useQuery<FunnelData>({
    queryKey: [`/api/admin/analytics/funnels?days=${days}`],
  });

  const { data: ltv, isLoading: ltvLoading } = useQuery<LtvData>({
    queryKey: ["/api/admin/analytics/ltv"],
  });

  const isLoading = revenueLoading || cohortsLoading || funnelsLoading || ltvLoading;

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
                      <span className="font-bold">${p.mrr.toLocaleString()}</span>
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
                        <span className="font-bold text-emerald-600">${p.avgLtv}</span>
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
