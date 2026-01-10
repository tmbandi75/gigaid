import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Check, Link2, Briefcase, Clock, Bell, ChevronRight, Copy, PartyPopper } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { SendBookingLinkDialog } from "./SendBookingLinkDialog";

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
    id: "share_booking",
    title: "Share Your Booking Link",
    description: "Send this to clients to book and pay you",
    icon: Link2,
    action: "Get Link",
    route: "/settings",
  },
  {
    id: "add_service",
    title: "Add a Service",
    description: "What do you usually get hired to do?",
    icon: Briefcase,
    action: "Add Service",
    route: "/settings",
  },
  {
    id: "set_availability",
    title: "Set Your Hours",
    description: "When can clients book you?",
    icon: Clock,
    action: "Set Hours",
    route: "/settings",
  },
  {
    id: "set_reminder",
    title: "Turn on Reminders",
    description: "Reduce no-shows automatically",
    icon: Bell,
    action: "Enable",
    route: "/reminders",
  },
];

function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as unknown as { analytics?: { track: (name: string, props?: Record<string, unknown>) => void } }).analytics) {
    (window as unknown as { analytics: { track: (name: string, props?: Record<string, unknown>) => void } }).analytics.track(eventName, properties);
  }
}

interface OnboardingChecklistProps {
  currentStep: number;
  onStepClick: (step: number, route: string) => void;
  onComplete: () => void;
  bookingSlug?: string;
}

export function OnboardingChecklist({ currentStep, onStepClick, onComplete, bookingSlug }: OnboardingChecklistProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const progress = Math.round((currentStep / steps.length) * 100);
  const isComplete = currentStep >= steps.length;
  const confettiShownRef = useRef(false);
  const prevStepRef = useRef(currentStep);
  const [showSendLinkDialog, setShowSendLinkDialog] = useState(false);

  useEffect(() => {
    trackEvent("onboarding_checklist_viewed");
  }, []);

  useEffect(() => {
    if (isComplete && !confettiShownRef.current && prevStepRef.current < steps.length) {
      const hasShownConfetti = localStorage.getItem("onboarding_confetti_shown");
      if (!hasShownConfetti) {
        confettiShownRef.current = true;
        localStorage.setItem("onboarding_confetti_shown", "true");
        localStorage.setItem("onboarding_completed_at", new Date().toISOString());
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#10b981"],
        });

        trackEvent("onboarding_completed");
      }
    }
    prevStepRef.current = currentStep;
  }, [isComplete, currentStep]);

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/onboarding", { completed: true, step: steps.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      onComplete();
    },
  });

  const handleCopyBookingLink = async () => {
    if (bookingSlug) {
      const bookingUrl = `${window.location.origin}/book/${bookingSlug}`;
      try {
        await navigator.clipboard.writeText(bookingUrl);
        toast({
          title: "Link copied!",
          description: "Your booking link is ready to share",
        });
        trackEvent("onboarding_copy_booking_link_clicked");
      } catch {
        toast({
          title: "Couldn't copy link",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } else {
      onStepClick(0, "/settings");
    }
  };

  const handleStepClick = (index: number, route: string) => {
    trackEvent("onboarding_step_clicked", { step_key: steps[index].id });
    
    if (steps[index].id === "share_booking") {
      setShowSendLinkDialog(true);
      return;
    }
    
    onStepClick(index, route);
  };

  if (isComplete) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-violet-500/5 to-emerald-500/5" data-testid="card-onboarding-complete">
        <CardContent className="py-5">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-3 rounded-full bg-gradient-to-br from-primary to-violet-500 text-white shadow-lg">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-lg">You're ready to book jobs</p>
              <p className="text-sm text-muted-foreground mt-1">Send your booking link to your next customer and get paid faster.</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button 
                className="flex-1 gap-2"
                onClick={handleCopyBookingLink}
                data-testid="button-copy-booking-link"
              >
                <Copy className="h-4 w-4" />
                Copy Booking Link
              </Button>
              <Button 
                variant="outline"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                data-testid="button-dismiss-checklist"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-onboarding-checklist">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          <span>Get Your First Job Booked</span>
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
                  onClick={() => handleStepClick(index, step.route)}
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

      <SendBookingLinkDialog
        open={showSendLinkDialog}
        onClose={() => setShowSendLinkDialog(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
        }}
      />
    </Card>
  );
}
