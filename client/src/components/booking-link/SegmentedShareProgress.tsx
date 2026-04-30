import { useEffect, useRef } from "react";
import { CheckCircle2, Flame } from "lucide-react";
import { motion } from "framer-motion";

interface SegmentedShareProgressProps {
  count: number;
  target: number;
}

const FIXED_SUBTEXT = "Send to 5 people — most users get booked here";
const CELEBRATION_TEXT = "You've hit today's goal — keep the momentum";

function statusFor(count: number): string {
  if (count < 2) return "Getting started";
  if (count < 4) return "Momentum building";
  return "Booking zone";
}

export function SegmentedShareProgress({ count, target }: SegmentedShareProgressProps) {
  const safeTarget = Math.max(target, 1);
  const rawCount = Math.max(count, 0);
  // Visual fill caps at the target so an over-target count (e.g. 7/5)
  // doesn't try to render extra segments — the celebratory state below
  // is what acknowledges the over-target case.
  const safeCount = Math.min(rawCount, safeTarget);
  const goalReached = rawCount >= safeTarget;
  const inBookingZone = !goalReached && safeCount >= 4;
  const status = statusFor(safeCount);

  // One-shot animation gate: the celebratory entrance only animates on
  // the render where we actually cross from below-target to at-or-
  // above-target. We derive `justCrossed` during render (NOT in an
  // effect) because framer-motion captures `initial` on first mount of
  // the celebratory <motion.div>; toggling state after mount would
  // make us miss the transition render entirely. The ref is updated
  // post-commit so subsequent re-renders triggered by background
  // refetches (focus / 30s staleTime) keep the celebratory state on
  // screen but skip the entrance animation — no flashing on every
  // refresh.
  const prevReachedRef = useRef(goalReached);
  const justCrossed = goalReached && !prevReachedRef.current;
  useEffect(() => {
    prevReachedRef.current = goalReached;
  }, [goalReached]);

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
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  filled ? "w-full opacity-100" : "w-0 opacity-0"
                } ${goalReached ? "bg-green-500" : "bg-primary"}`}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      {goalReached ? (
        <motion.div
          initial={justCrossed ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-2 flex items-center gap-1.5"
          data-testid="hero-share-progress-celebrated"
          // Reflects the one-shot animation gate so tests can lock the
          // "animate on transition, not on refetch" requirement without
          // peeking into framer-motion internals.
          data-animate-celebration={justCrossed ? "true" : "false"}
        >
          <motion.span
            initial={justCrossed ? { scale: 0.4, rotate: -15 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="inline-flex"
          >
            <CheckCircle2
              className="h-4 w-4 text-green-600 dark:text-green-500"
              aria-hidden="true"
              data-testid="icon-progress-status-check"
            />
          </motion.span>
          <p
            className="text-xs font-semibold text-green-700 dark:text-green-400"
            data-testid="text-progress-status"
          >
            {CELEBRATION_TEXT}
          </p>
        </motion.div>
      ) : (
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
      )}
      {!goalReached && (
        <p
          className="text-xs text-muted-foreground mt-1"
          data-testid="text-progress-subtext"
        >
          {FIXED_SUBTEXT}
        </p>
      )}
    </div>
  );
}
