import { useLocation, useParams, useSearch } from "wouter";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sparkles } from "lucide-react";

export default function OnboardingPage() {
  console.log("[OnboardingPage] Rendering - route matched!");
  const [, navigate] = useLocation();
  const params = useParams<{ step?: string }>();
  const search = useSearch();
  const isMobile = useIsMobile();
  
  console.log("[OnboardingPage] params:", params, "search:", search);
  
  // Support both URL param (/onboarding/4) and query string (/onboarding?step=4)
  const searchParams = new URLSearchParams(search);
  const queryStep = searchParams.get("step");
  const requestedStep = params.step || queryStep;

  const handleComplete = () => {
    navigate("/dashboard");
  };

  const renderMobileHeader = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-violet-600 text-primary-foreground px-4 pt-6 pb-8">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-10 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to GigAid</h1>
        </div>
        <p className="text-primary-foreground/80 text-sm">Let's set up your profile in just a few steps</p>
      </div>
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="border-b bg-background sticky top-0 z-[999]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Welcome to GigAid</h1>
            <p className="text-sm text-muted-foreground">Let's set up your profile in just a few steps</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background" data-testid="page-onboarding">
      {isMobile ? renderMobileHeader() : renderDesktopHeader()}
      <div className={isMobile ? "-mt-4" : ""}>
        <OnboardingFlow 
          onComplete={handleComplete}
          initialStep={requestedStep ? parseInt(requestedStep, 10) : undefined}
        />
      </div>
    </div>
  );
}
