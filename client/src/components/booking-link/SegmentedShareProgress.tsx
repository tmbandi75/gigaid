import { useEffect, useRef } from "react";
import { CheckCircle2, Flame } from "lucide-react";
import { motion } from "framer-motion";

interface SegmentedShareProgressProps {
  count: number;
  target: number;
}

const FIXED_SUBTEXT = "Send to 5 people — most users get booked here";
const AT_TARGET_TEXT = "You've hit today's goal — keep the momentum";

// Escalating copy past the daily target. Each share past the goal swaps
// the celebratory line for a progressively more emphatic acknowledgement
// so pros have a concrete reason to keep tapping share after the
// celebration lands. Tiers are evaluated by `bonus` (rawCount - target):
//   bonus = 0  → the at-target celebration line above
//   bonus 1–2  → "On a roll"
//   bonus 3–4  → "Crushing it"
//   bonus ≥ 5  → "Unstoppable"
const BONUS_COPY_TIERS: ReadonlyArray<{ min: number; text: string }> = [
  { min: 1, text: "On a roll — keep them coming" },
  { min: 3, text: "Crushing it — every share is more pipeline" },
  { min: 5, text: "Unstoppable — you're on fire today" },
];

function statusFor(count: number): string {
  if (count < 2) return "Getting started";
  if (count < 4) return "Momentum building";
  return "Booking zone";
}

function celebrationCopyFor(bonus: number): string {
  let copy = AT_TARGET_TEXT;
  for (const tier of BONUS_COPY_TIERS) {
    if (bonus >= tier.min) copy = tier.text;
  }
  return copy;
}

export function SegmentedShareProgress({ count, target }: SegmentedShareProgressProps) {
  const safeTarget = Math.max(target, 1);
  const rawCount = Math.max(count, 0);
  // Visual fill caps at the target so an over-target count (e.g. 7/5)
  // doesn't try to render extra segments — the celebratory state below
  // is what acknowledges the over-target case.
  const safeCount = Math.min(rawCount, safeTarget);
  const goalReached = rawCount >= safeTarget;
  const bonus = Math.max(rawCount - safeTarget, 0);
  const inBookingZone = !goalReached && safeCount >= 4;
  const status = statusFor(safeCount);
  const celebrationText = celebrationCopyFor(bonus);

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
  // Same pattern for the bonus pill: animate only on the render where
  // `bonus` actually grows (i.e. the user just tapped share past the
  // goal). Refetch renders that report the same bonus value must NOT
  // replay the entrance animation, otherwise the pill would flash on
  // every focus / staleTime refetch while the count sits at, say, 7/5.
  const prevBonusRef = useRef(bonus);
  const bonusJustIncreased = bonus > prevBonusRef.current;
  // We piggyback on `justCrossed` for the pill's first appearance too:
  // when the user crosses straight from 4/5 → 6/5 in one update (rare
  // but possible if the share-progress query batches), `bonus` jumps
  // from 0 to >0 on the same render that flips `goalReached`, and
  // `bonusJustIncreased` already covers it. We keep them separate in
  // the data attributes so tests can lock each gate independently.
  const bonusShouldAnimate = bonusJustIncreased;
  useEffect(() => {
    prevReachedRef.current = goalReached;
    prevBonusRef.current = bonus;
  }, [goalReached, bonus]);

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
        <>
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
              {celebrationText}
            </p>
          </motion.div>
          {bonus > 0 && (
            <motion.div
              key={bonus}
              initial={
                bonusShouldAnimate ? { opacity: 0, y: 4, scale: 0.92 } : false
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 max-w-full"
              data-testid="hero-share-progress-bonus"
              data-bonus-count={String(bonus)}
              data-animate-bonus={bonusShouldAnimate ? "true" : "false"}
            >
              <span className="truncate">
                +{bonus} bonus share{bonus === 1 ? "" : "s"} today
              </span>
            </motion.div>
          )}
        </>
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
