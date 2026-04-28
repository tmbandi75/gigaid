import { useEffect } from "react";
import { safePriceCents } from "@/lib/safePrice";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, DollarSign } from "lucide-react";
import { BookingLinkShare } from "@/components/booking-link";
import {
  NextBestActionCard,
  deriveNBAState,
  type DashboardSummary,
} from "@/components/dashboard/NextBestActionCard";
import { useAuth } from "@/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { _resetNBAShownDedupeForTests } from "@/lib/nbaAnalytics";

interface GamePlanStats {
  jobsToday: number;
  moneyCollectedToday: number;
  moneyWaiting: number;
  messagesToSend: number;
}

interface GamePlanData {
  priorityItem: unknown;
  upNextItems: unknown[];
  stats: GamePlanStats;
  recentlyCompleted: unknown[];
  dashboardSummary?: DashboardSummary;
}

function readVariant(): "mobile" | "desktop" {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  return params.get("variant") === "desktop" ? "desktop" : "mobile";
}

/**
 * E2E-only harness that mirrors the dashboard's NBA region. It deliberately
 * fetches /api/dashboard/game-plan via the same react-query infrastructure
 * the real /dashboard route uses, so Playwright can drive every NBA state by
 * mocking that single endpoint — exercising the production data path rather
 * than synthetic component props. Mounted only when import.meta.env.DEV.
 */
export default function E2ENbaHarness() {
  const variant = readVariant();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<GamePlanData>({
    queryKey: QUERY_KEYS.dashboardGamePlan(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    _resetNBAShownDedupeForTests();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-4" data-testid="page-e2e-nba-harness">
        <p data-testid="text-nba-loading">Loading…</p>
      </div>
    );
  }

  const dashboardSummary = data.dashboardSummary;
  const stats = data.stats ?? {
    jobsToday: 0,
    moneyCollectedToday: 0,
    moneyWaiting: 0,
    messagesToSend: 0,
  };
  const nbaState = deriveNBAState(dashboardSummary, user?.id);

  // Mirror TodaysGamePlanPage's suppression rule exactly.
  const suppressBookingLinkPrimary =
    nbaState === "NEW_USER" ||
    nbaState === "NO_JOBS_YET" ||
    nbaState === "READY_TO_INVOICE";

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-e2e-nba-harness">
      <div className="max-w-2xl mx-auto space-y-4" data-testid={`harness-state-${nbaState}`}>
        {!suppressBookingLinkPrimary && (
          <BookingLinkShare variant="primary" context="plan" />
        )}
        <NextBestActionCard
          summary={dashboardSummary}
          variant={variant}
          userId={user?.id}
          demoteMoneyTone={stats.moneyWaiting > 0}
        />
        {stats.moneyWaiting > 0 && (
          <Card
            className="border-0 shadow-md overflow-visible"
            data-testid="card-payment"
          >
            <CardContent className="p-5">
              <p className="text-3xl font-bold text-foreground mb-1">
                {safePriceCents(stats.moneyWaiting)}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                waiting to be collected
              </p>
              <Button className="w-full" data-testid="button-collect-payment">
                <DollarSign className="h-4 w-4 mr-2" />
                Collect Payment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
