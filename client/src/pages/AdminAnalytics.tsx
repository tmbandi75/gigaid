import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Users, DollarSign, BarChart3, Target, Loader2 } from "lucide-react";

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
    <div className="space-y-1" data-testid={`funnel-bar-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toLocaleString()} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [, navigate] = useLocation();
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/cockpit")} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <div className="ml-auto flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32" data-testid="select-days">
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
      </header>

      <main className="p-4 space-y-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-mrr">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">MRR</p>
                      <p className="text-2xl font-bold" data-testid="text-mrr-value">
                        {formatCurrency(revenue?.summary?.mrr || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-paying-customers">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Paying Customers</p>
                      <p className="text-2xl font-bold" data-testid="text-paying-customers">
                        {revenue?.summary?.payingCustomers || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-churn">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Churn</p>
                      <p className="text-2xl font-bold" data-testid="text-churn">
                        {revenue?.summary?.netChurnPct?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-at-risk">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Target className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">At Risk</p>
                      <p className="text-2xl font-bold" data-testid="text-at-risk">
                        {formatCurrency(revenue?.summary?.revenueAtRisk || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-plan-distribution">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Plan Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {revenue?.planDistribution?.map((p) => (
                      <div key={p.plan} className="flex items-center justify-between" data-testid={`plan-row-${p.plan}`}>
                        <Badge variant="outline">{p.plan}</Badge>
                        <span className="font-medium">{p.count.toLocaleString()} users</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-mrr-by-plan">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    MRR by Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {revenue?.mrrByPlan?.map((p) => (
                      <div key={p.plan} className="flex items-center justify-between" data-testid={`mrr-row-${p.plan}`}>
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

            <Card data-testid="card-signup-funnel">
              <CardHeader>
                <CardTitle>Signup to Payment Funnel ({funnels?.period})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {funnels?.signupToPayment && (
                  <>
                    <FunnelBar label="Signups" value={funnels.signupToPayment.signups} total={funnels.signupToPayment.signups} color="bg-blue-500" />
                    <FunnelBar label="Enabled Profile" value={funnels.signupToPayment.enabledProfile} total={funnels.signupToPayment.signups} color="bg-blue-400" />
                    <FunnelBar label="Created Booking Link" value={funnels.signupToPayment.createdBookingLink} total={funnels.signupToPayment.signups} color="bg-blue-300" />
                    <FunnelBar label="Shared Booking Link" value={funnels.signupToPayment.sharedBookingLink} total={funnels.signupToPayment.signups} color="bg-green-400" />
                    <FunnelBar label="Received Booking" value={funnels.signupToPayment.receivedBooking} total={funnels.signupToPayment.signups} color="bg-green-500" />
                    <FunnelBar label="Received Payment" value={funnels.signupToPayment.receivedPayment} total={funnels.signupToPayment.signups} color="bg-green-600" />
                  </>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-lead-funnel">
                <CardHeader>
                  <CardTitle>Lead to Job Funnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {funnels?.leadToJob && (
                    <>
                      <FunnelBar label="Total Leads" value={funnels.leadToJob.totalLeads} total={funnels.leadToJob.totalLeads} color="bg-purple-500" />
                      <FunnelBar label="Contacted" value={funnels.leadToJob.contacted} total={funnels.leadToJob.totalLeads} color="bg-purple-400" />
                      <FunnelBar label="Quoted" value={funnels.leadToJob.quoted} total={funnels.leadToJob.totalLeads} color="bg-purple-300" />
                      <FunnelBar label="Converted" value={funnels.leadToJob.converted} total={funnels.leadToJob.totalLeads} color="bg-green-500" />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-job-funnel">
                <CardHeader>
                  <CardTitle>Job to Payment Funnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {funnels?.jobToPayment && (
                    <>
                      <FunnelBar label="Total Jobs" value={funnels.jobToPayment.totalJobs} total={funnels.jobToPayment.totalJobs} color="bg-orange-500" />
                      <FunnelBar label="Scheduled" value={funnels.jobToPayment.scheduled} total={funnels.jobToPayment.totalJobs} color="bg-orange-400" />
                      <FunnelBar label="In Progress" value={funnels.jobToPayment.inProgress} total={funnels.jobToPayment.totalJobs} color="bg-orange-300" />
                      <FunnelBar label="Completed" value={funnels.jobToPayment.completed} total={funnels.jobToPayment.totalJobs} color="bg-green-400" />
                      <FunnelBar label="Invoiced" value={funnels.jobToPayment.invoiced} total={funnels.jobToPayment.totalJobs} color="bg-green-500" />
                      <FunnelBar label="Paid" value={funnels.jobToPayment.paid} total={funnels.jobToPayment.totalJobs} color="bg-green-600" />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-cohorts">
              <CardHeader>
                <CardTitle>Monthly Cohorts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Cohort</th>
                        <th className="text-right p-2">Signups</th>
                        <th className="text-right p-2">Paid</th>
                        <th className="text-right p-2">Received Payment</th>
                        <th className="text-right p-2">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts?.cohorts?.map((c, i) => (
                        <tr key={c.cohort_month || i} className="border-b" data-testid={`cohort-row-${c.cohort_month}`}>
                          <td className="p-2 font-medium">{c.cohort_month}</td>
                          <td className="p-2 text-right">{Number(c.total_signups).toLocaleString()}</td>
                          <td className="p-2 text-right">{Number(c.converted_to_paid).toLocaleString()}</td>
                          <td className="p-2 text-right">{Number(c.received_payment).toLocaleString()}</td>
                          <td className="p-2 text-right">
                            <Badge variant={Number(c.conversion_rate) > 5 ? "default" : "outline"}>
                              {Number(c.conversion_rate).toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-ltv">
              <CardHeader>
                <CardTitle>Lifetime Value by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ltv?.ltvByPlan?.map((p) => (
                    <Card key={p.plan} className="bg-muted/50" data-testid={`ltv-card-${p.plan}`}>
                      <CardContent className="pt-4">
                        <h3 className="font-semibold text-lg capitalize">{p.plan}</h3>
                        <div className="mt-2 space-y-1 text-sm">
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
                            <span className="font-bold text-green-600">${p.avgLtv}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
