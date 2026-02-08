import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { useLocation } from "wouter";
import { trackEvent } from "@/components/PostHogProvider";
import { FreeSetupCta } from "@/components/growth/FreeSetupCta";
import {
  Briefcase,
  DollarSign,
  CreditCard,
  Link2,
  Send,
  Check,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useMemo } from "react";
import confetti from "canvas-confetti";

interface ActivationStatus {
  servicesDone: boolean;
  pricingDone: boolean;
  paymentsDone: boolean;
  linkDone: boolean;
  quoteDone: boolean;
  completedAt: string | null;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isFullyActivated: boolean;
  disabled?: boolean;
  userCreatedAt?: string | null;
}

const STEPS = [
  {
    key: "servicesDone" as const,
    title: "Add a Service",
    description: "Tell clients what you do",
    icon: Briefcase,
    route: "/settings",
  },
  {
    key: "pricingDone" as const,
    title: "Set Your Price",
    description: "How much do you charge?",
    icon: DollarSign,
    route: "/settings",
  },
  {
    key: "paymentsDone" as const,
    title: "Connect Payments",
    description: "Get paid directly to your bank",
    icon: CreditCard,
    route: "/settings",
  },
  {
    key: "linkDone" as const,
    title: "Generate Booking Link",
    description: "Share it so clients can book you",
    icon: Link2,
    route: "/settings",
  },
  {
    key: "quoteDone" as const,
    title: "Send First Quote",
    description: "This is how you get paid",
    icon: Send,
    route: "/invoices/new",
  },
];

export function ActivationChecklist() {
  const [, navigate] = useLocation();
  const confettiShownRef = useRef(false);

  const { data: activation, isLoading } = useQuery<ActivationStatus>({
    queryKey: QUERY_KEYS.activation(),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (activation) {
      trackEvent("activation_checklist_viewed", {
        completedSteps: activation.completedSteps,
        percentComplete: activation.percentComplete,
      });
    }
  }, [!!activation]);

  const prevStepsRef = useRef(activation?.completedSteps ?? 0);
  useEffect(() => {
    if (activation && activation.completedSteps > prevStepsRef.current) {
      trackEvent("activation_step_completed", {
        completedSteps: activation.completedSteps,
        percentComplete: activation.percentComplete,
      });
      prevStepsRef.current = activation.completedSteps;
    }
  }, [activation?.completedSteps]);

  useEffect(() => {
    if (
      activation?.isFullyActivated &&
      !confettiShownRef.current
    ) {
      const hasShown = localStorage.getItem("activation_confetti_shown");
      if (!hasShown) {
        confettiShownRef.current = true;
        localStorage.setItem("activation_confetti_shown", "true");
        trackEvent("activation_completed", {
          totalSteps: activation.totalSteps,
          completedAt: activation.completedAt,
        });
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#10b981"],
        });
      }
    }
  }, [activation?.isFullyActivated]);

  if (activation?.disabled) return null;

  if (isLoading || !activation) {
    return (
      <Card className="border-0 shadow-sm" data-testid="activation-checklist-skeleton">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-2 w-full bg-muted rounded" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activation.isFullyActivated) {
    return null;
  }

  const remaining = activation.totalSteps - activation.completedSteps;

  const isStalled = useMemo(() => {
    if (!activation.userCreatedAt) return false;
    const createdAt = new Date(activation.userCreatedAt).getTime();
    const now = Date.now();
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
    const incompleteSteps = activation.totalSteps - activation.completedSteps;
    if (hoursSinceCreation >= 48) return true;
    if (hoursSinceCreation >= 24 && incompleteSteps >= 2) return true;
    return false;
  }, [activation.userCreatedAt, activation.completedSteps, activation.totalSteps]);

  return (
    <Card className="border-0 shadow-sm" data-testid="activation-checklist">
      <CardContent className="p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold" data-testid="text-activation-progress">
            You're {activation.percentComplete}% to your first paid booking
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {remaining} step{remaining !== 1 ? "s" : ""} left
          </p>
        </div>

        <Progress
          value={activation.percentComplete}
          className="h-2"
          data-testid="progress-activation"
        />

        <div className="space-y-1">
          {STEPS.map((step) => {
            const done = activation[step.key];
            return (
              <button
                key={step.key}
                onClick={() => {
                  if (!done) {
                    trackEvent("activation_step_clicked", { step: step.key, title: step.title });
                    navigate(step.route);
                  }
                }}
                disabled={done}
                className={`flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left transition-colors ${
                  done
                    ? "opacity-60"
                    : "hover-elevate cursor-pointer"
                }`}
                data-testid={`activation-step-${step.key}`}
              >
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
                    done
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "line-through" : ""}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                {!done && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {isStalled && (
          <div data-testid="activation-stall-cta">
            <FreeSetupCta variant="banner" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
