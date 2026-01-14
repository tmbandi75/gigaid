import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  FileText,
  Sparkles,
  Zap,
  Info,
  Clock,
  Calculator,
} from "lucide-react";

interface ImpactStats {
  moneyCollectedViaReminders: number;
  invoiceRemindersActed: number;
  leadsConverted: number;
  invoicesFromNudge: number;
  totalNudgesGenerated: number;
  totalActed: number;
  actionRate: number;
  thisWeek: {
    nudgesActed: number;
  };
}

interface OutcomesSummary {
  metrics: OutcomeMetric[];
  summary: {
    totalInvoicesPaid: number;
    totalAmountCollected: number;
    totalNudgesActed: number;
    totalLeadsConverted: number;
    totalDaysSaved: number;
    totalCashAccelerated: number;
  } | null;
}

interface OutcomeMetric {
  metricDate: string;
  invoicesPaidCount: number;
  invoicesPaidAmount: number;
  avgDaysToPaid: number | null;
  nudgesActedCount: number;
  leadsConvertedCount: number;
  estimatedDaysSaved: number;
  estimatedCashAccelerated: number;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function GigAidImpact() {
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: impact, isLoading } = useQuery<ImpactStats>({
    queryKey: ["/api/ai/impact"],
    refetchInterval: 60000,
  });

  const { data: outcomeFlag } = useQuery<FeatureFlag>({
    queryKey: ["/api/feature-flags", "outcome_attribution"],
  });

  const { data: outcomes } = useQuery<OutcomesSummary>({
    queryKey: ["/api/outcomes"],
    enabled: outcomeFlag?.enabled === true,
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/outcomes/compute");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outcomes"] });
    },
  });

  const hasImpact = impact && (
    impact.moneyCollectedViaReminders > 0 || 
    impact.leadsConverted > 0 || 
    impact.invoicesFromNudge > 0 ||
    impact.totalActed > 0
  );

  const hasOutcomes = outcomes?.summary && (
    outcomes.summary.totalDaysSaved > 0 ||
    outcomes.summary.totalCashAccelerated > 0
  );

  if (isLoading || (!hasImpact && !hasOutcomes)) {
    return null;
  }

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30" data-testid="card-gigaid-impact">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">GigAid Impact</h3>
                <p className="text-xs text-muted-foreground">How I've helped your business</p>
              </div>
            </div>
            {outcomeFlag?.enabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCalculationModal(true)}
                data-testid="button-show-calculations"
              >
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>

          {outcomeFlag?.enabled && outcomes?.summary && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Time & Money Saved
                </span>
              </div>
              <div className="flex items-baseline gap-4">
                {outcomes.summary.totalDaysSaved > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {outcomes.summary.totalDaysSaved}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">days faster</span>
                  </div>
                )}
                {outcomes.summary.totalCashAccelerated > 0 && (
                  <div>
                    <span className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(outcomes.summary.totalCashAccelerated * 100)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">accelerated</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on {outcomes.summary.totalNudgesActed} actions taken
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {impact?.moneyCollectedViaReminders && impact.moneyCollectedViaReminders > 0 && (
              <div className="bg-white/60 dark:bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs text-muted-foreground">Collected faster</span>
                </div>
                <p className="text-lg font-bold text-emerald-600" data-testid="text-money-collected">
                  {formatCurrency(impact.moneyCollectedViaReminders)}
                </p>
              </div>
            )}

            {impact?.leadsConverted && impact.leadsConverted > 0 && (
              <div className="bg-white/60 dark:bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Leads converted</span>
                </div>
                <p className="text-lg font-bold text-blue-600" data-testid="text-leads-converted">
                  {impact.leadsConverted}
                </p>
              </div>
            )}

            {impact?.invoicesFromNudge && impact.invoicesFromNudge > 0 && (
              <div className="bg-white/60 dark:bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Invoices created</span>
                </div>
                <p className="text-lg font-bold text-amber-600" data-testid="text-invoices-created">
                  {impact.invoicesFromNudge}
                </p>
              </div>
            )}

            {impact?.invoiceRemindersActed && impact.invoiceRemindersActed > 0 && (
              <div className="bg-white/60 dark:bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-violet-600" />
                  <span className="text-xs text-muted-foreground">Reminders sent</span>
                </div>
                <p className="text-lg font-bold text-violet-600" data-testid="text-reminders-sent">
                  {impact.invoiceRemindersActed}
                </p>
              </div>
            )}
          </div>

          {impact?.totalActed && impact.totalActed > 0 && (
            <div className="mt-3 pt-3 border-t border-violet-200/50 dark:border-violet-800/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  {impact.totalActed} AI suggestions acted on
                </span>
                {Number.isFinite(impact.actionRate) && impact.actionRate > 0 && (
                  <span className="font-medium text-violet-600">
                    {impact.actionRate}% action rate
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCalculationModal} onOpenChange={setShowCalculationModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-violet-600" />
              How We Calculate Impact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Days Saved</h4>
              <p className="text-muted-foreground">
                Each action you take on a GigAid suggestion saves an estimated 0.5 days 
                of delay. This is a conservative estimate based on industry benchmarks 
                for payment collection acceleration.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Cash Accelerated</h4>
              <p className="text-muted-foreground">
                We calculate the value of getting paid faster using:
                <br />
                <code className="text-xs bg-muted px-1 rounded">
                  Amount × (Days Saved / 30) × 0.5
                </code>
                <br />
                The 0.5 multiplier ensures conservative estimates.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Leads Converted</h4>
              <p className="text-muted-foreground">
                We count leads that were marked as "won" after you acted on 
                GigAid's follow-up suggestions.
              </p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                All calculations use conservative estimates to ensure we never 
                overstate GigAid's impact on your business.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
