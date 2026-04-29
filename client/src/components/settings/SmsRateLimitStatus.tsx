import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, MessageCircle } from "lucide-react";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface SmsRateLimitStatusResponse {
  used: number;
  cap: number | null;
  unlimited: boolean;
}

interface Props {
  className?: string;
}

function getTone(used: number, cap: number) {
  const pct = cap > 0 ? used / cap : 0;
  if (used >= cap) {
    return {
      level: "hit" as const,
      container:
        "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      text: "text-amber-900 dark:text-amber-100",
      Icon: AlertTriangle,
    };
  }
  if (pct >= 0.8) {
    return {
      level: "near" as const,
      container:
        "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      text: "text-amber-900 dark:text-amber-100",
      Icon: AlertTriangle,
    };
  }
  return {
    level: "ok" as const,
    container: "border-border bg-muted/40",
    iconColor: "text-muted-foreground",
    text: "text-foreground",
    Icon: MessageCircle,
  };
}

export function SmsRateLimitStatus({ className }: Props) {
  const { data, isLoading, isError } = useQuery<SmsRateLimitStatusResponse>({
    queryKey: QUERY_KEYS.smsRateLimitStatus(),
  });

  if (isLoading) {
    return (
      <div
        className={`rounded-md border border-border bg-muted/40 p-3 flex items-center gap-2 text-xs text-muted-foreground ${
          className ?? ""
        }`}
        data-testid="status-sms-rate-limit-loading"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading your SMS sending limit…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className={`rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 ${
          className ?? ""
        }`}
        data-testid="status-sms-rate-limit-error"
      >
        <Info
          className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p className="text-xs text-muted-foreground">
          We couldn't load your SMS sending limit right now. Try again in a
          moment.
        </p>
      </div>
    );
  }

  if (data.unlimited) {
    return (
      <div
        className={`rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 ${
          className ?? ""
        }`}
        data-testid="panel-sms-rate-limit-status"
      >
        <Info
          className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="text-xs text-foreground space-y-0.5">
          <p className="font-medium" data-testid="text-sms-rate-limit-headline">
            {data.used} SMS sent in the last 24 hours
          </p>
          <p
            className="text-muted-foreground"
            data-testid="text-sms-rate-limit-description"
          >
            Your plan has no daily safety limit on outgoing texts.
          </p>
        </div>
      </div>
    );
  }

  const cap = data.cap ?? 0;
  const used = Math.max(0, data.used);
  const tone = getTone(used, cap);
  const Icon = tone.Icon;
  const remaining = Math.max(0, cap - used);
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  let description: string;
  if (tone.level === "hit") {
    description = `You've hit the ${cap}-text-per-day safety limit. Scheduled texts will resume automatically once that 24-hour window clears.`;
  } else if (tone.level === "near") {
    description = `You're close to your ${cap}-text-per-day safety limit. ${remaining} more before texts get held back.`;
  } else {
    description = `Limits reset on a rolling 24-hour window. Your plan allows up to ${cap} per day.`;
  }

  return (
    <div
      className={`rounded-md border ${tone.container} p-3 space-y-2 ${
        className ?? ""
      }`}
      data-testid="panel-sms-rate-limit-status"
    >
      <div className="flex items-start gap-2">
        <Icon
          className={`h-4 w-4 mt-0.5 shrink-0 ${tone.iconColor}`}
          aria-hidden="true"
        />
        <div className={`text-xs space-y-0.5 ${tone.text}`}>
          <p
            className="font-medium"
            data-testid="text-sms-rate-limit-headline"
          >
            <span data-testid="text-sms-rate-limit-used">{used}</span>
            {" of "}
            <span data-testid="text-sms-rate-limit-cap">{cap}</span>
            {" SMS sent in the last 24 hours"}
          </p>
          <p
            className="opacity-90"
            data-testid="text-sms-rate-limit-description"
          >
            {description}
          </p>
        </div>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="SMS daily usage"
        data-testid="meter-sms-rate-limit"
      >
        <div
          className={
            tone.level === "ok"
              ? "h-full bg-emerald-500"
              : "h-full bg-amber-500"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
