import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  FileText,
  Sparkles,
  Zap
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

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function GigAidImpact() {
  const { data: impact, isLoading } = useQuery<ImpactStats>({
    queryKey: ["/api/ai/impact"],
    refetchInterval: 60000,
  });

  const hasImpact = impact && (
    impact.moneyCollectedViaReminders > 0 || 
    impact.leadsConverted > 0 || 
    impact.invoicesFromNudge > 0 ||
    impact.totalActed > 0
  );

  if (isLoading || !hasImpact) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30" data-testid="card-gigaid-impact">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">GigAid Impact</h3>
            <p className="text-xs text-muted-foreground">How I've helped your business</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {impact.moneyCollectedViaReminders > 0 && (
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

          {impact.leadsConverted > 0 && (
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

          {impact.invoicesFromNudge > 0 && (
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

          {impact.invoiceRemindersActed > 0 && (
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

        {impact.totalActed > 0 && (
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
  );
}
