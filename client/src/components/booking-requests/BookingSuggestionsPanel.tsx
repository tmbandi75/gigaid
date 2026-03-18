import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, ArrowRight } from "lucide-react";

interface BookingSuggestionsPanelProps {
  pendingCount: number;
  onViewPending: () => void;
}

export function BookingSuggestionsPanel({ pendingCount, onViewPending }: BookingSuggestionsPanelProps) {
  if (pendingCount === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20" data-testid="section-booking-suggestions">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {pendingCount === 1
                ? "1 booking is awaiting approval."
                : `${pendingCount} bookings are awaiting approval.`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingCount === 1
                ? "Review and accept to confirm the job."
                : "Review and accept to confirm the jobs."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={onViewPending}
            data-testid="button-view-pending-bookings"
            aria-label="View pending bookings"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
