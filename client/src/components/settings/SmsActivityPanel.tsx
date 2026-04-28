import { useQuery } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";
import { QUERY_KEYS } from "@/lib/queryKeys";

interface RateLimitedSms {
  id: string;
  type: string;
  channel: string;
  toAddress: string;
  scheduledFor: string | null;
  canceledAt: string | null;
}

interface RateLimitedResponse {
  messages: RateLimitedSms[];
}

const TYPE_LABELS: Record<string, string> = {
  followup: "Post-job follow-up",
  payment_reminder: "Payment reminder",
  review_request: "Review request",
  confirmation: "Booking confirmation",
  first_booking_nudge_10m: "First-booking nudge (10 min)",
  first_booking_nudge_24h: "First-booking nudge (24 hr)",
  first_booking_nudge_72h: "First-booking nudge (72 hr)",
};

function formatType(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRecipient(toAddress: string): string {
  const digits = toAddress.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const a = digits.slice(1, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7);
    return `(${a}) ${b}-${c}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return toAddress;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SmsActivityPanel() {
  const { data, isLoading, isError } = useQuery<RateLimitedResponse>({
    queryKey: QUERY_KEYS.smsRateLimitedRecent(),
  });

  const messages = data?.messages ?? [];

  return (
    <div className="space-y-2" data-testid="panel-sms-activity">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">SMS activity</p>
        <span className="text-xs text-muted-foreground">Last 7 days</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Texts we held back because you hit your daily safety limit.
      </p>

      {isLoading ? (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground py-2"
          data-testid="status-sms-activity-loading"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading recent activity…
        </div>
      ) : isError ? (
        <p
          className="text-xs text-muted-foreground py-2"
          data-testid="status-sms-activity-error"
        >
          We couldn't load your recent SMS activity. Try again in a moment.
        </p>
      ) : messages.length === 0 ? (
        <p
          className="text-xs text-muted-foreground py-2"
          data-testid="status-sms-activity-empty"
        >
          Nothing to show — no scheduled texts have been held back recently.
        </p>
      ) : (
        <>
          <div
            className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 flex items-start gap-2"
            data-testid="text-sms-activity-explainer"
          >
            <Info
              className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs text-amber-900 dark:text-amber-100">
              You've hit the 3-text-per-day safety limit. The next scheduled
              text will go out automatically once that window clears.
            </p>
          </div>
          <ul
            className="divide-y divide-border rounded-md border border-border"
            data-testid="list-sms-rate-limited"
          >
            {messages.map((m) => (
              <li
                key={m.id}
                className="px-3 py-2 text-xs space-y-0.5"
                data-testid={`row-sms-rate-limited-${m.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-medium text-foreground"
                    data-testid={`text-sms-rate-limited-type-${m.id}`}
                  >
                    {formatType(m.type)}
                  </span>
                  <span
                    className="text-muted-foreground"
                    data-testid={`text-sms-rate-limited-time-${m.id}`}
                  >
                    {formatTimestamp(m.canceledAt ?? m.scheduledFor)}
                  </span>
                </div>
                <div
                  className="text-muted-foreground"
                  data-testid={`text-sms-rate-limited-to-${m.id}`}
                >
                  To {formatRecipient(m.toAddress)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
