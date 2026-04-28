import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CapabilityGate } from "@/components/CapabilityGate";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/formatCurrency";
import { ArrowRight, DollarSign } from "lucide-react";

interface GamePlanData {
  priorityItem?: {
    type: string;
    amount?: number;
    title?: string;
  };
  stats?: {
    moneyWaiting: number;
  };
}

interface PrimaryMoneyActionProps {
  className?: string;
}

export function PrimaryMoneyAction({ className }: PrimaryMoneyActionProps) {
  const [, navigate] = useLocation();

  const { data: gamePlan } = useQuery<GamePlanData>({
    queryKey: QUERY_KEYS.dashboardGamePlan(),
    staleTime: 1000 * 60 * 5,
  });

  let dynamicAmount = "";
  try {
    const waiting = gamePlan?.stats?.moneyWaiting ?? 0;
    const priorityAmount = gamePlan?.priorityItem?.amount ?? 0;
    const displayCents = priorityAmount > 0 ? priorityAmount : waiting > 0 ? waiting : 0;
    if (displayCents > 0) {
      dynamicAmount = formatCurrency(displayCents);
    }
  } catch {
    dynamicAmount = "";
  }

  const label = dynamicAmount
    ? `Send ${dynamicAmount} Invoice`
    : "Send Invoice";

  const handlePress = () => {
    navigate("/invoices/new");
  };

  return (
    <div className={className} data-testid="section-primary-money-action">
      <CapabilityGate
        capability="invoices.send"
        featureName="Invoice Sending"
        interceptClicks={true}
        showLockIndicator={false}
      >
        <Button
          size="lg"
          onClick={handlePress}
          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 border-emerald-700 dark:border-emerald-600 text-white shadow-md"
          data-testid="button-primary-send-invoice"
        >
          <DollarSign className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-base font-semibold">{label}</span>
          <ArrowRight className="h-5 w-5 ml-2 flex-shrink-0" />
        </Button>
      </CapabilityGate>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Get paid faster by sending an invoice now
      </p>
    </div>
  );
}
