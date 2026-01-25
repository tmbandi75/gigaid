import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ArrowRight, Briefcase, FileText, Shield } from "lucide-react";

interface UserProfile {
  firstPaidBookingAt: string | null;
  firstPaymentReceivedAt: string | null;
}

interface OnboardingStatus {
  completed: boolean;
  step: number;
}

const STORAGE_KEY = "gigaid_golden_path_dismissed";

const goldenPathSteps = [
  {
    id: "add_job",
    title: "Add Your First Job",
    description: "Start by adding a job for a client you're working with.",
    icon: Briefcase,
    route: "/jobs/new",
    actionLabel: "Add Job",
  },
  {
    id: "send_invoice",
    title: "Send the Invoice",
    description: "Once the job is done, send an invoice to get paid.",
    icon: FileText,
    route: "/invoices",
    actionLabel: "View Invoices",
  },
  {
    id: "protected",
    title: "You're Protected",
    description: "GigAid handles follow-ups, reminders, and confirmations automatically.",
    icon: Shield,
    route: null,
    actionLabel: "Got It",
  },
];

interface GoldenPathGuideProps {
  onNavigate: (route: string) => void;
}

export function GoldenPathGuide({ onNavigate }: GoldenPathGuideProps) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [currentStep, setCurrentStep] = useState(0);
  
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/auth/user"],
  });
  
  const { data: onboarding } = useQuery<OnboardingStatus>({
    queryKey: ["/api/onboarding"],
  });
  
  useEffect(() => {
    if (dismissed) return;
    
    if (profile?.firstPaidBookingAt || profile?.firstPaymentReceivedAt) {
      setDismissed(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [profile, dismissed]);
  
  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };
  
  const handleNext = () => {
    const step = goldenPathSteps[currentStep];
    
    if (step.route) {
      onNavigate(step.route);
    }
    
    if (currentStep < goldenPathSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };
  
  const handleSkip = () => {
    handleDismiss();
  };
  
  if (dismissed) return null;
  
  if (!onboarding?.completed) return null;
  
  const step = goldenPathSteps[currentStep];
  const Icon = step.icon;
  
  return (
    <Card 
      className="mb-4 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10" 
      data-testid="card-golden-path"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  Step {currentStep + 1} of {goldenPathSteps.length}
                </span>
              </div>
              <h4 className="font-semibold text-sm mb-1">{step.title}</h4>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSkip}
            data-testid="button-dismiss-golden-path"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground"
            data-testid="button-skip-golden-path"
          >
            Skip Guide
          </Button>
          <Button 
            size="sm"
            onClick={handleNext}
            className="gap-1"
            data-testid="button-next-golden-path"
          >
            {step.actionLabel}
            {currentStep < goldenPathSteps.length - 1 && <ArrowRight className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
