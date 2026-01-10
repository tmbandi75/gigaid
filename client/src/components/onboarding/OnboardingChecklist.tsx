import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, Briefcase, Clock, Link2, Bell, ChevronRight } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Briefcase;
  action: string;
  route: string;
}

const steps: OnboardingStep[] = [
  {
    id: "add_service",
    title: "Add Service",
    description: "Set up your first service type",
    icon: Briefcase,
    action: "Add Service",
    route: "/settings",
  },
  {
    id: "set_availability",
    title: "Set Availability",
    description: "Define your working hours",
    icon: Clock,
    action: "Set Hours",
    route: "/settings",
  },
  {
    id: "share_booking",
    title: "Share Booking Link",
    description: "Get your public booking URL",
    icon: Link2,
    action: "Get Link",
    route: "/settings",
  },
  {
    id: "set_reminder",
    title: "Set Reminder",
    description: "Create your first reminder",
    icon: Bell,
    action: "Add Reminder",
    route: "/reminders",
  },
];

interface OnboardingChecklistProps {
  currentStep: number;
  onStepClick: (step: number, route: string) => void;
  onComplete: () => void;
}

export function OnboardingChecklist({ currentStep, onStepClick, onComplete }: OnboardingChecklistProps) {
  const queryClient = useQueryClient();
  const progress = Math.round((currentStep / steps.length) * 100);
  const isComplete = currentStep >= steps.length;

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/onboarding", { completed: true, step: steps.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      onComplete();
    },
  });

  if (isComplete) {
    return (
      <Card className="border-primary/20 bg-primary/5" data-testid="card-onboarding-complete">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary text-primary-foreground">
              <Check className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Setup Complete!</p>
              <p className="text-sm text-muted-foreground">You're ready to start using Gig Aid</p>
            </div>
            <Button 
              size="sm" 
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid="button-dismiss-checklist"
            >
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-onboarding-checklist">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Getting Started</span>
          <span className="text-sm font-normal text-muted-foreground">{currentStep}/{steps.length}</span>
        </CardTitle>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isCurrent ? "bg-primary/10" : isCompleted ? "opacity-60" : "opacity-40"
              }`}
              data-testid={`onboarding-step-${step.id}`}
            >
              <div className={`p-2 rounded-lg ${isCompleted ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${isCompleted ? "line-through" : ""}`}>{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {isCurrent && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => onStepClick(index, step.route)}
                  data-testid={`button-${step.id}`}
                >
                  {step.action}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
