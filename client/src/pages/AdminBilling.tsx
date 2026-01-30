import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DollarSign, 
  TrendingUp,
  CreditCard,
  Users,
  ArrowLeft,
  Loader2,
  Search
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

export default function AdminBilling() {
  const [searchUserId, setSearchUserId] = useState("");

  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: ["/api/admin/analytics/revenue"],
  });

  const { data: cohortData, isLoading: cohortLoading } = useQuery<CohortData>({
    queryKey: ["/api/admin/analytics/cohorts"],
  });

  const { data: ltvData, isLoading: ltvLoading } = useQuery<LTVData>({
    queryKey: ["/api/admin/analytics/ltv"],
  });

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (revenueLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin/cockpit">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <DollarSign className="h-6 w-6" />
                Billing & Revenue
              </h1>
              <p className="text-green-100 text-sm mt-1">Revenue metrics and subscription management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">MRR</p>
                  <p className="text-2xl font-bold">{formatCurrency(revenueData?.summary?.mrr || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ARR</p>
                  <p className="text-2xl font-bold">{formatCurrency((revenueData?.summary?.mrr || 0) * 12)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paying Customers</p>
                  <p className="text-2xl font-bold">{revenueData?.summary?.payingCustomers || 0}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Churn</p>
                  <p className="text-2xl font-bold">{(revenueData?.summary?.netChurnPct || 0).toFixed(1)}%</p>
                </div>
                <CreditCard className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>MRR by Plan</CardTitle>
            <CardDescription>Revenue breakdown by subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData?.mrrByPlan && revenueData.mrrByPlan.length > 0 ? (
              <div className="space-y-3">
                {revenueData.mrrByPlan.map((plan) => (
                  <div key={plan.plan} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{plan.plan}</Badge>
                      <span className="text-sm text-muted-foreground">{plan.count} subscribers</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(plan.mrr)}/mo</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No subscription data available</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Conversion</CardTitle>
              <CardDescription>Signup to paid conversion by month</CardDescription>
            </CardHeader>
            <CardContent>
              {cohortLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : cohortData?.cohorts && cohortData.cohorts.length > 0 ? (
                <div className="space-y-2">
                  {cohortData.cohorts.slice(0, 6).map((cohort) => (
                    <div key={cohort.month} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{cohort.month}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{cohort.signups ?? 0} signups</span>
                        <Badge variant={(cohort.conversionRate ?? 0) > 5 ? "default" : "secondary"}>
                          {(cohort.conversionRate ?? 0).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No cohort data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifetime Value</CardTitle>
              <CardDescription>Customer LTV estimates</CardDescription>
            </CardHeader>
            <CardContent>
              {ltvLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average LTV</span>
                    <span className="text-xl font-bold">{formatCurrency(ltvData?.avgLTV || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Lifespan</span>
                    <span className="font-medium">{ltvData?.avgLifespanDays || 0} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Monthly Churn Rate</span>
                    <span className="font-medium">{(ltvData?.churnRate || 0).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Billing Lookup</CardTitle>
            <CardDescription>Search for a user to view their billing details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  placeholder="Enter user ID to view billing details"
                  data-testid="input-search-user"
                />
              </div>
              <Link href={searchUserId ? `/admin/users/${searchUserId}` : "#"}>
                <Button disabled={!searchUserId} data-testid="button-view-user">
                  <Search className="h-4 w-4 mr-2" />
                  View User
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              View detailed billing history, retry payments, and manage subscriptions from the user detail page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
