import {
  User,
  DollarSign,
  Sparkle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

interface StepConfig {
  label: string;
  icon: LucideIcon;
  description: string;
}

const steps: StepConfig[] = [
  { label: "About You", icon: User, description: "Name & service type" },
  { label: "Pricing", icon: DollarSign, description: "Set your rates" },
  { label: "AI Setup", icon: Sparkle, description: "Smart suggestions" },
];

interface WebOnboardingStepperProps {
  currentStep: number;
}

export function WebOnboardingStepper({ currentStep }: WebOnboardingStepperProps) {
  const activeIndex = currentStep - 2;

  return (
    <nav className="space-y-1" data-testid="web-onboarding-stepper" aria-label="Onboarding steps">
      {steps.map((s, i) => {
        const isCompleted = activeIndex > i;
        const isCurrent = activeIndex === i;

        return (
          <div
            key={s.label}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors ${
              isCurrent
                ? "bg-white/15"
                : isCompleted
                  ? "opacity-80"
                  : "opacity-50"
            }`}
            aria-current={isCurrent ? "step" : undefined}
            data-testid={`stepper-step-${i + 1}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                isCompleted
                  ? "bg-emerald-400/20"
                  : isCurrent
                    ? "bg-white/20"
                    : "bg-white/10"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <s.icon className={`h-4 w-4 ${isCurrent ? "text-white" : "text-white/70"}`} />
              )}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium leading-tight ${isCurrent ? "text-white" : "text-white/90"}`}>
                {s.label}
              </p>
              <p className="text-xs text-white/60 leading-tight truncate">{s.description}</p>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
