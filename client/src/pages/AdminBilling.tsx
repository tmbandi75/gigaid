import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { 
  DollarSign, 
  TrendingUp,
  CreditCard,
  Users,
  Loader2,
  Search,
  Sparkles,
  ArrowUpRight,
  BarChart3,
  Clock,
  PieChart,
} from "lucide-react";
import { Link } from "wouter";

interface RevenueData {
  summary: {
    mrr: number;
    payingCustomers: number;
    netChurnPct: number;
  };
  trend: Array<{
    date: string;
    mrr: number;
    payingCustomers: number;
  }>;
  mrrByPlan: Array<{
    plan: string;
    count: number;
    mrr: number;
  }>;
}

interface CohortData {
  cohorts: Array<{
    month: string;
    signups: number;
    conversionRate: number;
  }>;
}

interface LTVData {
  avgLTV: number;
  avgLifespanDays: number;
  churnRate: number;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  iconColor,
  iconBg,
  subtitle,
}: { 
  title: string; 
  value: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  subtitle?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground font-medium mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBilling() {
  const [searchUserId, setSearchUserId] = useState("");

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: QUERY_KEYS.adminAnalyticsRevenue(),
  });

  const { data: cohortData, isLoading: cohortLoading } = useQuery<CohortData>({
    queryKey: QUERY_KEYS.adminAnalyticsCohorts(),
  });

  const { data: ltvData, isLoading: ltvLoading } = useQuery<LTVData>({
    queryKey: QUERY_KEYS.adminAnalyticsLtv(),
  });

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents == null || !Number.isFinite(cents)) return "--";
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (revenueLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm text-muted-foreground mt-3">Loading billing data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-admin-billing">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-emerald-500" />
            Billing & Revenue
          </h1>
          <p className="text-muted-foreground mt-1">Revenue metrics and subscription analytics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="MRR" 
          value={formatCurrency(revenueData?.summary?.mrr || 0)}
          icon={DollarSign}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <MetricCard 
          title="ARR" 
          value={formatCurrency((revenueData?.summary?.mrr || 0) * 12)}
          icon={TrendingUp}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
        />
        <MetricCard 
          title="Paying Customers" 
          value={(revenueData?.summary?.payingCustomers || 0).toString()}
          icon={Users}
          iconColor="text-violet-600 dark:text-violet-400"
          iconBg="bg-violet-500/10"
        />
        <MetricCard 
          title="Net Churn" 
          value={`${(revenueData?.summary?.netChurnPct || 0).toFixed(1)}%`}
          icon={CreditCard}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-violet-500" />
            <CardTitle>MRR by Plan</CardTitle>
          </div>
          <CardDescription>Revenue breakdown by subscription tier</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData?.mrrByPlan && revenueData.mrrByPlan.length > 0 ? (
            <div className="space-y-3">
              {revenueData.mrrByPlan.map((plan, index) => {
                const colors = [
                  { bg: "bg-violet-500/10", text: "text-violet-600", bar: "bg-violet-500" },
                  { bg: "bg-emerald-500/10", text: "text-emerald-600", bar: "bg-emerald-500" },
                  { bg: "bg-blue-500/10", text: "text-blue-600", bar: "bg-blue-500" },
                  { bg: "bg-amber-500/10", text: "text-amber-600", bar: "bg-amber-500" },
                ];
                const color = colors[index % colors.length];
                const totalMrr = revenueData.mrrByPlan.reduce((sum, p) => sum + p.mrr, 0);
                const percentage = totalMrr > 0 ? (plan.mrr / totalMrr) * 100 : 0;
                
                return (
                  <div key={plan.plan} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("capitalize", color.bg, color.text)}>
                          {plan.plan}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{plan.count} subscribers</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(plan.mrr)}/mo</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", color.bar)} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <PieChart className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No subscription data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              <CardTitle>Cohort Conversion</CardTitle>
            </div>
            <CardDescription>Signup to paid conversion by month</CardDescription>
          </CardHeader>
          <CardContent>
            {cohortLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : cohortData?.cohorts && cohortData.cohorts.length > 0 ? (
              <div className="space-y-3">
                {cohortData.cohorts.slice(0, 6).map((cohort) => (
                  <div key={cohort.month} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                    <span className="font-medium">{cohort.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{cohort.signups ?? 0} signups</span>
                      <Badge 
                        variant="outline"
                        className={cn(
                          (cohort.conversionRate ?? 0) > 5 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                            : "bg-muted"
                        )}
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        {(cohort.conversionRate ?? 0).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No cohort data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-violet-500" />
              <CardTitle>Lifetime Value</CardTitle>
            </div>
            <CardDescription>Customer LTV estimates</CardDescription>
          </CardHeader>
          <CardContent>
            {ltvLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                  <p className="text-sm text-muted-foreground mb-1">Average LTV</p>
                  <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {formatCurrency(ltvData?.avgLTV || 0)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Avg Lifespan</p>
                    <p className="text-xl font-bold">{ltvData?.avgLifespanDays || 0} days</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30">
                    <p className="text-sm text-muted-foreground mb-1">Monthly Churn</p>
                    <p className="text-xl font-bold">{(ltvData?.churnRate || 0).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-violet-500" />
            <CardTitle>User Billing Lookup</CardTitle>
          </div>
          <CardDescription>Search for a user to view their billing details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input 
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="Enter user ID to view billing details"
                data-testid="input-search-user"
                className="h-11 rounded-xl"
              />
            </div>
            <Link href={searchUserId ? `/admin/users/${searchUserId}` : "#"}>
              <Button disabled={!searchUserId} data-testid="button-view-user" className="h-11 px-6 rounded-xl gap-2">
                <Search className="h-4 w-4" />
                View User
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            View detailed billing history, retry payments, and manage subscriptions from the user detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
