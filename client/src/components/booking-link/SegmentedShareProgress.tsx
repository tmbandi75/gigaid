import { Flame } from "lucide-react";

interface SegmentedShareProgressProps {
  count: number;
  target: number;
}

const FIXED_SUBTEXT = "Send to 5 people — most users get booked here";

function statusFor(count: number): string {
  if (count < 2) return "Getting started";
  if (count < 4) return "Momentum building";
  return "Booking zone";
}

export function SegmentedShareProgress({ count, target }: SegmentedShareProgressProps) {
  const safeTarget = Math.max(target, 1);
  const safeCount = Math.min(Math.max(count, 0), safeTarget);
  const inBookingZone = safeCount >= 4;
  const status = statusFor(safeCount);

  return (
    <div className="mt-3" data-testid="hero-share-progress">
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={safeCount}
        aria-valuemin={0}
        aria-valuemax={safeTarget}
        aria-label={`Today's share progress: ${safeCount} of ${safeTarget}`}
        data-testid="progress-bar-shares"
      >
        {Array.from({ length: safeTarget }).map((_, i) => {
          const filled = i < safeCount;
          return (
            <div
              key={i}
              className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
              data-testid={`progress-segment-${i}`}
            >
              <div
                className={`h-full rounded-full bg-primary transition-all duration-500 ease-out ${
                  filled ? "w-full opacity-100" : "w-0 opacity-0"
                }`}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {inBookingZone && (
          <Flame
            className="h-3.5 w-3.5 text-orange-500"
            aria-hidden="true"
            data-testid="icon-progress-status-flame"
          />
        )}
        <p
          className="text-xs font-semibold text-foreground"
          data-testid="text-progress-status"
        >
          {status}
        </p>
      </div>
      <p
        className="text-xs text-muted-foreground mt-1"
        data-testid="text-progress-subtext"
      >
        {FIXED_SUBTEXT}
      </p>
    </div>
  );
}
