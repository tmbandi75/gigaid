import { Briefcase, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCanPerform } from "@/hooks/useCapability";

interface JobQuotaMeterProps {
  className?: string;
  variant?: "card" | "inline";
}

export function JobQuotaMeter({ className = "", variant = "card" }: JobQuotaMeterProps) {
  const { current, limit, remaining, unlimited, loading } = useCanPerform("jobs.create");

  if (loading || unlimited || limit === undefined || limit === 0) {
    return null;
  }

  const used = Math.min(current, limit);
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const remainingCount = remaining ?? Math.max(0, limit - used);
  const isAtLimit = remainingCount <= 0;
  const isNearLimit = !isAtLimit && remainingCount <= 2;

  const accent = isAtLimit
    ? "text-destructive"
    : isNearLimit
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";
  const barColor = isAtLimit
    ? "bg-destructive"
    : isNearLimit
      ? "bg-amber-500"
      : "bg-primary";

  const headline = isAtLimit
    ? `You've used all ${limit} jobs this month`
    : `${used} of ${limit} jobs used this month`;
  const subline = isAtLimit
    ? "Upgrade to keep creating jobs."
    : `${remainingCount} ${remainingCount === 1 ? "job" : "jobs"} remaining on Free.`;

  if (variant === "inline") {
    return (
      <div
        className={`flex items-center gap-3 ${className}`}
        data-testid="meter-jobs-quota"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 text-xs">
            <span className={`font-medium ${accent}`} data-testid="text-jobs-quota-headline">
              {headline}
            </span>
            <span className="text-muted-foreground">{percentage}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${percentage}%` }}
              data-testid="bar-jobs-quota"
            />
          </div>
        </div>
        {isAtLimit && (
          <Link href="/pricing">
            <Button size="sm" data-testid="button-upgrade-jobs-quota-inline">
              Upgrade
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <Card
      className={`border ${isAtLimit ? "border-destructive/30 bg-destructive/5" : "border-border"} ${className}`}
      data-testid="meter-jobs-quota"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              isAtLimit ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            {isAtLimit ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Briefcase className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${accent}`} data-testid="text-jobs-quota-headline">
                  {headline}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-jobs-quota-subline">
                  {subline}
                </p>
              </div>
              {isAtLimit && (
                <Link href="/pricing">
                  <Button size="sm" data-testid="button-upgrade-jobs-quota">
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
                data-testid="bar-jobs-quota"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
